import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { flashcardSessions } from '@revisionden/db';
import { claimFinish, rewardedLeftToday, takeRewardSlot } from './learning/flashcard-sessions';
import { createTestContext, type TestContext } from './test/helpers';

let t: TestContext;

beforeAll(async () => {
  t = await createTestContext();
});

afterAll(async () => {
  await t.close();
});

async function openSession(studentId: string) {
  const [row] = await t.db
    .insert(flashcardSessions)
    .values({ studentId, startedAt: t.clock.now() })
    .returning({ id: flashcardSessions.id });
  return row!.id;
}

describe('flashcard session claims (F3)', () => {
  it('lets only the first finish claim a session', async () => {
    const { studentId } = await t.familyStudent('claim_kid');
    const id = await openSession(studentId);
    const now = t.clock.now();
    const [first, second] = await Promise.all([
      claimFinish(t.db, id, true, now),
      claimFinish(t.db, id, true, now),
    ]);
    expect([first, second].filter(Boolean)).toHaveLength(1);
  });

  it('gives racing sessions different reward slots, and nothing once both are taken', async () => {
    const { studentId } = await t.familyStudent('slot_kid');
    const ids = [await openSession(studentId), await openSession(studentId)];
    const third = await openSession(studentId);
    const now = t.clock.now();
    const paid = await Promise.all(ids.map((id) => takeRewardSlot(t.db, studentId, id, now)));
    expect(paid).toEqual([20, 20]);
    expect(await takeRewardSlot(t.db, studentId, third, now)).toBe(0);
    expect(await rewardedLeftToday(t.db, studentId, now)).toBe(0);
    const rows = await t.db
      .select({ slot: flashcardSessions.rewardSlot, xp: flashcardSessions.xpEarned })
      .from(flashcardSessions)
      .where(eq(flashcardSessions.studentId, studentId));
    expect(rows.map((r) => r.slot).sort()).toEqual([1, 2, null]);
    expect(rows.reduce((sum, r) => sum + r.xp, 0)).toBe(40);
  });
});
