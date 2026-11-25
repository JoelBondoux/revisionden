/**
 * Flashcard routes for a signed-in student device, under /v1/student/flashcards.
 *
 * - Deck cards come from verified flashcard items in the student's enrolled subjects (plus
 *   drafts with the development flag on). A student's row is made the first time they look.
 * - Wrong answers in lessons become cards (see the learn routes).
 * - Students can add their own cards to a topic; like feedback, a card holding an email
 *   address, a UK phone number or a nickname from the family is refused.
 * - Reviews follow SM-2 from packages/core; each card reviewed earns 2 XP.
 */
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import {
  CreateFlashcardRequestSchema,
  DECK_REVIEW_XP,
  FlashcardReviewRequestSchema,
  RATING_QUALITY,
  dueCards,
  previewReviews,
  reviewCard,
  type Flashcard,
  type FlashcardDeck,
} from '@revisionden/core';
import { flashcards, topics } from '@revisionden/db';
import type { AppEnv } from '../context';
import { notFound } from '../errors';
import { readJson } from '../http';
import { isId } from '../validation';
import { correctAnswerText, servableItem } from '../learning/items';
import type { ItemBody } from '../learning/content-sync';
import { awardXp } from '../learning/progress';
import { creditableXp } from '../daily-limit/state';
import { flashcardStore, toCard, type Loaded } from '../learning/flashcard-store';
import { containsPersonalData, familyProfiles, personalDetails } from '../feedback/routes';
import type { LearnDeps } from './learn';

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

  const { loadCards, addNewDeckCards } = flashcardStore(db, servable);

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

  app.post('/:id/review', async (c) => {
    const studentId = c.var.student.studentId;
    const id = c.req.param('id');
    if (!isId(id)) throw notFound();
    const [loaded] = await loadCards(studentId, eq(flashcards.id, id));
    if (!loaded) throw notFound();
    const { rating } = await readJson(c, FlashcardReviewRequestSchema);
    const now = clock.now();
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
    // No XP past the daily limit (workstream K7).
    const xpEarned = await creditableXp(db, studentId, DECK_REVIEW_XP, now);
    const progress = await awardXp(db, studentId, xpEarned, now);
    return c.json({
      card: toFlashcard({ ...loaded, card: card! }, now),
      xpEarned,
      comesBackSooner: rating === 'again',
      progress,
    });
  });

  return app;
}
