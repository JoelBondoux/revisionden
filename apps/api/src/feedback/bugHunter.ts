/**
 * Bug Hunter (docs/REWARDS.md): what a student earned for bug reports the operator confirmed.
 * The rules are in packages/core (bugReward); the track items belong to the reward catalogue,
 * which reads the count from here (`confirmedBugCount`).
 */
import { and, eq, gt, isNotNull, sql } from 'drizzle-orm';
import { localDate, weekStartOf } from '@revisionden/core';
import { feedback, type Database } from '@revisionden/db';

/** Confirmed bugs that moved the student along the Bug Hunter track (duplicates don't). */
export async function confirmedBugCount(db: Database, studentId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(feedback)
    .where(and(eq(feedback.studentId, studentId), eq(feedback.trackStep, true)));
  return row?.n ?? 0;
}

/** XP a student earned from confirmed bug reports (added to their total XP). */
export async function bugRewardXp(db: Database, studentId: string): Promise<number> {
  const [row] = await db
    .select({ xp: sql<number>`coalesce(sum(${feedback.rewardXp}), 0)::int` })
    .from(feedback)
    .where(eq(feedback.studentId, studentId));
  return row?.xp ?? 0;
}

/** Confirmed-bug rewards (any XP) the student earned this week, Monday to Sunday, UK time. */
export async function bugRewardsThisWeek(db: Database, studentId: string, now: Date) {
  const week = weekStartOf(localDate(now));
  const rows = await db
    .select({ at: feedback.confirmedAt })
    .from(feedback)
    .where(
      and(
        eq(feedback.studentId, studentId),
        gt(feedback.rewardXp, 0),
        isNotNull(feedback.confirmedAt),
      ),
    );
  return rows.filter((r) => r.at && weekStartOf(localDate(r.at)) === week).length;
}

export async function bugHunterSummary(db: Database, studentId: string) {
  return {
    confirmedBugs: await confirmedBugCount(db, studentId),
    rewardXp: await bugRewardXp(db, studentId),
  };
}
