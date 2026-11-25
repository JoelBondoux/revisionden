import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LessonResponseSchema } from '@revisionden/core';
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

async function recall(headers: H, topicId: string) {
  const res = await t.app.request(`/v1/student/recall?topicId=${topicId}`, { headers });
  expect(res.status).toBe(200);
  return LessonResponseSchema.parse(await res.json());
}

async function lessonItems(headers: H, topicId: string) {
  const res = await t.app.request(`/v1/student/learn/lesson?topicId=${topicId}&count=20`, {
    headers,
  });
  return LessonResponseSchema.parse(await res.json()).items;
}

async function answer(headers: H, itemId: string, value: unknown) {
  const res = await t.app.request(
    '/v1/student/learn/attempts',
    jsonRequest('POST', { itemId, answer: value, timeMs: 1000, mode: 'learn' }, headers),
  );
  expect(res.status).toBe(200);
}

describe('recall checks (Q4)', () => {
  it('need a signed-in student device and a topic', async () => {
    expect((await t.app.request('/v1/student/recall?topicId=test-topic-a')).status).toBe(401);
    const { headers } = await t.familyStudent('recall_q', [TEST_SUBJECT]);
    expect((await t.app.request('/v1/student/recall', { headers })).status).toBe(400);
  });

  it('are empty for a topic never practised', async () => {
    const { headers } = await t.familyStudent('recall_new', [TEST_SUBJECT]);
    expect((await recall(headers, 'test-topic-a')).items).toEqual([]);
  });

  it('ask about questions answered in earlier lessons, other topics first', async () => {
    const { headers } = await t.familyStudent('recall_kid', [TEST_SUBJECT]);
    const a = await lessonItems(headers, 'test-topic-a');
    const b = await lessonItems(headers, 'test-topic-b');
    await answer(headers, a.find((i) => i.type === 'short_answer')!.id, 'nope');
    const numeric = b.find((i) => i.type === 'numeric')!;
    await answer(headers, numeric.id, '0');

    const body = await recall(headers, 'test-topic-a');
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.length).toBeLessThanOrEqual(2);
    expect(body.items[0]!.id).toBe(numeric.id);
    expect(body.items.map((i) => i.type)).not.toContain('flashcard');
  });

  it('work for a unit challenge (the unit is practised through its topics)', async () => {
    const { headers } = await t.familyStudent('recall_unit', [TEST_SUBJECT]);
    const a = await lessonItems(headers, 'test-topic-a');
    await answer(headers, a.find((i) => i.type === 'short_answer')!.id, 'nope');
    expect((await recall(headers, 'test-unit')).items.length).toBeGreaterThan(0);
  });
});
