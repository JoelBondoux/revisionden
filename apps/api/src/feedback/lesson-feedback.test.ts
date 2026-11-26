import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { items } from '@revisionden/db';
import { syncContent } from '../learning/content-sync';
import { createTestContext, jsonRequest, type TestContext } from '../test/helpers';
import { testItems, testTopicTree } from '../test/learning-fixtures';
import { FEEDBACK_PER_DAY } from './routes';

// The one-tap "Did this help?" after an interactive lesson (W8): an item, no text, not counted
// against the daily feedback limit, and shown to parents and the operator like other feedback.
let t: TestContext;
let itemId: string;

beforeEach(async () => {
  t = await createTestContext({ config: { operatorEmails: ['operator@example.com'] } });
  await syncContent(t.db, { topicTrees: [testTopicTree], items: testItems });
  const [row] = await t.db.select().from(items).where(eq(items.contentId, 'test-mc-0001'));
  itemId = row!.id;
});

afterEach(async () => {
  await t.close();
});

const send = (headers: Record<string, string>, body: unknown) =>
  t.app.request('/v1/student/feedback', jsonRequest('POST', body, headers));

describe('lesson feedback', () => {
  it('stores "it helped" with the item and shows it in the student list', async () => {
    const { headers } = await t.familyStudent('tap_kid');
    const res = await send(headers, { kind: 'lesson_helped', itemId });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ kind: 'lesson_helped', itemId, text: null });
  });

  it('refuses text with a lesson tap, and an item with other kinds', async () => {
    const { headers } = await t.familyStudent('tap_text');
    expect((await send(headers, { kind: 'lesson_not_helped', itemId, text: 'meh' })).status).toBe(
      400,
    );
    expect((await send(headers, { kind: 'lesson_helped' })).status).toBe(400);
    expect((await send(headers, { kind: 'idea', text: 'More', itemId })).status).toBe(400);
  });

  it('refuses an item that does not exist', async () => {
    const { headers } = await t.familyStudent('tap_missing');
    const res = await send(headers, {
      kind: 'lesson_helped',
      itemId: '00000000-0000-4000-8000-000000000000',
    });
    expect(res.status).toBe(404);
  });

  it('keeps one answer per item, changing it if the student taps the other button', async () => {
    const { headers } = await t.familyStudent('tap_twice');
    await send(headers, { kind: 'lesson_helped', itemId });
    const again = await send(headers, { kind: 'lesson_not_helped', itemId });
    expect(again.status).toBe(201);
    const list = await t.app.request('/v1/student/feedback', { headers });
    const body = (await list.json()) as { feedback: { kind: string }[] };
    expect(body.feedback.map((f) => f.kind)).toEqual(['lesson_not_helped']);
  });

  it('updates the first answer in place, so overlapping taps cannot leave two (Codex P2)', async () => {
    const { headers } = await t.familyStudent('tap_upsert');
    const first = (await (await send(headers, { kind: 'lesson_helped', itemId })).json()) as {
      id: string;
    };
    const [a, b] = await Promise.all([
      send(headers, { kind: 'lesson_not_helped', itemId }),
      send(headers, { kind: 'lesson_helped', itemId }),
    ]);
    expect([a.status, b.status]).toEqual([201, 201]);
    const list = await t.app.request('/v1/student/feedback', { headers });
    const body = (await list.json()) as { feedback: { id: string; kind: string }[] };
    expect(body.feedback).toHaveLength(1);
    expect(body.feedback[0]!.id).toBe(first.id);
  });

  it('does not use up the daily feedback limit', async () => {
    const { headers } = await t.familyStudent('tap_limit');
    await send(headers, { kind: 'lesson_helped', itemId });
    for (let i = 0; i < FEEDBACK_PER_DAY; i++) {
      expect((await send(headers, { kind: 'idea', text: `Idea ${i}` })).status).toBe(201);
    }
  });

  it('the parent sees it in the family feedback like any other', async () => {
    const { headers, parent } = await t.familyStudent('tap_parent');
    await send(headers, { kind: 'lesson_helped', itemId });
    const res = await t.app.request('/v1/feedback', { headers: parent.headers });
    const body = (await res.json()) as { feedback: { kind: string }[] };
    expect(body.feedback.map((f) => f.kind)).toContain('lesson_helped');
  });
});
