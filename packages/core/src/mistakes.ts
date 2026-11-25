/**
 * Learning from mistakes (workstream F5, docs/PRODUCT_RULES.md "Learning from mistakes").
 *
 * - In a lesson, a wrong answer brings back a similar question (another item on the same
 *   learning point) 2 to 4 questions later, or the same question at the end when there is no
 *   similar one. At most 2 retries a lesson, and a retry is never retried.
 * - A right answer that took more than twice the expected time still scores, but its learning
 *   point is shaky.
 * - Across sessions, a learning point with a wrong or shaky answer comes back on a short ladder
 *   (next day, then 3 days, then 7 days), through the 5-a-day and lesson warm-ups. Each right
 *   answer on time (on or after the day it is due) climbs a rung; after the last rung it leaves
 *   the ladder. A wrong or slow answer starts it again from the next day.
 * - Retries count at half weight for topic mastery (they show learning, but are easier just
 *   after seeing the answer).
 */
import type { Rng } from './rng';
import type { ItemType } from './schemas';
import { addDays } from './stats';

/** Rough expected seconds per question type, used when an item has no expected time of its own. */
export const EXPECTED_SECONDS: Record<Exclude<ItemType, 'extended_answer'>, number> = {
  flashcard: 15,
  multiple_choice: 20,
  numeric: 40,
  short_answer: 45,
  worked_maths: 120,
};

/** A right answer slower than this many times the expected time is shaky. */
export const SHAKY_FACTOR = 2;
export const MAX_RETRIES_PER_LESSON = 2;
/** A similar question comes back this many questions after the missed one (inclusive range). */
export const RETRY_GAP = { min: 2, max: 4 } as const;
export const RETRY_WEIGHT = 0.5;
/** Days until a missed learning point comes back, rung by rung. */
export const REVIEW_LADDER_DAYS = [1, 3, 7] as const;

/** Expected seconds for an item, or null when it is never timed (long answers are not marked). */
export function expectedSeconds(type: ItemType, own?: number | null): number | null {
  if (type === 'extended_answer') return null;
  return own ?? EXPECTED_SECONDS[type];
}

export function isShaky(answer: {
  type: ItemType;
  correct: boolean;
  timeMs: number;
  expectedSeconds?: number | null;
}): boolean {
  const expected = expectedSeconds(answer.type, answer.expectedSeconds);
  if (!answer.correct || expected === null) return false;
  return answer.timeMs > SHAKY_FACTOR * expected * 1000;
}

/** The learning point an item tests: its own tag, or its topic until content is tagged finer. */
export function learningPointOf(item: { topicId: string; learningPoint?: string | null }): string {
  return item.learningPoint ?? item.topicId;
}

/** One question in a lesson's queue; retries are marked so they are never retried again. */
export interface LessonEntry<T> {
  item: T;
  /** 'similar': another question on the same point; 'again': the same question at the end. */
  retry?: 'similar' | 'again';
}

/**
 * The lesson queue after a wrong answer at `index`. A similar question goes 2 to 4 questions
 * later (at the end if the lesson is shorter); without one the same question goes at the end.
 * Returns the same queue when the lesson already has 2 retries or the missed one was a retry.
 */
export function insertRetry<T>(
  queue: readonly LessonEntry<T>[],
  index: number,
  retry: { item: T; similar: boolean },
  rng: Rng,
): LessonEntry<T>[] {
  const used = queue.filter((e) => e.retry).length;
  if (used >= MAX_RETRIES_PER_LESSON || queue[index]?.retry) return queue as LessonEntry<T>[];
  const next = [...queue];
  if (!retry.similar) {
    next.push({ item: retry.item, retry: 'again' });
    return next;
  }
  const gap = RETRY_GAP.min + Math.floor(rng() * (RETRY_GAP.max - RETRY_GAP.min + 1));
  next.splice(Math.min(index + 1 + gap, next.length), 0, { item: retry.item, retry: 'similar' });
  return next;
}

/** Where a learning point stands on the review ladder. */
export interface ReviewPoint {
  /** Index into REVIEW_LADDER_DAYS of the gap that led to `dueDay`. */
  rung: number;
  /** The student's local day (YYYY-MM-DD) it comes back on. */
  dueDay: string;
}

export type ReviewOutcome = 'right' | 'wrong' | 'shaky';

/**
 * The ladder after an answer on a learning point (`today` is the student's local day). Returns
 * null when the point is not (or no longer) on the ladder, and the same point when nothing
 * changes (a right answer before the point is due, such as the retry in the same lesson).
 */
export function reviewAfterAnswer(
  point: ReviewPoint | null,
  outcome: ReviewOutcome,
  today: string,
): ReviewPoint | null {
  if (outcome !== 'right') return { rung: 0, dueDay: addDays(today, REVIEW_LADDER_DAYS[0]) };
  if (!point) return null;
  if (today < point.dueDay) return point;
  const rung = point.rung + 1;
  if (rung >= REVIEW_LADDER_DAYS.length) return null;
  return { rung, dueDay: addDays(today, REVIEW_LADDER_DAYS[rung]!) };
}

/** Points due on or before `today`, the most overdue first. */
export function dueReviewPoints<P extends ReviewPoint>(points: readonly P[], today: string): P[] {
  return points
    .filter((p) => p.dueDay <= today)
    .sort((a, b) => (a.dueDay < b.dueDay ? -1 : a.dueDay > b.dueDay ? 1 : 0));
}
