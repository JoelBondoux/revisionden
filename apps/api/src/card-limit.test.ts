import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CardsDueSchema,
  DAILY_CARD_LIMIT,
  FlashcardSessionSchema,
  FlashcardsOverviewSchema,
} from '@revisionden/core';
import { syncContent, type ContentItem, type ContentTopicTree } from './learning/content-sync';
import { createTestContext, jsonRequest, type TestContext } from './test/helpers';
import { testItems } from './test/learning-fixtures';

type H = Record<string, string>;

/** Made-up flashcards (not educational): 25 in one deck, so the daily limit of 20 applies. */
const SUBJECT = 'cap-subject';
const card = testItems.find((i) => i.id === 'test-card-0001')!;
const tree: ContentTopicTree = {
  id: 'cap-tree',
  subject: SUBJECT,
  board: 'test-board',
  topics: [
    {
      id: 'cap-unit',
      title: 'Cap unit',
      children: [{ id: 'cap-topic', title: 'Cap topic', spec_ref: ['C1'], citations: [] }],
    },
  ],
};
const content: ContentItem[] = Array.from({ length: 25 }, (_, n) => ({
  ...card,
  id: `cap-card-${n}`,
  topic: 'cap-topic',
  front: `Cap front ${n}`,
  back: `Cap back ${n}`,
}));

let t: TestContext;

beforeAll(async () => {
  t = await createTestContext();
  await syncContent(t.db, { topicTrees: [tree], items: content });
});

afterAll(async () => {
  await t.close();
});

async function overview(headers: H, query = '') {
  const res = await t.app.request(`/v1/student/flashcards${query}`, { headers });
  expect(res.status).toBe(200);
  return FlashcardsOverviewSchema.parse(await res.json());
}

async function dueBadge(headers: H) {
  const res = await t.app.request('/v1/student/cards/due', { headers });
  return CardsDueSchema.parse(await res.json()).due;
}

async function review(headers: H, ids: string[]) {
  const res = await t.app.request(
    '/v1/student/flashcards/sessions',
    jsonRequest('POST', {}, headers),
  );
  const session = FlashcardSessionSchema.parse(await res.json()).id;
  for (const id of ids) {
    const r = await t.app.request(
      `/v1/student/flashcards/${id}/review`,
      jsonRequest('POST', { rating: 'good', sessionId: session }, headers),
    );
    expect(r.status).toBe(200);
  }
}

describe('daily flashcard limit (F11, owner)', () => {
  it('shows at most 20 cards to review today, never the whole backlog', async () => {
    const { headers } = await t.familyStudent('cap_show', [SUBJECT]);
    const body = await overview(headers);
    expect(DAILY_CARD_LIMIT).toBe(20);
    expect(body.due).toHaveLength(20);
    expect(body).toMatchObject({ dueToday: 20, backlog: 25, doneToday: false });
    expect(await dueBadge(headers)).toBe(20);
    // Browsing All decks is not limited.
    expect(body.decks[0]).toMatchObject({ total: 25, due: 25 });
  });

  it('counts down as cards are reviewed, then is done for today', async () => {
    const { headers } = await t.familyStudent('cap_done', [SUBJECT]);
    const first = await overview(headers);
    await review(
      headers,
      first.due.slice(0, 5).map((c) => c.id),
    );
    expect(await dueBadge(headers)).toBe(15);
    await review(
      headers,
      (await overview(headers)).due.map((c) => c.id),
    );
    const after = await overview(headers);
    expect(after).toMatchObject({ dueToday: 0, backlog: 5, doneToday: true });
    expect(after.due).toEqual([]);
    expect(await dueBadge(headers)).toBe(0);
  });

  it('gives 10 more on request, and the rest roll to tomorrow', async () => {
    const { headers, studentId } = await t.familyStudent('cap_more', [SUBJECT]);
    await review(
      headers,
      (await overview(headers)).due.map((c) => c.id),
    );
    const more = await overview(headers, '?extra=10');
    expect(more.due).toHaveLength(5);
    expect(more.dueToday).toBe(5);
    t.clock.advance(24 * 60 * 60 * 1000);
    const tomorrow = await overview(await t.signInStudent(studentId));
    // The 5 held back are still due, first in line; nothing was lost.
    expect(tomorrow.backlog).toBeGreaterThanOrEqual(5);
    expect(tomorrow.dueToday).toBe(Math.min(20, tomorrow.backlog!));
  });
});
