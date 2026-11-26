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
import {
  meetsRounding,
  roundingOf,
  simplestForm,
  standardForm,
  withoutSubject,
  withMinus,
  withoutThousands,
  withoutUnit,
  type Rounding,
} from './answer-format';
import { sameAnswer } from './answer-normalise';

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

/** A short-answer key as written in content: `any_order` and `units` are optional. */
export interface ShortAnswerKey {
  accepted: readonly string[];
  /** Order does not matter (commuted products and sums, reordered lists). */
  any_order?: boolean;
  /** Units the answer may end with, or leave off. */
  units?: readonly string[];
}

/** Marks a typed short answer with the fairer rules in `answer-normalise.ts`. */
export function markShortAnswer(key: ShortAnswerKey, answer: unknown): MarkResult {
  if (typeof answer !== 'string') return wrong;
  const options = { anyOrder: key.any_order === true, units: key.units };
  return mark(key.accepted.some((a) => sameAnswer(a, answer, options)));
}

/** A plain decimal or a simple fraction such as `3/4`; anything else is not a number. */
function parseNumber(text: string): number | null {
  // A mixed number: "1 1/3" is 4/3, never 11/3.
  const mixed = /^(-?)(\d+)\s+(\d+)\/(\d+)$/.exec(text.trim());
  if (mixed) {
    const bottom = Number(mixed[4]);
    if (bottom === 0) return null;
    const size = Number(mixed[2]) + Number(mixed[3]) / bottom;
    return mixed[1] ? -size : size;
  }
  // Spaces may sit around a sign or "/", never between two digits ("3 87" is not 387).
  const value = text.trim().replace(/(?<!\d)\s+|\s+(?!\d)/g, '');
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  const fraction = /^(-?\d+)\/(\d+)$/.exec(value);
  if (fraction && Number(fraction[2]) !== 0) return Number(fraction[1]) / Number(fraction[2]);
  return null;
}

export interface NumericKey extends Rounding {
  value: string;
  tolerance?: number;
  /** The answer may be written "<subject> = value", for example "t = 4". */
  subject?: string;
  /** The answer's unit ("m", "cm^2", "pounds"): an answer may be typed with it. */
  unit?: string;
  /** The question asks for simplest form: only a fraction in lowest terms is right, not 69/99. */
  simplest_form?: boolean;
}

export function markNumeric(key: NumericKey, raw: unknown): MarkResult {
  if (typeof raw !== 'string' || raw.trim() === '') return wrong;
  const answer = withoutThousands(
    withoutUnit(withoutSubject(withMinus(raw), key.subject), key.unit),
  );
  if (key.simplest_form && !simplestForm(answer)) return wrong;
  // An answer in standard form needs proper standard form (1 <= a < 10) back, not 64 × 10^7.
  const shown = standardForm(answer);
  if (standardForm(key.value) && !shown?.proper) return wrong;
  const rounding = roundingOf(key);
  if (rounding) return mark(meetsRounding(answer, key.value, rounding));
  const expected = parseNumber(standardForm(key.value)?.plain ?? key.value);
  if (expected === null) return mark(squash(answer) === squash(key.value));
  const given = parseNumber(shown?.plain ?? answer);
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
