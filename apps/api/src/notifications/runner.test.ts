import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  attempts,
  items,
  plans,
  pushSubscriptions,
  reminderLog,
  reminderSettings,
  streaks,
  topics,
} from '@revisionden/db';
import { createTestContext, type TestContext } from '../test/helpers';
import { makeStudentWithDevice } from '../test/fixtures';
import { runReminders } from './runner';
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

// Thursday 15 January 2026, 19:05 in London (UTC in winter).
const EVENING = new Date('2026-01-15T19:05:00Z');

async function subscribedStudent(opts: { streak?: number; planToday?: boolean } = {}) {
  const s = await makeStudentWithDevice(ctx.db);
  await ctx.db.insert(pushSubscriptions).values({
    studentId: s.student.id,
    deviceId: s.device.id,
    endpoint: `https://push.example.com/${s.student.id}`,
    p256dh: 'p',
    auth: 'a',
  });
  if (opts.streak !== undefined) {
    await ctx.db.insert(streaks).values({ studentId: s.student.id, current: opts.streak });
  }
  if (opts.planToday) {
    await ctx.db.insert(plans).values({
      studentId: s.student.id,
      weekStart: '2026-01-12',
      sessions: [{ date: '2026-01-15', subjectId: 'gcse-maths', minutes: 20 }],
    });
  }
  return s;
}

describe('runReminders', () => {
  it('sends due reminders to every subscribed device and logs them', async () => {
    const s = await subscribedStudent({ streak: 3, planToday: true });
    const sender = fakeSender();
    const summary = await runReminders({ db: ctx.db, now: EVENING, sender });

    expect(summary).toEqual({ students: 1, reminders: 2, pushes: 2, removed: 0 });
    expect(sender.sent.map((t) => t.endpoint)).toEqual([
      `https://push.example.com/${s.student.id}`,
      `https://push.example.com/${s.student.id}`,
    ]);
    const log = await ctx.db
      .select()
      .from(reminderLog)
      .where(eq(reminderLog.studentId, s.student.id));
    expect(log.map((l) => l.kind).sort()).toEqual(['session', 'streak']);
    expect(log[0]!.localDate).toBe('2026-01-15');
  });

  it('does not repeat reminders on the next cron run the same day', async () => {
    await subscribedStudent({ streak: 3, planToday: true });
    await runReminders({ db: ctx.db, now: EVENING, sender: fakeSender() });
    const sender = fakeSender();
    const later = new Date('2026-01-15T20:00:00Z');
    expect((await runReminders({ db: ctx.db, now: later, sender })).reminders).toBe(0);
    expect(sender.sent).toHaveLength(0);
  });

  it('sends nothing to a student who has already practised today', async () => {
    const s = await subscribedStudent({ streak: 3, planToday: true });
    await ctx.db
      .insert(topics)
      .values({ id: 't1', subjectId: 'gcse-maths', board: 'pearson', title: 'T' });
    const [item] = await ctx.db
      .insert(items)
      .values({ topicId: 't1', type: 'flashcard', body: {}, answer: {} })
      .returning();
    await ctx.db.insert(attempts).values({
      studentId: s.student.id,
      itemId: item!.id,
      correct: true,
      createdAt: new Date('2026-01-15T08:00:00Z'),
    });
    const sender = fakeSender();
    expect((await runReminders({ db: ctx.db, now: EVENING, sender })).reminders).toBe(0);
  });

  it('respects the settings the parent saved', async () => {
    const s = await subscribedStudent({ streak: 3, planToday: true });
    await ctx.db.insert(reminderSettings).values({ studentId: s.student.id, enabled: false });
    expect((await runReminders({ db: ctx.db, now: EVENING, sender: fakeSender() })).reminders).toBe(
      0,
    );
  });

  it('ignores students with no push subscription', async () => {
    await makeStudentWithDevice(ctx.db);
    expect(await runReminders({ db: ctx.db, now: EVENING, sender: fakeSender() })).toEqual({
      students: 0,
      reminders: 0,
      pushes: 0,
      removed: 0,
    });
  });

  it('removes subscriptions the push service says are gone', async () => {
    const s = await subscribedStudent({ streak: 2 });
    const summary = await runReminders({ db: ctx.db, now: EVENING, sender: fakeSender('gone') });
    expect(summary).toMatchObject({ reminders: 1, pushes: 0, removed: 1 });
    const left = await ctx.db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.studentId, s.student.id));
    expect(left).toHaveLength(0);
  });
});
