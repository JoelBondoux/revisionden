/**
 * Today's review cards under the daily limit (F11, owner; rules in packages/core/src/card-limit.ts).
 * Reviewed today = distinct cards whose last review was today (UK date). The parent stats do not
 * show a flashcard backlog today; `backlog` is returned for a future parent view.
 */
import { and, eq } from 'drizzle-orm';
import { WEAK_SPOT_THRESHOLD, cardsLeftToday, localDate, pickTodaysCards } from '@revisionden/core';
import { mastery, type Database } from '@revisionden/db';
import { toCard, type Loaded } from './flashcard-store';

export async function todaysCards(
  db: Database,
  studentId: string,
  loaded: readonly Loaded[],
  now: Date,
  extra = 0,
) {
  const today = localDate(now);
  const reviewedToday = loaded.filter(
    (l) => l.card.lastReviewedAt && localDate(l.card.lastReviewedAt) === today,
  ).length;
  const weak = new Set(
    (
      await db
        .select({ topicId: mastery.topicId, value: mastery.value })
        .from(mastery)
        .where(and(eq(mastery.studentId, studentId)))
    )
      .filter((m) => Math.round(m.value * 100) < WEAK_SPOT_THRESHOLD)
      .map((m) => m.topicId),
  );
  const nowMs = now.getTime();
  const backlog = loaded.filter((l) => l.card.dueAt.getTime() <= nowMs).length;
  const left = cardsLeftToday(reviewedToday, extra);
  const byId = new Map(loaded.map((l) => [l.card.id, l]));
  const picked = pickTodaysCards(
    loaded.map((l) => ({
      card: toCard(l.card),
      weakSpot: weak.has(l.card.topicId),
      ...(l.card.origin === 'wrong_answer' ? { wrongAnswerAt: l.card.createdAt.getTime() } : {}),
    })),
    nowMs,
    left,
  ).map((c) => byId.get(c.id)!);
  return { due: picked, backlog, reviewedToday, doneToday: backlog > 0 && picked.length === 0 };
}
