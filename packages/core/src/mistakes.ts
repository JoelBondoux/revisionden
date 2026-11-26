/**
 * Learning from mistakes (workstream F5, docs/PRODUCT_RULES.md "Learning from mistakes").
 *
 * - In a lesson, a wrong answer brings back a similar question (another item on the same
 *   learning point) 2 to 4 questions later, or the same question at the end when there is no
 *   similar one, after a confidence question. At most one retry per point and 2 per lesson; a
 *   second miss steps down to an easier question. A lesson ends on a success.
 * - A right answer that took more than twice the expected time still scores, but its learning
 *   point is shaky.
 * - Across sessions, a learning point with a wrong or shaky answer comes back on a short ladder
 *   (next day, then 3 days, then 7 days), through the 5-a-day and lesson warm-ups. Each right
 *   answer on time (on or after the day it is due) climbs a rung; after the last rung it leaves
 *   the ladder. A wrong or slow answer starts it again from the next day; missed on 3 visits,
 *   it is parked for a week and flagged as worth a look with a teacher or parent.
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
  area_model: 60,
};

/** A right answer slower than this many times the expected time is shaky. */
export const SHAKY_FACTOR = 2;
export const MAX_RETRIES_PER_LESSON = 2;
/** A similar question comes back this many questions after the missed one (inclusive range). */
export const RETRY_GAP = { min: 2, max: 4 } as const;
export const RETRY_WEIGHT = 0.5;
/** Days until a missed learning point comes back, rung by rung. */
export const REVIEW_LADDER_DAYS = [1, 3, 7] as const;
/** A point missed on this many ladder visits is parked instead of coming back again and again. */
export const PARK_AFTER_MISSES = 3;
export const PARK_DAYS = 7;

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

/** Why a question is in the lesson queue, for questions added after a mistake. */
export type EntryReason = 'similar' | 'again' | 'easier' | 'confidence';

/** One question in a lesson's queue; added questions say why, and are never retried. */
export interface LessonEntry<T> {
  item: T;
  /**
   * 'similar': another question on a missed point; 'again': the same question at the end;
   * 'easier': an easier one after a second miss (a step down); 'confidence': one the student
   * has got right before, put before a retry and at the end after a wrong last answer.
   */
  reason?: EntryReason;
}

const isRetry = (e: LessonEntry<unknown>) => e.reason === 'similar' || e.reason === 'again';

export interface MissContext<T> {
  /** Another question on the same learning point (from the server), if any. */
  similar?: T | null;
  /** An easier question on the same topic, for a step down after a second miss. */
  easier?: T | null;
  /** A question the student has answered right before, to go before a retry. */
  confidence?: T | null;
  pointOf: (item: T) => string;
  /** Item identity (defaults to the item itself), to avoid adding one already in the lesson. */
  idOf?: (item: T) => unknown;
}

export interface MissPlan<T> {
  queue: LessonEntry<T>[];
  /** 'retry': the point comes back; 'stepDown': a second miss, easier help instead; 'none'. */
  outcome: 'retry' | 'stepDown' | 'none';
}

/**
 * The lesson queue after a wrong answer at `index` (owner guardrails, 2026-11-25):
 * - A learning point gets at most one retry a lesson, and a lesson at most 2.
 * - A second miss on a point (its retry, or another question on it) steps down instead: an
 *   easier question on the topic goes next (if there is one) and the point waits for another
 *   day on the review ladder.
 * - A retry is a similar question 2 to 4 questions later, else the same question at the end,
 *   with a confidence question just before it, so two hard questions never come back to back.
 */
