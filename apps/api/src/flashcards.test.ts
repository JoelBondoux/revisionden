import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  DAY_MS,
  FlashcardReviewResponseSchema,
  FlashcardSchema,
  FlashcardsOverviewSchema,
  RELEARN_DELAY_MS,
  type Flashcard,
} from '@revisionden/core';
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

async function overview(headers: H) {
  const res = await t.app.request('/v1/student/flashcards', { headers });
  expect(res.status).toBe(200);
  return FlashcardsOverviewSchema.parse(await res.json());
}

function review(headers: H, id: string, rating: string) {
  return t.app.request(
    `/v1/student/flashcards/${id}/review`,
    jsonRequest('POST', { rating }, headers),
  );
}

const student = (nickname: string) => t.familyStudent(nickname, [TEST_SUBJECT]);
const byFront = (cards: Flashcard[], front: string) => cards.find((c) => c.front === front)!;

describe('flashcard decks', () => {
  it('needs a signed-in student device', async () => {
    expect((await t.app.request('/v1/student/flashcards')).status).toBe(401);
  });

  it('shows verified deck cards for enrolled subjects as due, with the spec reference', async () => {
    const { headers } = await student('deck_kid');
    const view = await overview(headers);
    const card = byFront(view.due, 'Test front 1');
    expect(card).toMatchObject({
      origin: 'deck',
      back: 'Test back 1',
      topicTitle: 'Test topic A',
      subjectId: TEST_SUBJECT,
      sourceRef: 'Test specification reference T1',
      draft: false,
    });
    expect(card.nextReviewMs).toEqual({
      again: RELEARN_DELAY_MS,
      hard: DAY_MS,
      good: DAY_MS,
      easy: DAY_MS,
    });
    expect(view.decks).toContainEqual({
      topicId: 'test-topic-a',
      title: 'Test topic A',
      subjectId: TEST_SUBJECT,
      total: 1,
      due: 1,
    });
    expect(view.draftContent).toBe(false);
  });

  it('never shows draft deck cards with the flag off', async () => {
    const { headers } = await student('deck_gate_kid');
    expect(JSON.stringify(await overview(headers))).not.toContain('Draft front 1');
  });

  it('shows no deck cards for subjects the student is not enrolled in', async () => {
    const { headers } = await t.familyStudent('not_enrolled_kid');
    const view = await overview(headers);
    expect(view.due).toEqual([]);
    expect(view.decks).toEqual([]);
  });

  it('lists one deck’s cards', async () => {
    const { headers } = await student('one_deck_kid');
    const res = await t.app.request('/v1/student/flashcards/decks/test-topic-a', { headers });
    const cards = FlashcardSchema.array().parse(await res.json());
    expect(cards.map((c) => c.front)).toEqual(['Test front 1']);
  });
});

describe('reviewing cards', () => {
  it('schedules the card with SM-2 and earns 2 XP', async () => {
    const { headers } = await student('review_kid');
    const card = byFront((await overview(headers)).due, 'Test front 1');
    const res = await review(headers, card.id, 'good');
    expect(res.status).toBe(200);
    const body = FlashcardReviewResponseSchema.parse(await res.json());
    expect(body).toMatchObject({ xpEarned: 2, comesBackSooner: false });
    expect(Date.parse(body.card.dueAt)).toBe(t.clock.now().getTime() + DAY_MS);
    expect(body.progress.xpToday).toBe(2);
    expect((await overview(headers)).due.map((c) => c.front)).not.toContain('Test front 1');
  });

  it('brings a card rated Again back within 10 minutes', async () => {
    const { headers } = await student('again_kid');
    const card = byFront((await overview(headers)).due, 'Test front 1');
    const body = FlashcardReviewResponseSchema.parse(
      await (await review(headers, card.id, 'again')).json(),
    );
    expect(body.comesBackSooner).toBe(true);
    expect(Date.parse(body.card.dueAt)).toBe(t.clock.now().getTime() + RELEARN_DELAY_MS);
  });

  it('rejects an unknown rating', async () => {
    const { headers } = await student('rating_kid');
    const card = (await overview(headers)).due[0]!;
    expect((await review(headers, card.id, 'perfect')).status).toBe(400);
  });

  it('keeps each student’s cards to themselves', async () => {
    const owner = await student('card_owner');
    const other = await student('card_other');
    const card = (await overview(owner.headers)).due[0]!;
    expect((await review(other.headers, card.id, 'good')).status).toBe(404);
    expect((await review(other.headers, 'not-an-id', 'good')).status).toBe(404);
  });
});

describe('wrong answers and the student’s own cards', () => {
  it('turns a wrong lesson answer into a due flashcard', async () => {
    const { headers } = await student('wrong_card_kid');
    const res = await t.app.request('/v1/student/learn/lesson?topicId=test-topic-a&count=20', {
      headers,
    });
    const { items } = (await res.json()) as { items: { id: string; prompt?: string }[] };
    const mc = items.find((i) => i.prompt === 'Test question 1')!;
    await t.app.request(
      '/v1/student/learn/attempts',
      jsonRequest('POST', { itemId: mc.id, answer: 0, timeMs: 1, mode: 'learn' }, headers),
    );
    const card = byFront((await overview(headers)).due, 'Test question 1');
    expect(card).toMatchObject({ origin: 'wrong_answer', back: 'Option B' });
  });

  it('lets a student add their own card to a topic', async () => {
    const { headers } = await student('own_kid');
    const res = await t.app.request(
      '/v1/student/flashcards',
      jsonRequest('POST', { topicId: 'test-topic-b', front: 'My front', back: 'My back' }, headers),
    );
    expect(res.status).toBe(201);
    const card = FlashcardSchema.parse(await res.json());
    expect(card).toMatchObject({ origin: 'own', front: 'My front', topicTitle: 'Test topic B' });
    expect(card.sourceRef).toBeUndefined();
    const view = await overview(headers);
    expect(view.mine.map((c) => c.id)).toEqual([card.id]);
    expect(view.due.map((c) => c.id)).toContain(card.id);
  });

  it('refuses a card for a topic that does not exist', async () => {
    const { headers } = await student('own_bad_kid');
    const res = await t.app.request(
      '/v1/student/flashcards',
      jsonRequest('POST', { topicId: 'nope', front: 'f', back: 'b' }, headers),
    );
    expect(res.status).toBe(404);
  });
});
