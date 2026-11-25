/**
 * Learning loop rules (workstream F; see docs/PRODUCT_RULES.md "Learning loop").
 *
 * - Content gate: only `verified` items reach students. Drafts are served only when the
 *   development flag is on; quarantined and retired items never are (docs/VERIFICATION.md).
 * - Marking for exact item types (multiple choice, short answer, numeric). Maths working is
 *   checked by the maths engine, not here.
 * - Flashcard buttons (Again, Hard, Good, Easy) map onto SM-2 review quality.
 * - Starting test: about 5 minutes, one item per topic first, middle difficulty preferred.
 * - Daily goal and streak: a day counts once, the first time the goal is met.
 */
import type { Rng } from './rng';
import { DAY_MS, reviewCard, type Card } from './spaced-repetition';
import { recordDay, settleWeek, type StreakState } from './streaks';
import type { ItemType } from './schemas';

// ---------------------------------------------------------------------------------------------
// Content gate
// ---------------------------------------------------------------------------------------------

export type VerificationStatus = 'draft' | 'verified' | 'quarantined' | 'retired';

/** Statuses that may be served. Drafts only with the development flag on. */
export function servableStatuses(serveDrafts: boolean): VerificationStatus[] {
  return serveDrafts ? ['verified', 'draft'] : ['verified'];
}

export function isServable(status: string, serveDrafts: boolean): boolean {
  return (servableStatuses(serveDrafts) as string[]).includes(status);
}

// ---------------------------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------------------------

export interface MarkResult {
  correct: boolean;
  /** Fraction of marks, 0 to 1. */
  score: number;
}

const right: MarkResult = { correct: true, score: 1 };
const wrong: MarkResult = { correct: false, score: 0 };
const mark = (ok: boolean) => (ok ? right : wrong);

export const normaliseText = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');
const squash = (value: string) => value.replace(/\s+/g, '').toLowerCase();

export function markMultipleChoice(key: { option: number }, answer: unknown): MarkResult {
  return mark(answer === key.option);
}

export function markShortAnswer(key: { accepted: readonly string[] }, answer: unknown): MarkResult {
  if (typeof answer !== 'string') return wrong;
  const given = normaliseText(answer);
  return mark(key.accepted.some((a) => normaliseText(a) === given));
}

/** A plain decimal or a simple fraction such as `3/4`; anything else is not a number. */
function parseNumber(text: string): number | null {
  const value = text.replace(/\s+/g, '');
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  const fraction = /^(-?\d+)\/(\d+)$/.exec(value);
  if (fraction && Number(fraction[2]) !== 0) return Number(fraction[1]) / Number(fraction[2]);
  return null;
}

export function markNumeric(
  key: { value: string; tolerance?: number },
  answer: unknown,
): MarkResult {
  if (typeof answer !== 'string' || answer.trim() === '') return wrong;
  const expected = parseNumber(key.value);
  if (expected === null) return mark(squash(answer) === squash(key.value));
  const given = parseNumber(answer);
  if (given === null) return wrong;
  return mark(Math.abs(given - expected) <= (key.tolerance ?? 1e-9));
}

// ---------------------------------------------------------------------------------------------
// Flashcards
// ---------------------------------------------------------------------------------------------

export type FlashcardRating = 'again' | 'hard' | 'good' | 'easy';
export const FLASHCARD_RATINGS: readonly FlashcardRating[] = ['again', 'hard', 'good', 'easy'];

/** SM-2 quality for each button: Again fails the card; Hard, Good and Easy pass it. */
export const RATING_QUALITY: Record<FlashcardRating, number> = {
  again: 1,
  hard: 3,
  good: 4,
  easy: 5,
};

/** Milliseconds until the card comes back for each button, as the scheduler works it out. */
export function previewReviews(card: Card, now: number): Record<FlashcardRating, number> {
  const preview = {} as Record<FlashcardRating, number>;
  for (const rating of FLASHCARD_RATINGS) {
    preview[rating] = reviewCard(card, RATING_QUALITY[rating], now).dueAt - now;
  }
  return preview;
}

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;

