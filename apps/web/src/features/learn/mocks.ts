/**
 * Mock learning API (MSW) for development and tests. The items are made-up placeholders, not
 * educational content, and are marked as drafts so the "DRAFT CONTENT" banner shows.
 */
import { http, HttpResponse, type RequestHandler } from 'msw';
import {
  CreateFlashcardRequestSchema,
  DAY_MS,
  FlashcardReviewRequestSchema,
  LearnAttemptRequestSchema,
  RELEARN_DELAY_MS,
  type Flashcard,
  type LearnItem,
  type Progress,
} from '@revisionden/core';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const topic = { topicId: 'demo-topic-a', topicTitle: 'Demo topic A', draft: true };
const topicB = { topicId: 'demo-topic-b', topicTitle: 'Demo topic B', draft: true };

export const DEMO_SUBJECT = 'gcse-maths';

export const demoItems: LearnItem[] = [
  {
    ...topic,
    id: id(1),
    type: 'multiple_choice',
    prompt: 'Demo question 1',
    options: ['Option A', 'Option B', 'Option C'],
  },
  { ...topic, id: id(2), type: 'short_answer', prompt: 'Demo question 2' },
  { ...topicB, id: id(3), type: 'numeric', prompt: 'Demo question 3', unit: 'cm' },
  { ...topicB, id: id(4), type: 'worked_maths', prompt: 'Demo question 4' },
  { ...topic, id: id(5), type: 'flashcard', front: 'Demo front 1', back: 'Demo back 1' },
  { ...topicB, id: id(6), type: 'extended_answer', prompt: 'Demo question 6' },
];

const keys: Record<string, { answer: unknown; display: string; xp: number }> = {
  [id(1)]: { answer: 1, display: 'Option B', xp: 10 },
  [id(2)]: { answer: 'demo answer', display: 'demo answer', xp: 15 },
  [id(3)]: { answer: '4', display: '4 cm', xp: 15 },
  [id(4)]: { answer: 'x=2', display: 'x = 2', xp: 20 },
  [id(5)]: { answer: true, display: 'Demo back 1', xp: 5 },
};

const nextReviewMs = { again: RELEARN_DELAY_MS, hard: DAY_MS, good: DAY_MS, easy: 4 * DAY_MS };

function card(n: number, front: string, back: string, origin: Flashcard['origin']): Flashcard {
  return {
    id: id(100 + n),
    topicId: 'demo-topic-a',
    topicTitle: 'Demo topic A',
    subjectId: DEMO_SUBJECT,
    origin,
    front,
    back,
    ...(origin === 'own' ? {} : { sourceRef: 'Demo spec reference 1' }),
    draft: origin !== 'own',
    dueAt: '2026-11-24T10:00:00.000Z',
    nextReviewMs,
  };
}

interface State {
  sessionCards: string[];
  xpToday: number;
  totalXp: number;
  streak: number;
  mine: Flashcard[];
  ownCount: number;
}

const fresh = (): State => ({
  xpToday: 30,
  totalXp: 230,
  streak: 4,
  mine: [],
  ownCount: 0,
  sessionCards: [],
});
let state = fresh();

/** Puts the mock back to its starting point (called after each test). */
export function resetLearnMocks() {
  state = fresh();
}

function progress(): Progress {
  return {
    xpToday: state.xpToday,
    totalXp: state.totalXp,
    dailyGoalXp: 50,
    goalMet: state.xpToday >= 50,
    streak: { current: state.streak, best: 9, skipDays: 1 },
  };
}

function earn(xp: number) {
  const before = state.xpToday;
  state.xpToday += xp;
  state.totalXp += xp;
  if (before < 50 && state.xpToday >= 50) state.streak += 1;
}

const squash = (v: unknown) => String(v).replace(/\s+/g, '').toLowerCase();

function marks(itemId: string, answer: unknown): boolean {
  const key = keys[itemId]!;
  if (typeof answer === 'object' && answer !== null && 'lines' in answer) {
    const lines = (answer as { lines: string[] }).lines;
    return squash(lines[lines.length - 1]) === key.answer;
  }
  return typeof key.answer === 'string'
    ? squash(answer) === squash(key.answer)
    : answer === key.answer;
}

const deckCards = () => [
  card(1, 'Demo front 1', 'Demo back 1', 'deck'),
  card(2, 'Demo front 2', 'Demo back 2', 'wrong_answer'),
];

