/**
 * Flashcard routes for a signed-in student device, under /v1/student/flashcards.
 *
 * - Deck cards come from verified flashcard items in the student's enrolled subjects (plus
 *   drafts with the development flag on). A student's row is made the first time they look.
 * - Wrong answers in lessons become cards (see the learn routes).
 * - Students can add their own cards to a topic; like feedback, a card holding an email
 *   address, a UK phone number or a nickname from the family is refused.
 * - Reviews follow SM-2 from packages/core and happen in a session. XP is per completed session
 *   (20 XP for 5+ cards, at most 2 a day), never per card (packages/core flashcard-session.ts).
 */
import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import {
  CreateFlashcardRequestSchema,
  FLASHCARD_SESSION_MAX_CARDS,
  FLASHCARD_SESSION_MIN_CARDS,
  FLASHCARD_SESSION_XP,
  MAX_REWARDED_SESSIONS_PER_DAY,
  countCardInSession,
  sessionOutcome,
  FlashcardReviewRequestSchema,
  FlashcardSessionRequestSchema,
  RATING_QUALITY,
  dueCards,
  explainSteps,
  previewReviews,
  reviewCard,
  type Flashcard,
  type FlashcardDeck,
} from '@revisionden/core';
import { flashcardSessions, flashcards, topics } from '@revisionden/db';
import { saveNewRewards } from './rewards';
import type { AppEnv } from '../context';
import { ApiError, notFound } from '../errors';
import { readJson } from '../http';
import { isId } from '../validation';
import { correctAnswerText, servableItem } from '../learning/items';
import type { ItemAnswer, ItemBody } from '../learning/content-sync';
import { creditableXp } from '../daily-limit/state';
import { awardXp } from '../learning/progress';
import { todaysCards } from '../learning/card-limit';
import { claimFinish, rewardedLeftToday, takeRewardSlot } from '../learning/flashcard-sessions';
import { flashcardStore, toCard, type Loaded } from '../learning/flashcard-store';
import { containsPersonalData, familyProfiles, personalDetails } from '../feedback/routes';
import type { LearnDeps } from './learn';

function cardText({ card, item }: Loaded): { front: string; back: string } {
  if (!item) return { front: card.front ?? '', back: card.back ?? '' };
  const body = item.body as ItemBody;
  if (item.type === 'flashcard') return { front: body.front ?? '', back: body.back ?? '' };
  return { front: body.prompt ?? '', back: correctAnswerText(item) };
}

/** Explain steps from the item's verified content (none for the student's own cards). */
function explainOf({ item }: Loaded, back: string): { explain?: string[] } {
  if (!item) return {};
  const answer = (item.answer ?? {}) as ItemAnswer;
  const steps = explainSteps({
    steps: answer.steps,
    markScheme: answer.markScheme,
    backFormula: answer.backFormula,
    explanation: answer.explanation,
    answer: back,
  });
  return steps.length > 0 ? { explain: steps } : {};
}

export function toFlashcard(loaded: Loaded, now: Date): Flashcard {
  const { card, item, topic } = loaded;
  const preview = previewReviews(toCard(card), now.getTime());
  const text = cardText(loaded);
  return {
    id: card.id,
    topicId: topic.id,
    topicTitle: topic.title,
    subjectId: topic.subjectId,
    origin: card.origin,
    ...text,
    ...explainOf(loaded, text.back),
    ...(item?.sourceRef ? { sourceRef: item.sourceRef } : {}),
    ...(item?.contentId ? { contentId: item.contentId } : {}),
    ...(item?.learningPoint ? { learningPoint: item.learningPoint } : {}),
    draft: item !== null && item.status !== 'verified',
    dueAt: card.dueAt.toISOString(),
    nextReviewMs: {
      again: Math.round(preview.again),
      hard: Math.round(preview.hard),
      good: Math.round(preview.good),
      easy: Math.round(preview.easy),
    },
  };
}

