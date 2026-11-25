import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  DAY_MS,
  FlashcardReviewResponseSchema,
  FlashcardSessionResultSchema,
  FlashcardSessionSchema,
  FlashcardSchema,
  FlashcardsOverviewSchema,
  RELEARN_DELAY_MS,
  type Flashcard,
} from '@revisionden/core';
import { streaks } from '@revisionden/db';
import { syncContent } from './learning/content-sync';
import { flashcardSessionStats } from './learning/flashcard-sessions';
import { AVATAR, createTestContext, jsonRequest, type TestContext } from './test/helpers';
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

async function startSession(headers: H, topicId?: string): Promise<string> {
  const res = await t.app.request(
    '/v1/student/flashcards/sessions',
    topicId ? jsonRequest('POST', { topicId }, headers) : { method: 'POST', headers },
  );
  expect(res.status).toBe(201);
  return FlashcardSessionSchema.parse(await res.json()).id;
}

function review(headers: H, id: string, rating: string, sessionId: string) {
  return t.app.request(
    `/v1/student/flashcards/${id}/review`,
    jsonRequest('POST', { rating, sessionId }, headers),
  );
}

function finish(headers: H, sessionId: string) {
  return t.app.request(`/v1/student/flashcards/sessions/${sessionId}/finish`, {
    method: 'POST',
    headers,
  });
}

async function finished(headers: H, sessionId: string) {
  const res = await finish(headers, sessionId);
  expect(res.status).toBe(200);
  return FlashcardSessionResultSchema.parse(await res.json());
}

async function addOwnCards(headers: H, n: number, prefix: string) {
  for (let i = 1; i <= n; i++) {
    await t.app.request(
      '/v1/student/flashcards',
      jsonRequest(
        'POST',
        { topicId: 'test-topic-b', front: `${prefix} ${i}`, back: 'Back' },
        headers,
      ),
    );
  }
}

/** Reviews every card due now, in one session, rating each Good. */
async function reviewAllDue(headers: H, sessionId: string) {
  for (const card of (await overview(headers)).due) {
    await review(headers, card.id, 'good', sessionId);
  }
}

