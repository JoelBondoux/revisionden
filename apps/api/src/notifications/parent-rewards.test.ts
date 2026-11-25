import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  parentPushSubscriptions,
  parentRewards,
  parents,
  reminderLog,
  reminderSettings,
  rewards,
} from '@revisionden/db';
import { createTestContext, type TestContext } from '../test/helpers';
import { runParentRewardNotifications } from './parent-rewards';
import type { PushResult, PushTarget } from './web-push';

let ctx: TestContext;
beforeEach(async () => {
  ctx = await createTestContext();
});
afterEach(async () => ctx.close());

function fakeSender(result: PushResult = 'sent') {
  const sent: PushTarget[] = [];
  return { sent, send: async (t: PushTarget) => (sent.push(t), result) };
}

// Thursday 15 January 2026, 18:00 in London (UTC in winter): outside every quiet window.
const EVENING = new Date('2026-01-15T18:00:00Z');

/** A family with one child, a parent device with push on, and one parent-set reward. */
async function familyWithReward(
  opts: { reached?: boolean; given?: boolean; parentDevice?: boolean } = {},
) {
  const { studentId, parent } = await ctx.familyStudent('test_kid');
  const [row] = await ctx.db.select().from(parents).where(eq(parents.authUserId, parent.userId));
  if (opts.parentDevice ?? true) {
    await ctx.db.insert(parentPushSubscriptions).values({
      parentId: row!.id,
      endpoint: `https://push.example.com/parent/${row!.id}`,
      p256dh: 'p',
      auth: 'a',
    });
  }
  const [reward] = await ctx.db
    .insert(parentRewards)
    .values({
      studentId,
      title: 'Cinema trip',
      targetKind: 'stat',
      stat: 'level',
      // Every child is level 1 from the start; level 99 is not reached.
      atLeast: (opts.reached ?? true) ? 1 : 99,
      givenAt: opts.given ? new Date('2026-01-10T12:00:00Z') : null,
    })
    .returning();
  return { studentId, parentId: row!.id, reward: reward! };
}

async function notifiedAt(id: string) {
  const [row] = await ctx.db.select().from(parentRewards).where(eq(parentRewards.id, id));
  return row!.reachedNotifiedAt;
}

describe('parent reward notifications', () => {
  it('tells every parent device once when a parent-set target is met', async () => {
    const f = await familyWithReward();
    const sender = fakeSender();
    const summary = await runParentRewardNotifications({ db: ctx.db, now: EVENING, sender });
    expect(summary).toEqual({ rewards: 1, pushes: 1, removed: 0 });
    expect(sender.sent.map((t) => t.endpoint)).toEqual([
      `https://push.example.com/parent/${f.parentId}`,
    ]);
    expect(await notifiedAt(f.reward.id)).toEqual(EVENING);

    const again = fakeSender();
    const later = new Date('2026-01-15T19:00:00Z');
    expect(await runParentRewardNotifications({ db: ctx.db, now: later, sender: again })).toEqual({
      rewards: 0,
      pushes: 0,
      removed: 0,
    });
    expect(again.sent).toHaveLength(0);
  });

  it('says nothing about targets not met yet or rewards already given', async () => {
    const notYet = await familyWithReward({ reached: false });
    const given = await familyWithReward({ given: true });
    const sender = fakeSender();
    expect((await runParentRewardNotifications({ db: ctx.db, now: EVENING, sender })).rewards).toBe(
      0,
    );
    expect(await notifiedAt(notYet.reward.id)).toBeNull();
    expect(await notifiedAt(given.reward.id)).toBeNull();
  });

  it('waits for the end of the nightly quiet hours set for the child', async () => {
    const f = await familyWithReward();
    await ctx.db
      .insert(reminderSettings)
      .values({ studentId: f.studentId, quietStart: '17:00', quietEnd: '07:30' });
    const night = fakeSender();
    await runParentRewardNotifications({ db: ctx.db, now: EVENING, sender: night });
    expect(night.sent).toHaveLength(0);
    expect(await notifiedAt(f.reward.id)).toBeNull();

    const morning = new Date('2026-01-16T08:00:00Z');
    const sender = fakeSender();
    await runParentRewardNotifications({ db: ctx.db, now: morning, sender });
    expect(sender.sent).toHaveLength(1);
  });

  it("ignores the child's school-hours window and their reminder switch (the parent is not at school)", async () => {
    const f = await familyWithReward();
    await ctx.db.insert(reminderSettings).values({ studentId: f.studentId, enabled: false });
    // Thursday 11:00, inside the default weekday 08:30–15:30 window.
    const schoolTime = new Date('2026-01-15T11:00:00Z');
    const sender = fakeSender();
    await runParentRewardNotifications({ db: ctx.db, now: schoolTime, sender });
    expect(sender.sent).toHaveLength(1);
  });

  it('does not count towards the child reminders or use up their new rewards', async () => {
    const f = await familyWithReward();
    await runParentRewardNotifications({ db: ctx.db, now: EVENING, sender: fakeSender() });
    expect(await ctx.db.select().from(reminderLog)).toHaveLength(0);
    expect(
      await ctx.db.select().from(rewards).where(eq(rewards.studentId, f.studentId)),
    ).toHaveLength(0);
  });

  it('keeps the news for later when no parent device has notifications on', async () => {
    const f = await familyWithReward({ parentDevice: false });
    const summary = await runParentRewardNotifications({
      db: ctx.db,
      now: EVENING,
      sender: fakeSender(),
    });
    expect(summary.rewards).toBe(0);
    expect(await notifiedAt(f.reward.id)).toBeNull();
  });

  it('removes parent subscriptions the push service says are gone', async () => {
    const f = await familyWithReward();
    const summary = await runParentRewardNotifications({
      db: ctx.db,
      now: EVENING,
      sender: fakeSender('gone'),
    });
    expect(summary).toEqual({ rewards: 1, pushes: 0, removed: 1 });
    const left = await ctx.db
      .select()
      .from(parentPushSubscriptions)
      .where(eq(parentPushSubscriptions.parentId, f.parentId));
    expect(left).toHaveLength(0);
  });
});