export const learnHandlers: RequestHandler[] = [
  http.get('*/v1/student/learn/lesson', () =>
    HttpResponse.json({ items: demoItems, draftContent: true }),
  ),

  http.get('*/v1/student/learn/command-words', () =>
    HttpResponse.json({ items: demoItems.slice(0, 1), draftContent: true }),
  ),

  http.get('*/v1/student/learn/progress', () => HttpResponse.json(progress())),

  http.get('*/v1/student/learn/subjects/:subjectId/topics', ({ params }) =>
    HttpResponse.json({
      subjectId: params.subjectId,
      startingTestDone: false,
      topics: [
        { topicId: 'demo-topic-a', title: 'Demo topic A', mastery: 72, items: 3 },
        { topicId: 'demo-topic-b', title: 'Demo topic B', mastery: 35, items: 3 },
      ],
    }),
  ),

  http.post('*/v1/student/learn/starting-tests', () =>
    HttpResponse.json(
      {
        id: id(900),
        subjectId: DEMO_SUBJECT,
        timeLimitSeconds: 300,
        items: demoItems.slice(0, 3),
        draftContent: true,
      },
      { status: 201 },
    ),
  ),

  http.post('*/v1/student/learn/starting-tests/:id/finish', ({ params }) =>
    HttpResponse.json({
      id: params.id,
      correct: 1,
      answered: 2,
      total: 3,
      topics: [
        { topicId: 'demo-topic-a', title: 'Demo topic A', mastery: 40 },
        { topicId: 'demo-topic-b', title: 'Demo topic B', mastery: 0 },
      ],
    }),
  ),

  http.post('*/v1/student/learn/attempts', async ({ request }) => {
    const body = LearnAttemptRequestSchema.safeParse(await request.json());
    if (!body.success || !keys[body.data.itemId]) return new HttpResponse(null, { status: 400 });
    const key = keys[body.data.itemId]!;
    const correct = marks(body.data.itemId, body.data.answer);
    const xpEarned = correct ? key.xp : 0;
    earn(xpEarned);
    const working = typeof body.data.answer === 'object' && body.data.answer !== null;
    return HttpResponse.json({
      id: id(500),
      itemId: body.data.itemId,
      correct,
      score: correct ? 1 : 0,
      xpEarned,
      createdAt: '2026-11-24T10:00:00.000Z',
      feedback:
        body.data.mode === 'test'
          ? null
          : {
              correctAnswer: key.display,
              explanation: 'Demo explanation',
              ...(working ? { firstWrongLine: correct ? null : 0 } : {}),
            },
      progress: progress(),
      flashcardAdded:
        !correct && body.data.mode === 'learn' && typeof body.data.answer !== 'boolean',
    });
  }),

  http.get('*/v1/student/flashcards', () => {
    const due = [...deckCards(), ...state.mine];
    return HttpResponse.json({
      due,
      decks: [
        {
          topicId: 'demo-topic-a',
          title: 'Demo topic A',
          subjectId: DEMO_SUBJECT,
          total: 2,
          due: 2,
        },
      ],
      mine: state.mine,
      draftContent: true,
    });
  }),

  http.get('*/v1/student/flashcards/decks/:topicId', () => HttpResponse.json(deckCards())),

  http.post('*/v1/student/flashcards/sessions', () => {
    state.sessionCards = [];
    return HttpResponse.json(
      { id: id(777), maxCards: 20, minCards: 5, xp: 20, rewardedLeftToday: 2 },
      { status: 201 },
    );
  }),

  http.post('*/v1/student/flashcards/:id/review', async ({ params, request }) => {
    const body = FlashcardReviewRequestSchema.safeParse(await request.json());
    if (!body.success) return new HttpResponse(null, { status: 400 });
    const reviewed = [...deckCards(), ...state.mine].find((c) => c.id === params.id)!;
    if (!state.sessionCards.includes(reviewed.id)) state.sessionCards.push(reviewed.id);
    return HttpResponse.json({
      card: reviewed,
      comesBackSooner: body.data.rating === 'again',
      cardsCounted: state.sessionCards.length,
    });
  }),

  // The demo deck is small, so a demo session always has too few cards to earn XP.
  http.post('*/v1/student/flashcards/sessions/:id/finish', () =>
    HttpResponse.json({
      completed: true,
      reason: 'too_few_cards',
      xpEarned: 0,
      cardsCounted: state.sessionCards.length,
      rewardedLeftToday: 2,
      progress: progress(),
    }),
  ),

  http.post('*/v1/student/flashcards', async ({ request }) => {
    const body = CreateFlashcardRequestSchema.safeParse(await request.json());
    if (!body.success) return new HttpResponse(null, { status: 400 });
    state.ownCount += 1;
    const created = { ...card(50 + state.ownCount, body.data.front, body.data.back, 'own') };
    state.mine = [...state.mine, created];
    return HttpResponse.json(created, { status: 201 });
  }),
];
