import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DailySetResponseSchema } from '@revisionden/core';
import { syncContent } from './learning/content-sync';
import { createTestContext, jsonRequest, type TestContext } from './test/helpers';
import { TEST_SUBJECT, testItems, testTopicTree } from './test/learning-fixtures';

type H = Record<string, string>;

let t: TestContext;

beforeAll(async () => {
  t = await createTestContext();
  await syncContent(t.db, { topicTrees: [testTopicTree], items: testItems });
});

afterAll(async () => {
  await t.close();
});

async function daily(headers: H) {
  const res = await t.app.request('/v1/student/daily', { headers });
  expect(res.status).toBe(200);
  return DailySetResponseSchema.parse(await res.json());
}

async function lessonItems(headers: H, topicId: string) {
  const res = await t.app.request(`/v1/student/learn/lesson?topicId=${topicId}&count=20`, {
    headers,
  });
  return ((await res.json()) as { items: { id: string; type: string; prompt?: string }[] }).items;
}

async function answer(headers: H, itemId: string, value: unknown) {
  const res = await t.app.request(
    '/v1/student/learn/attempts',
    jsonRequest('POST', { itemId, answer: value, timeMs: 1000, mode: 'learn' }, headers),
  );
  expect(res.status).toBe(200);
}

/** A wrong-but-valid answer for any item type the daily set can hold. */
function anyAnswer(type: string): unknown {
  if (type === 'multiple_choice') return 0;
  if (type === 'numeric') return '0';
  if (type === 'worked_maths') return { lines: ['x = 0'] };
  if (type === 'flashcard') return true;
  return 'not it';
}

describe('daily 5-a-day (Q3)', () => {
  it('needs a signed-in student device', async () => {
    expect((await t.app.request('/v1/student/daily')).status).toBe(401);
  });

  it('is empty until the student has practised a topic', async () => {
    const { headers } = await t.familyStudent('daily_new', [TEST_SUBJECT]);
    expect(await daily(headers)).toMatchObject({ items: [], total: 0, done: false });
  });

  it('only uses practised topics, keeps the same set all day, and is done when all are answered', async () => {
    const { headers } = await t.familyStudent('daily_kid', [TEST_SUBJECT]);
    const topicA = await lessonItems(headers, 'test-topic-a');
    const mc = topicA.find((i) => i.type === 'multiple_choice')!;
    await answer(headers, mc.id, 1);

    const first = await daily(headers);
    expect(first.total).toBeGreaterThan(0);
    expect(first.total).toBeLessThanOrEqual(5);
    expect(new Set(first.items.map((i) => i.topicId))).toEqual(new Set(['test-topic-a']));
    expect(first.items.map((i) => i.type)).not.toContain('extended_answer');
    expect(first).toMatchObject({ answered: 0, done: false, day: '2026-11-24' });

    const again = await daily(headers);
    expect(again.items.map((i) => i.id)).toEqual(first.items.map((i) => i.id));

    t.clock.advance(60_000);
    for (const item of first.items) await answer(headers, item.id, anyAnswer(item.type));
    expect(await daily(headers)).toMatchObject({ answered: first.total, done: true });
  });

  it('makes a new set the next day', async () => {
    const { headers, studentId } = await t.familyStudent('daily_next', [TEST_SUBJECT]);
    const topicA = await lessonItems(headers, 'test-topic-a');
    await answer(headers, topicA.find((i) => i.type === 'multiple_choice')!.id, 1);
    const today = await daily(headers);
    t.clock.advance(24 * 60 * 60 * 1000);
    const tomorrow = await daily(await t.signInStudent(studentId));
    expect(tomorrow.day).not.toBe(today.day);
    expect(tomorrow.answered).toBe(0);
  });
});

describe('family data export (Q3)', () => {
  it("includes each child's 5-a-day sets", async () => {
    const { headers, parent } = await t.familyStudent('daily_export', [TEST_SUBJECT]);
    const topicA = await lessonItems(headers, 'test-topic-a');
    await answer(headers, topicA.find((i) => i.type === 'multiple_choice')!.id, 1);
    const set = await daily(headers);
    const res = await t.app.request('/v1/export', { headers: parent.headers });
    expect(res.status).toBe(200);
    const body = JSON.stringify(await res.json());
    expect(body).toContain('"dailySets"');
    expect(body).toContain(set.items[0]!.id);
  });
});
