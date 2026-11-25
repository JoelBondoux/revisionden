/**
 * Tells parents when a target they set for a parent-set reward is met (docs/REWARDS.md,
 * "Parent-set rewards"). Runs from the Worker's cron trigger after the child reminders.
 *
 * - Once per reward: `parent_rewards.reached_notified_at` is set in the same step that claims it.
 * - Only while the reward is not marked given yet.
 * - Respects the nightly quiet hours (and time zone) the parent set for that child; the
 *   weekday school-hours window and the child's reminder switch do not apply to the parent.
 * - Does not count towards the child's 2 reminders a day, and is never sent to the child.
 * - Progress comes from the read-only `rewardsProgress`, so the child's "New!" rewards are kept.
 * - With no parent device signed up, nothing is claimed: the parent hears once they turn it on.
 */
import { and, eq, inArray, isNull } from 'drizzle-orm';
import {
  parentPushSubscriptions,
  parentRewards,
  parents,
  students,
  type Database,
} from '@revisionden/db';
import { rewardsProgress } from '../routes/rewards';
import { loadReminderSettings } from './runner';
import { isNightlyQuietTime, localClock } from './schedule';
import type { PushSender } from './web-push';

export interface ParentRewardRunSummary {
  /** Rewards the parent was told about in this run. */
  rewards: number;
  pushes: number;
  removed: number;
}

/** The text the service worker shows (fetched from the API; the push itself is empty). */
export function parentRewardMessage(nickname: string, title: string): string {
  return `${nickname} reached a reward target: ${title}`;
}

export async function runParentRewardNotifications(deps: {
  db: Database;
  now: Date;
  sender: PushSender;
}): Promise<ParentRewardRunSummary> {
  const { db, now, sender } = deps;
  const summary: ParentRewardRunSummary = { rewards: 0, pushes: 0, removed: 0 };

  const open = await db
    .select({
      studentId: students.id,
      yearGroup: students.yearGroup,
      familyId: students.familyId,
      rewardId: parentRewards.id,
    })
    .from(parentRewards)
    .innerJoin(students, eq(students.id, parentRewards.studentId))
    .where(and(isNull(parentRewards.givenAt), isNull(parentRewards.reachedNotifiedAt)));

  const byStudent = new Map<string, { student: (typeof open)[number]; ids: Set<string> }>();
  for (const row of open) {
    const entry = byStudent.get(row.studentId) ?? { student: row, ids: new Set<string>() };
    entry.ids.add(row.rewardId);
    byStudent.set(row.studentId, entry);
  }

  for (const { student, ids } of byStudent.values()) {
    const targets = await db
      .select({
        id: parentPushSubscriptions.id,
        endpoint: parentPushSubscriptions.endpoint,
        p256dh: parentPushSubscriptions.p256dh,
        auth: parentPushSubscriptions.auth,
      })
      .from(parentPushSubscriptions)
      .innerJoin(parents, eq(parents.id, parentPushSubscriptions.parentId))
      .where(eq(parents.familyId, student.familyId));
    if (targets.length === 0) continue;

    const settings = await loadReminderSettings(db, student.studentId);
    if (isNightlyQuietTime(localClock(now, settings.timeZone).time, settings)) continue;

    const { parentRewards: progress } = await rewardsProgress(
      db,
      { id: student.studentId, yearGroup: student.yearGroup },
      now,
    );
    for (const reward of progress) {
      if (!ids.has(reward.id) || !reward.reached || reward.givenAt !== null) continue;
      // Claim it first, so an overlapping run cannot tell the parent twice.
      const claimed = await db
        .update(parentRewards)
        .set({ reachedNotifiedAt: now })
        .where(and(eq(parentRewards.id, reward.id), isNull(parentRewards.reachedNotifiedAt)))
        .returning({ id: parentRewards.id });
      if (claimed.length === 0) continue;
      summary.rewards += 1;

      const gone: string[] = [];
      for (const target of targets) {
        const result = await sender.send(target);
        if (result === 'sent') summary.pushes += 1;
        if (result === 'gone') gone.push(target.id);
      }
      if (gone.length > 0) {
        await db.delete(parentPushSubscriptions).where(inArray(parentPushSubscriptions.id, gone));
        summary.removed += gone.length;
        const goneSet = new Set(gone);
        targets.splice(0, targets.length, ...targets.filter((t) => !goneSet.has(t.id)));
      }
    }
  }
  return summary;
}