export function planAfterMiss<T>(
  queue: readonly LessonEntry<T>[],
  index: number,
  ctx: MissContext<T>,
  rng: Rng,
): MissPlan<T> {
  const same = queue as LessonEntry<T>[];
  const entry = queue[index];
  if (!entry) return { queue: same, outcome: 'none' };
  const idOf = ctx.idOf ?? ((item: T) => item);
  const inLesson = (item: T) => queue.some((e) => idOf(e.item) === idOf(item));
  const point = ctx.pointOf(entry.item);
  const missedBefore =
    isRetry(entry) ||
    queue.some((e, i) => i !== index && isRetry(e) && ctx.pointOf(e.item) === point);
  if (missedBefore || entry.reason === 'easier') {
    if (!ctx.easier || inLesson(ctx.easier) || entry.reason === 'easier') {
      return { queue: same, outcome: entry.reason === 'easier' ? 'none' : 'stepDown' };
    }
    const next = [...queue];
    next.splice(index + 1, 0, { item: ctx.easier, reason: 'easier' });
    return { queue: next, outcome: 'stepDown' };
  }
  if (entry.reason === 'confidence' || queue.filter(isRetry).length >= MAX_RETRIES_PER_LESSON) {
    return { queue: same, outcome: 'none' };
  }
  const similar = ctx.similar && !inLesson(ctx.similar) ? ctx.similar : null;
  const retry: LessonEntry<T> = similar
    ? { item: similar, reason: 'similar' }
    : { item: entry.item, reason: 'again' };
  const confidence =
    ctx.confidence && !inLesson(ctx.confidence)
      ? [{ item: ctx.confidence, reason: 'confidence' as const }]
      : [];
  const next = [...queue];
  let at = next.length;
  if (similar) {
    const gap = RETRY_GAP.min + Math.floor(rng() * (RETRY_GAP.max - RETRY_GAP.min + 1));
    at = Math.min(index + 1 + gap, next.length);
  }
  // Never two retries back to back: without a confidence question between them, move past a
  // retry; if that is not possible, the point waits for the review ladder instead.
  const touches = (i: number) =>
    (i > 0 && isRetry(next[i - 1]!)) || (i < next.length && isRetry(next[i]!));
  if (confidence.length === 0) {
    while (touches(at) && at < next.length) at++;
    if (touches(at)) return { queue: same, outcome: 'none' };
  }
  next.splice(at, 0, ...confidence, retry);
  return { queue: next, outcome: 'retry' };
}

/** A lesson ends on a success: after a wrong last answer, one confidence question is added. */
export function endOnSuccess<T>(
  queue: readonly LessonEntry<T>[],
  lastCorrect: boolean,
  confidence: T | null | undefined,
): LessonEntry<T>[] {
  if (lastCorrect || !confidence || queue.at(-1)?.reason === 'confidence') {
    return queue as LessonEntry<T>[];
  }
  return [...queue, { item: confidence, reason: 'confidence' }];
}

/** Where a learning point stands on the review ladder. */
export interface ReviewPoint {
  /** Index into REVIEW_LADDER_DAYS of the gap that led to `dueDay`. */
  rung: number;
  /** The student's local day (YYYY-MM-DD) it comes back on. */
  dueDay: string;
  /** Ladder visits (answers on or after the due day) that were wrong or slow since last parked. */
  misses: number;
  /** Parked after PARK_AFTER_MISSES missed visits: "worth a look with a teacher or parent". */
  flagged: boolean;
}

export type ReviewOutcome = 'right' | 'wrong' | 'shaky';

/**
 * The ladder after an answer on a learning point (`today` is the student's local day). Returns
 * null when the point is not (or no longer) on the ladder, and the same point when nothing
 * changes (an answer before the point is due, such as the retry in the same lesson). A point
 * missed on PARK_AFTER_MISSES visits is parked for PARK_DAYS and flagged, instead of looping.
 */
export function reviewAfterAnswer(
  point: ReviewPoint | null,
  outcome: ReviewOutcome,
  today: string,
): ReviewPoint | null {
  const tomorrow = addDays(today, REVIEW_LADDER_DAYS[0]);
  if (!point) {
    return outcome === 'right' ? null : { rung: 0, dueDay: tomorrow, misses: 0, flagged: false };
  }
  if (today < point.dueDay) return point;
  if (outcome !== 'right') {
    const misses = point.misses + 1;
    if (misses >= PARK_AFTER_MISSES) {
      return { rung: 0, dueDay: addDays(today, PARK_DAYS), misses: 0, flagged: true };
    }
    return { ...point, rung: 0, dueDay: tomorrow, misses };
  }
  const rung = point.rung + 1;
  if (rung >= REVIEW_LADDER_DAYS.length) return null;
  return { ...point, rung, dueDay: addDays(today, REVIEW_LADDER_DAYS[rung]!) };
}

/** Points due on or before `today`, the most overdue first. */
export function dueReviewPoints<P extends ReviewPoint>(points: readonly P[], today: string): P[] {
  return points
    .filter((p) => p.dueDay <= today)
    .sort((a, b) => (a.dueDay < b.dueDay ? -1 : a.dueDay > b.dueDay ? 1 : 0));
}