async function xpToday(headers: H) {
  const res = await t.app.request('/v1/student/learn/progress', { headers });
  return ((await res.json()) as { xpToday: number }).xpToday;
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

describe('reviewing cards in a session', () => {
  it('starts a session with the rules for this student today', async () => {
    const { headers } = await student('session_kid');
    const res = await t.app.request('/v1/student/flashcards/sessions', { method: 'POST', headers });
    expect(res.status).toBe(201);
    expect(FlashcardSessionSchema.parse(await res.json())).toMatchObject({
      maxCards: 20,
      minCards: 5,
      xp: 20,
      rewardedLeftToday: 2,
    });
  });

  it('schedules the card with SM-2 and earns no XP per card', async () => {
    const { headers } = await student('review_kid');
    const sessionId = await startSession(headers);
    const card = byFront((await overview(headers)).due, 'Test front 1');
    const res = await review(headers, card.id, 'good', sessionId);
    expect(res.status).toBe(200);
    const body = FlashcardReviewResponseSchema.parse(await res.json());
    expect(body).toMatchObject({ comesBackSooner: false, cardsCounted: 1 });
    expect(Date.parse(body.card.dueAt)).toBe(t.clock.now().getTime() + DAY_MS);
    expect(await xpToday(headers)).toBe(0);
    expect((await overview(headers)).due.map((c) => c.front)).not.toContain('Test front 1');
  });

  it('brings a card rated Again back within 10 minutes, counted once in the session', async () => {
    const { headers } = await student('again_kid');
    const sessionId = await startSession(headers);
    const card = byFront((await overview(headers)).due, 'Test front 1');
    const body = FlashcardReviewResponseSchema.parse(
      await (await review(headers, card.id, 'again', sessionId)).json(),
    );
    expect(body.comesBackSooner).toBe(true);
    expect(Date.parse(body.card.dueAt)).toBe(t.clock.now().getTime() + RELEARN_DELAY_MS);
    const again = FlashcardReviewResponseSchema.parse(
      await (await review(headers, card.id, 'good', sessionId)).json(),
    );
    expect(again.cardsCounted).toBe(1);
  });

  it('pays 20 XP for a completed session of 5 or more cards, whatever the ratings', async () => {
    const { headers, studentId } = await student('xp_kid');
    await addOwnCards(headers, 5, 'Mine');
    const sessionId = await startSession(headers);
    const due = (await overview(headers)).due;
    expect(due).toHaveLength(6);
    for (const [i, card] of due.entries()) {
      await review(headers, card.id, i % 2 === 0 ? 'hard' : 'easy', sessionId);
    }
    const result = await finished(headers, sessionId);
    expect(result).toMatchObject({
      completed: true,
      reason: 'rewarded',
      xpEarned: 20,
      cardsCounted: 6,
      rewardedLeftToday: 1,
    });
    expect(result.progress.xpToday).toBe(20);
    const rewards = (await (await t.app.request('/v1/student/rewards', { headers })).json()) as {
      overview: { level: { totalXp: number } };
    };
    expect(rewards.overview.level.totalXp).toBe(20);
    // The "flashcards reviewed" milestones count cards in completed sessions.
    expect(await flashcardSessionStats(t.db, studentId)).toMatchObject({ cardsReviewed: 6 });
  });

  it('pays nothing for fewer than 5 cards', async () => {
    const { headers } = await student('few_kid');
    const sessionId = await startSession(headers);
    await reviewAllDue(headers, sessionId);
    expect(await finished(headers, sessionId)).toMatchObject({
      completed: true,
      reason: 'too_few_cards',
      xpEarned: 0,
      cardsCounted: 1,
    });
  });

  it('pays nothing for leaving early', async () => {
    const { headers, studentId } = await student('early_kid');
    await addOwnCards(headers, 6, 'Early');
    const sessionId = await startSession(headers);
    for (const card of (await overview(headers)).due.slice(0, 5)) {
      await review(headers, card.id, 'good', sessionId);
    }
    expect(await finished(headers, sessionId)).toMatchObject({
      completed: false,
      reason: 'left_early',
      xpEarned: 0,
      cardsCounted: 5,
    });
    expect(await xpToday(headers)).toBe(0);
    expect(await flashcardSessionStats(t.db, studentId)).toEqual({
      cardsReviewed: 0,
      xpEvents: [],
    });
  });

  it('completes after 20 cards even with more still due', async () => {
    const { headers } = await student('twenty_kid');
    await addOwnCards(headers, 22, 'Many');
    const sessionId = await startSession(headers);
    await reviewAllDue(headers, sessionId);
    expect(await finished(headers, sessionId)).toMatchObject({
      completed: true,
      reason: 'rewarded',
      cardsCounted: 20,
    });
  });

  it('rewards at most 2 sessions a day, and resets the next day', async () => {
    const { headers: first, studentId } = await student('limit_kid');
    let headers = first;
    const results = [];
    for (const round of [1, 2, 3]) {
      await addOwnCards(headers, 5, `Round ${round}`);
      const sessionId = await startSession(headers);
      await reviewAllDue(headers, sessionId);
      results.push(await finished(headers, sessionId));
    }
    expect(results.map((r) => [r.reason, r.xpEarned, r.rewardedLeftToday])).toEqual([
      ['rewarded', 20, 1],
      ['rewarded', 20, 0],
      ['daily_limit', 0, 0],
    ]);
    t.clock.advance(24 * 60 * 60 * 1000);
    headers = await t.signInStudent(studentId);
    const res = await t.app.request('/v1/student/flashcards/sessions', { method: 'POST', headers });
    expect(FlashcardSessionSchema.parse(await res.json()).rewardedLeftToday).toBe(2);
  });

  it('completes a one-deck session when that deck is done, even with other decks due', async () => {
    const { headers } = await student('deck_scope_kid');
    await addOwnCards(headers, 5, 'Deck B');
    const sessionId = await startSession(headers, 'test-topic-b');
    const all = (await overview(headers)).due;
    const deckB = all.filter((c) => c.topicId === 'test-topic-b');
    expect(deckB).toHaveLength(5);
    expect(all.length).toBeGreaterThan(deckB.length);
    for (const card of deckB) await review(headers, card.id, 'good', sessionId);
    expect(await finished(headers, sessionId)).toMatchObject({ reason: 'rewarded', xpEarned: 20 });
  });

  it('refuses a session for a deck the student does not have', async () => {
    const { headers } = await student('deck_none_kid');
    const res = await t.app.request(
      '/v1/student/flashcards/sessions',
      jsonRequest('POST', { topicId: 'no-such-topic' }, headers),
    );
    expect(res.status).toBe(404);
  });

  it('pays a session once when it is finished twice at the same time', async () => {
    const { headers } = await student('twice_kid');
    await addOwnCards(headers, 5, 'Twice');
    const sessionId = await startSession(headers);
    await reviewAllDue(headers, sessionId);
    const statuses = (await Promise.all([finish(headers, sessionId), finish(headers, sessionId)]))
      .map((r) => r.status)
      .sort();
    expect(statuses).toEqual([200, 409]);
    expect(await xpToday(headers)).toBe(20);
  });

  it('keeps the daily limit when several sessions finish at the same time', async () => {
    const { headers } = await student('rush_kid');
    const sessions: string[] = [];
    for (const round of [1, 2, 3]) {
      await addOwnCards(headers, 5, `Rush ${round}`);
      const sessionId = await startSession(headers);
      await reviewAllDue(headers, sessionId);
      sessions.push(sessionId);
    }
    const results = await Promise.all(sessions.map((id) => finished(headers, id)));
    expect(results.map((r) => r.xpEarned).sort()).toEqual([0, 20, 20]);
    expect(results.find((r) => r.xpEarned === 0)!.reason).toBe('daily_limit');
    expect(await xpToday(headers)).toBe(40);
  });

  it('refuses reviews and finishes on a finished or someone else’s session', async () => {
    const owner = await student('sess_owner');
    const other = await student('sess_other');
    const sessionId = await startSession(owner.headers);
    const card = (await overview(owner.headers)).due[0]!;
    expect((await finish(other.headers, sessionId)).status).toBe(404);
    expect((await review(owner.headers, card.id, 'good', crypto.randomUUID())).status).toBe(404);
    await finished(owner.headers, sessionId);
    expect((await finish(owner.headers, sessionId)).status).toBe(409);
    expect((await review(owner.headers, card.id, 'good', sessionId)).status).toBe(409);
    expect((await finish(owner.headers, 'not-an-id')).status).toBe(404);
  });

  it('rejects an unknown rating or a missing session', async () => {
    const { headers } = await student('rating_kid');
    const sessionId = await startSession(headers);
    const card = (await overview(headers)).due[0]!;
    expect((await review(headers, card.id, 'perfect', sessionId)).status).toBe(400);
    const noSession = await t.app.request(
      `/v1/student/flashcards/${card.id}/review`,
      jsonRequest('POST', { rating: 'good' }, headers),
    );
    expect(noSession.status).toBe(400);
  });

  it('keeps each student’s cards to themselves', async () => {
    const owner = await student('card_owner');
    const other = await student('card_other');
    const card = (await overview(owner.headers)).due[0]!;
    const sessionId = await startSession(other.headers);
    expect((await review(other.headers, card.id, 'good', sessionId)).status).toBe(404);
    expect((await review(other.headers, 'not-an-id', 'good', sessionId)).status).toBe(404);
  });
});

describe('rewards earned by a flashcard session', () => {
  it('returns rewards the finished session earned, once each', async () => {
    const { headers, studentId } = await student('rw_session_kid');
    await t.db.insert(streaks).values({ studentId, current: 8, best: 8 });
    const first = await finished(headers, await startSession(headers));
    expect(first.newlyEarned.map((r) => r.id)).toContain('streak-7');
    const second = await finished(headers, await startSession(headers));
    expect(second.newlyEarned).toEqual([]);
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

  it.each([
    ['an email address', { front: 'Ask me at someone@example.com', back: 'ok' }],
    ['a UK mobile number', { front: 'Sine rule', back: 'text 07700 900123' }],
    ['their own nickname', { front: 'Who made this', back: 'card_kid_a did' }],
    ['a brother or sister’s nickname', { front: 'Quiz card_kid_b on this', back: 'ok' }],
  ])('refuses an own card that holds %s, and saves nothing', async (what, sides) => {
    const { headers, parent } = await t.familyStudent(`card_kid_a`, [TEST_SUBJECT]);
    void what;
    await t.app.request(
      '/v1/students',
      jsonRequest(
        'POST',
        { nickname: 'card_kid_b', avatarCode: AVATAR, yearGroup: 9 },
        parent.headers,
      ),
    );
    const res = await t.app.request(
      '/v1/student/flashcards',
      jsonRequest('POST', { topicId: 'test-topic-b', ...sides }, headers),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: 'personal_details' } });
    expect((await overview(headers)).mine).toEqual([]);
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