export function flashcardRoutes({ db, clock, config }: LearnDeps) {
  const app = new Hono<AppEnv>();
  const servable = servableItem(config.serveDraftContent);

  const { loadCards, addNewDeckCards } = flashcardStore(db, servable);

  app.get('/', async (c) => {
    const studentId = c.var.student.studentId;
    const now = clock.now();
    await addNewDeckCards(studentId, now);
    const loaded = await loadCards(studentId);
    // Daily limit (F11): today's most useful cards, 20 a day, plus "10 more" on request.
    const extra = Math.min(Math.max(Number(c.req.query('extra') ?? 0) || 0, 0), 100);
    const today = await todaysCards(db, studentId, loaded, now, extra);
    const due = today.due.map((l) => toFlashcard(l, now));

    const decks = new Map<string, FlashcardDeck>();
    for (const { card, topic } of loaded) {
      const deck = decks.get(topic.id) ?? {
        topicId: topic.id,
        title: topic.title,
        subjectId: topic.subjectId,
        total: 0,
        due: 0,
      };
      deck.total += 1;
      if (card.dueAt <= now) deck.due += 1;
      decks.set(topic.id, deck);
    }
    const all = [...due, ...loaded.map((l) => toFlashcard(l, now))];
    return c.json({
      due,
      decks: [...decks.values()].sort((a, b) => a.title.localeCompare(b.title)),
      mine: loaded.filter((l) => l.card.origin === 'own').map((l) => toFlashcard(l, now)),
      draftContent: all.some((card) => card.draft),
      dueToday: due.length,
      backlog: today.backlog,
      doneToday: today.doneToday,
    });
  });

  app.get('/decks/:topicId', async (c) => {
    const now = clock.now();
    await addNewDeckCards(c.var.student.studentId, now);
    const loaded = await loadCards(
      c.var.student.studentId,
      eq(flashcards.topicId, c.req.param('topicId')),
    );
    return c.json(loaded.map((l) => toFlashcard(l, now)));
  });

  app.post('/', async (c) => {
    const input = await readJson(c, CreateFlashcardRequestSchema);
    // The same personal-details check as feedback: emails, phone numbers, family nicknames.
    const profiles = await familyProfiles(db, c.var.student.familyId);
    if (containsPersonalData(`${input.front}\n${input.back}`, profiles)) throw personalDetails();
    const [topic] = await db.select().from(topics).where(eq(topics.id, input.topicId));
    if (!topic) throw notFound('No such topic');
    const now = clock.now();
    const [card] = await db
      .insert(flashcards)
      .values({
        studentId: c.var.student.studentId,
        topicId: topic.id,
        origin: 'own',
        front: input.front.trim(),
        back: input.back.trim(),
        dueAt: now,
        createdAt: now,
      })
      .returning();
    return c.json(toFlashcard({ card: card!, item: null, topic }, now), 201);
  });

  const sessionFinished = () =>
    new ApiError(409, 'session_finished', 'That flashcard session has already finished');

  /** One of the student's sessions; 404 for someone else's, 409 once finished. */
  async function openSession(studentId: string, sessionId: string) {
    if (!isId(sessionId)) throw notFound();
    const [session] = await db
      .select()
      .from(flashcardSessions)
      .where(and(eq(flashcardSessions.id, sessionId), eq(flashcardSessions.studentId, studentId)));
    if (!session) throw notFound();
    if (session.finishedAt) throw sessionFinished();
    return session;
  }

  app.post('/sessions', async (c) => {
    const studentId = c.var.student.studentId;
    const now = clock.now();
    const { topicId, extra } = c.req.header('content-type')?.includes('json')
      ? await readJson(c, FlashcardSessionRequestSchema)
      : {};
    if (topicId) {
      const [card] = await db
        .select({ id: flashcards.id })
        .from(flashcards)
        .where(and(eq(flashcards.studentId, studentId), eq(flashcards.topicId, topicId)))
        .limit(1);
      if (!card) throw notFound('No such deck');
    }
    const [session] = await db
      .insert(flashcardSessions)
      .values({ studentId, startedAt: now, topicId: topicId ?? null, extraCards: extra ?? 0 })
      .returning({ id: flashcardSessions.id });
    return c.json(
      {
        id: session!.id,
        maxCards: FLASHCARD_SESSION_MAX_CARDS,
        minCards: FLASHCARD_SESSION_MIN_CARDS,
        xp: FLASHCARD_SESSION_XP,
        rewardedLeftToday: await rewardedLeftToday(db, studentId, now),
      },
      201,
    );
  });

  app.post('/sessions/:id/finish', async (c) => {
    const studentId = c.var.student.studentId;
    const session = await openSession(studentId, c.req.param('id'));
    const now = clock.now();
    // A one-deck session is complete when that deck has nothing left due.
    const loaded = await loadCards(
      studentId,
      session.topicId ? eq(flashcards.topicId, session.topicId) : undefined,
    );
    // An all-decks session is complete when today's offered cards are done: the daily 20 plus
    // any "10 more" (F11b), not the whole backlog, which rolls over to tomorrow.
    const dueLeft = session.topicId
      ? dueCards(
          loaded.map((l) => toCard(l.card)),
          now.getTime(),
        ).length
      : (await todaysCards(db, studentId, loaded, now, session.extraCards)).due.length;
    const outcome = sessionOutcome({
      cardsCounted: session.cardIds.length,
      dueLeft,
      rewardedToday: MAX_REWARDED_SESSIONS_PER_DAY - (await rewardedLeftToday(db, studentId, now)),
    });
    if (!(await claimFinish(db, session.id, outcome.completed, now))) throw sessionFinished();
    // No XP past the daily limit (workstream K7): the reward slot is kept for another day.
    const allowed = outcome.xp > 0 ? await creditableXp(db, studentId, outcome.xp, now) : 0;
    const xp = allowed > 0 ? await takeRewardSlot(db, studentId, session.id, now) : 0;
    const progress = await awardXp(db, studentId, xp, now);
    return c.json({
      completed: outcome.completed,
      reason: outcome.xp > 0 && xp === 0 ? 'daily_limit' : outcome.reason,
      xpEarned: xp,
      cardsCounted: session.cardIds.length,
      rewardedLeftToday: await rewardedLeftToday(db, studentId, now),
      progress,
      newlyEarned: await saveNewRewards(db, studentId, now, { betaEndsAt: config.betaEndsAt }),
    });
  });

  app.post('/:id/review', async (c) => {
    const studentId = c.var.student.studentId;
    const id = c.req.param('id');
    if (!isId(id)) throw notFound();
    const { rating, sessionId } = await readJson(c, FlashcardReviewRequestSchema);
    const session = await openSession(studentId, sessionId);
    const [loaded] = await loadCards(studentId, eq(flashcards.id, id));
    if (!loaded) throw notFound();
    const now = clock.now();
    // Self-ratings schedule the card only: they never change mastery or XP (XP is per session).
    const next = reviewCard(toCard(loaded.card), RATING_QUALITY[rating], now.getTime());
    const [card] = await db
      .update(flashcards)
      .set({
        repetitions: next.repetitions,
        intervalDays: next.intervalDays,
        ease: next.ease,
        dueAt: new Date(next.dueAt),
        lastReviewedAt: now,
      })
      .where(eq(flashcards.id, id))
      .returning();
    const cardIds = countCardInSession(session.cardIds, id);
    await db.update(flashcardSessions).set({ cardIds }).where(eq(flashcardSessions.id, session.id));
    return c.json({
      card: toFlashcard({ ...loaded, card: card! }, now),
      comesBackSooner: rating === 'again',
      cardsCounted: cardIds.length,
    });
  });

  return app;
}
