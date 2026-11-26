import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FOUNDING_TESTER_ID, StudentRewardsResponseSchema } from '@revisionden/core';
import { attempts, flashcardSessions, items, rewards, topics } from '@revisionden/db';
import { eq } from 'drizzle-orm';
import { createTestContext, jsonRequest, type TestContext } from './test/helpers';

/**
 * Founding Tester (R5). The test clock starts at 2026-11-24T10:00Z. The 1.0 cut-off is set to
 * 09:00 that day, so it has passed; activity strictly before it counts, at or after it never does.
 */
const CUT_OFF = new Date('2026-11-24T09:00:00Z');
const contexts: TestContext[] = [];
const itemIds = new Map<TestContext, string>();

async function context(betaEndsAt?: Date) {
  const t = await createTestContext(betaEndsAt ? { config: { betaEndsAt } } : {});
  contexts.push(t);
  await t.db
    .insert(topics)
    .values({ id: 'ft-topic', subjectId: 'gcse-maths', board: 'aqa', title: 'T' });
  const [item] = await t.db
    .insert(items)
    .values({ topicId: 'ft-topic', type: 'multiple_choice', body: {}, answer: {} })
    .returning();
  itemIds.set(t, item!.id);
  return t;
}

async function answerAt(t: TestContext, studentId: string, at: string) {
  await t.db.insert(attempts).values({
    studentId,
    itemId: itemIds.get(t)!,
    correct: true,
    xpEarned: 10,
    createdAt: new Date(at),
  });
}

async function view(t: TestContext, headers: Record<string, string>) {
  const res = await t.app.request('/v1/student/rewards', { headers });
  expect(res.status).toBe(200);
  return StudentRewardsResponseSchema.parse(await res.json());
}

const earnedIds = (v: Awaited<ReturnType<typeof view>>) => v.newlyEarned.map((r) => r.id);

let passed: TestContext;

beforeAll(async () => {
  passed = await context(CUT_OFF);
});

afterAll(async () => {
  for (const t of contexts) await t.close();
});

describe('Founding Tester (R5)', () => {
  it('is announced as New! to a student who answered before the cut-off, then shows as earned', async () => {
    const { studentId, headers } = await passed.familyStudent('ft_early');
    await answerAt(passed, studentId, '2026-11-23T17:00:00Z');
    const first = await view(passed, headers);
    expect(earnedIds(first)).toContain(FOUNDING_TESTER_ID);
    expect(first.overview.special.map((c) => c.id)).toEqual([FOUNDING_TESTER_ID]);
  });

  it('is granted once: a second look neither repeats it nor stores it twice', async () => {
    const { studentId, headers } = await passed.familyStudent('ft_twice');
    await answerAt(passed, studentId, '2026-11-23T17:00:00Z');
    await view(passed, headers);
    expect(earnedIds(await view(passed, headers))).not.toContain(FOUNDING_TESTER_ID);
    const rows = await passed.db.select().from(rewards).where(eq(rewards.studentId, studentId));
    expect(rows.filter((r) => r.rewardId === FOUNDING_TESTER_ID)).toHaveLength(1);
  });

  it('counts a completed flashcard session before the cut-off', async () => {
    const { studentId, headers } = await passed.familyStudent('ft_cards');
    await passed.db.insert(flashcardSessions).values({
      studentId,
      completed: true,
      xpEarned: 20,
      finishedAt: new Date('2026-11-22T12:00:00Z'),
    });
    expect(earnedIds(await view(passed, headers))).toContain(FOUNDING_TESTER_ID);
  });

  it('does not go to an unused account', async () => {
    const { headers } = await passed.familyStudent('ft_unused');
    const v = await view(passed, headers);
    expect(earnedIds(v)).not.toContain(FOUNDING_TESTER_ID);
    expect(v.overview.special).toEqual([]);
  });

  it('does not go to activity only after the cut-off, or exactly at it', async () => {
    const late = await passed.familyStudent('ft_late');
    await answerAt(passed, late.studentId, '2026-11-24T09:30:00Z');
    expect(earnedIds(await view(passed, late.headers))).not.toContain(FOUNDING_TESTER_ID);
    const onTheDot = await passed.familyStudent('ft_dot');
    await answerAt(passed, onTheDot.studentId, CUT_OFF.toISOString());
    expect(earnedIds(await view(passed, onTheDot.headers))).not.toContain(FOUNDING_TESTER_ID);
  });

  it('goes to nobody while the cut-off is unset', async () => {
    const unset = await context();
    const { studentId, headers } = await unset.familyStudent('ft_unset');
    await answerAt(unset, studentId, '2026-11-23T17:00:00Z');
    expect(earnedIds(await view(unset, headers))).not.toContain(FOUNDING_TESTER_ID);
  });

  it('goes to nobody before the cut-off arrives, even with activity', async () => {
    const early = await context(new Date('2026-12-01T00:00:00Z'));
    const { studentId, headers } = await early.familyStudent('ft_soon');
    await answerAt(early, studentId, '2026-11-23T17:00:00Z');
    expect(earnedIds(await view(early, headers))).not.toContain(FOUNDING_TESTER_ID);
  });

  it('unlocks the "Founding Tester" title, which can be worn and taken off like any other', async () => {
    const { studentId, headers } = await passed.familyStudent('ft_title');
    await answerAt(passed, studentId, '2026-11-23T17:00:00Z');
    await view(passed, headers);
    const put = (body: unknown) =>
      passed.app.request('/v1/student/rewards/title', jsonRequest('PUT', body, headers));
    const wear = await put({ first: 'Founding', last: 'Tester' });
    expect(wear.status).toBe(200);
    expect(((await wear.json()) as { title: string }).title).toBe('Founding Tester');
    const off = await put({ first: null, last: null });
    expect(((await off.json()) as { title: string | null }).title).toBeNull();
  });
});