/** Short label for a review gap, for example "10 min", "1 day" or "2 months". */
export function formatReviewDelay(ms: number): string {
  if (ms < 60_000) return '< 1 min';
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(ms / 3_600_000);
  if (ms < DAY_MS) return plural(hours, 'hour');
  const days = Math.round(ms / DAY_MS);
  if (days < 31) return plural(days, 'day');
  return plural(Math.round(days / 30), 'month');
}

// ---------------------------------------------------------------------------------------------
// Starting test
// ---------------------------------------------------------------------------------------------

export const STARTING_TEST_ITEM_COUNT = 10;
export const STARTING_TEST_SECONDS = 300;
const MIDDLE_DIFFICULTY = 3;

export interface StartingTestCandidate {
  itemId: string;
  topicId: string;
  difficulty: number;
  type: ItemType;
}

function shuffle<T>(values: readonly T[], rng: Rng): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

/**
 * Picks the starting test: topics in a random order, one item from each (closest to middle
 * difficulty) before a second from any topic. Flashcards and long answers are left out.
 */
export function pickStartingTest(
  candidates: readonly StartingTestCandidate[],
  { count = STARTING_TEST_ITEM_COUNT, rng }: { count?: number; rng: Rng },
): string[] {
  const byTopic = new Map<string, StartingTestCandidate[]>();
  for (const c of candidates) {
    if (c.type === 'flashcard' || c.type === 'extended_answer') continue;
    byTopic.set(c.topicId, [...(byTopic.get(c.topicId) ?? []), c]);
  }
  const queues = shuffle([...byTopic.keys()], rng).map((topicId) =>
    shuffle(byTopic.get(topicId)!, rng).sort(
      (a, b) =>
        Math.abs(a.difficulty - MIDDLE_DIFFICULTY) - Math.abs(b.difficulty - MIDDLE_DIFFICULTY),
    ),
  );
  const picked: string[] = [];
  while (picked.length < count && queues.some((q) => q.length > 0)) {
    for (const queue of queues) {
      const next = queue.shift();
      if (next && picked.length < count) picked.push(next.itemId);
    }
  }
  return picked;
}

// ---------------------------------------------------------------------------------------------
// Daily goal and streak
// ---------------------------------------------------------------------------------------------

/** RevisionDen is for UK students; days follow UK time until per-student time zones exist. */
export const DEFAULT_TIME_ZONE = 'Europe/London';

/** Calendar date (YYYY-MM-DD) of `now` in the given time zone. */
export function localDate(now: Date, timeZone = DEFAULT_TIME_ZONE): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

const dayToDate = (date: string) => new Date(`${date}T00:00:00Z`);
const dateOf = (time: number) => new Date(time).toISOString().slice(0, 10);

/** The Monday that starts the week containing `date`. */
export function weekStartOf(date: string): string {
  const d = dayToDate(date);
  const sinceMonday = (d.getUTCDay() + 6) % 7;
  return dateOf(d.getTime() - sinceMonday * DAY_MS);
}

export function previousDay(date: string): string {
  return dateOf(dayToDate(date).getTime() - DAY_MS);
}

/**
 * Records that the daily goal was met on `date`. A day counts once. On the first goal day of a
 * new week, last week is settled (a skip day if its weekly goal was hit).
 */
export function recordGoalMet(
  state: StreakState,
  date: string,
  { daysGoalMetLastWeek }: { daysGoalMetLastWeek?: number } = {},
): StreakState {
  if (state.lastDate === date) return state;
  let next = state;
  if (daysGoalMetLastWeek !== undefined) {
    const lastWeek = weekStartOf(dateOf(dayToDate(weekStartOf(date)).getTime() - DAY_MS));
    next = settleWeek(next, { weekStart: lastWeek, daysGoalMet: daysGoalMetLastWeek });
  }
  return recordDay(next, { date, goalMet: true }).state;
}

/**
 * The streak as it stands on `today`, counting days missed since the last recorded day
 * (skip days used, or the streak broken). Nothing is stored: the same days are recorded for
 * real the next time the goal is met.
 */
export function streakAsOf(state: StreakState, today: string): StreakState {
  const yesterday = previousDay(today);
  if (state.lastDate === null || state.lastDate >= yesterday) return state;
  return recordDay(state, { date: yesterday, goalMet: false }).state;
}
