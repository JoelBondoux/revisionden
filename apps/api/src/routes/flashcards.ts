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
import { and, asc, eq, inArray, isNull, or, type SQL } from 'drizzle-orm';
import {
  CreateFlashcardRequestSchema,
  FLASHCARD_SESSION_MAX_CARDS,
  FLASHCARD_SESSION_MIN_CARDS,
  FLASHCARD_SESSION_XP,
  MAX_REWARDED_SESSIONS_PER_DAY,
  countCardInSession,
  sessionOutcome,
  FlashcardReviewRequestSchema,
  RATING_QUALITY,
  dueCards,
  previewReviews,
  reviewCard,
  type Card,
  type Flashcard,
  type FlashcardDeck,
} from '@revisionden/core';
import { enrolments, flashcardSessions, flashcards, items, topics } from '@revisionden/db';
import type { AppEnv } from '../context';
import { ApiError, notFound } from '../errors';
import { readJson } from '../http';
import { isId } from '../validation';
import { correctAnswerText, servableItem, type ItemRow } from '../learning/items';
import type { ItemBody } from '../learning/content-sync';
import { awardXp } from '../learning/progress';
import { rewardedLeftToday } from '../learning/flashcard-sessions';
import { containsPersonalData, familyProfiles, personalDetails } from '../feedback/routes';
import type { LearnDeps } from './learn';

type CardRow = typeof flashcards.$inferSelect;
type TopicRow = typeof topics.$inferSelect;
interface Loaded {
  card: CardRow;
  item: ItemRow | null;
  topic: TopicRow;
}

const toCard = (row: CardRow): Card => ({
  id: row.id,
  repetitions: row.repetitions,
  intervalDays: row.intervalDays,
  ease: row.ease,
  dueAt: row.dueAt.getTime(),
});

function cardText({ card, item }: Loaded): { front: string; back: string } {
  if (!item) return { front: card.front ?? '', back: card.back ?? '' };
  const body = item.body as ItemBody;
  if (item.type === 'flashcard') return { front: body.front ?? '', back: body.back ?? '' };
  return { front: body.prompt ?? '', back: correctAnswerText(item) };
}

export function toFlashcard(loaded: Loaded, now: Date): Flashcard {
  const { card, item, topic } = loaded;
  const preview = previewReviews(toCard(card), now.getTime());
  return {
    id: card.id,
    topicId: topic.id,
    topicTitle: topic.title,
    subjectId: topic.subjectId,
    origin: card.origin,
    ...cardText(loaded),
    ...(item?.sourceRef ? { sourceRef: item.sourceRef } : {}),
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

  /** The student's cards whose content may be served (own cards have no item). */
  async function loadCards(studentId: string, where?: SQL): Promise<Loaded[]> {
    return db
      .select({ card: flashcards, item: items, topic: topics })
      .from(flashcards)
      .innerJoin(topics, eq(topics.id, flashcards.topicId))
      .leftJoin(items, eq(items.id, flashcards.itemId))
      .where(
        and(eq(flashcards.studentId, studentId), or(isNull(flashcards.itemId), servable), where),
      )
      .orderBy(asc(flashcards.dueAt), asc(flashcards.createdAt));
  }

  /** Makes a row for each servable deck card in the student's subjects not yet seen. */
  async function addNewDeckCards(studentId: string, now: Date) {
    const subjects = await db
      .select({ subjectId: enrolments.subjectId })
      .from(enrolments)
      .where(eq(enrolments.studentId, studentId));
    if (subjects.length === 0) return;
    const deck = await db
      .select({ itemId: items.id, topicId: items.topicId })
      .from(items)
      .innerJoin(topics, eq(topics.id, items.topicId))
      .where(
        and(
          servable,
          eq(items.type, 'flashcard'),
          inArray(
            topics.subjectId,
            subjects.map((s) => s.subjectId),
          ),
        ),
      );
    if (deck.length === 0) return;
    await db
      .insert(flashcards)
      .values(deck.map((d) => ({ studentId, ...d, origin: 'deck' as const, dueAt: now })))
      .onConflictDoNothing();
  }

  app.get('/', async (c) => {
    const studentId = c.var.student.studentId;
    const now = clock.now();
    await addNewDeckCards(studentId, now);
    const loaded = await loadCards(studentId);
    const byId = new Map(loaded.map((l) => [l.card.id, l]));
    const due = dueCards(
      loaded.map((l) => toCard(l.card)),
      now.getTime(),
    ).map((card) => toFlashcard(byId.get(card.id)!, now));

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

  /** One of the student's sessions; 404 for someone else's, 409 once finished. */
  async function openSession(studentId: string, sessionId: string) {
    if (!isId(sessionId)) throw notFound();
    const [session] = await db
      .select()
      .from(flashcardSessions)
      .where(and(eq(flashcardSessions.id, sessionId), eq(flashcardSessions.studentId, studentId)));
    if (!session) throw notFound();
    if (session.finishedAt) {
      throw new ApiError(409, 'session_finished', 'That flashcard session has already finished');
    }
    return session;
  }

  app.post('/sessions', async (c) => {
    const studentId = c.var.student.studentId;
    const now = clock.now();
    const [session] = await db
      .insert(flashcardSessions)
      .values({ studentId, startedAt: now })
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
    const loaded = await loadCards(studentId);
    const dueLeft = dueCards(
      loaded.map((l) => toCard(l.card)),
      now.getTime(),
    ).length;
    const left = await rewardedLeftToday(db, studentId, now);
    const outcome = sessionOutcome({
      cardsCounted: session.cardIds.length,
      dueLeft,
      rewardedToday: MAX_REWARDED_SESSIONS_PER_DAY - left,
    });
    await db
      .update(flashcardSessions)
      .set({ finishedAt: now, completed: outcome.completed, xpEarned: outcome.xp })
      .where(eq(flashcardSessions.id, session.id));
    const progress = await awardXp(db, studentId, outcome.xp, now);
    return c.json({
      completed: outcome.completed,
      reason: outcome.reason,
      xpEarned: outcome.xp,
      cardsCounted: session.cardIds.length,
      rewardedLeftToday: outcome.xp > 0 ? left - 1 : left,
      progress,
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
