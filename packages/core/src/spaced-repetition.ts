/**
 * Flashcard scheduler in the style of SM-2 (see docs/PLAN.md "Flashcards").
 *
 * - Quality 0–5 for each review; 3 or more is a success.
 * - Success: interval goes 1 day, 6 days, then the previous interval times the card's ease.
 * - Failure: the card starts again and comes back within 10 minutes (wrong cards return sooner).
 * - Ease starts at 2.5, moves with each answer and never drops below 1.3.
 * Times are milliseconds since the epoch; the caller passes `now`.
 */
export const DAY_MS = 86_400_000;
export const RELEARN_DELAY_MS = 10 * 60 * 1000;
export const STARTING_EASE = 2.5;
export const MIN_EASE = 1.3;
const PASS_QUALITY = 3;

export interface Card {
  id: string;
  /** Successful reviews in a row. */
  repetitions: number;
  intervalDays: number;
  ease: number;
  dueAt: number;
}

export function newCard(id: string, now: number): Card {
  return { id, repetitions: 0, intervalDays: 0, ease: STARTING_EASE, dueAt: now };
}

function nextEase(ease: number, quality: number): number {
  const miss = 5 - quality;
  const updated = ease + (0.1 - miss * (0.08 + miss * 0.02));
  return Math.max(MIN_EASE, Math.round(updated * 100) / 100);
}

export function reviewCard(card: Card, quality: number, now: number): Card {
  if (!Number.isInteger(quality) || quality < 0 || quality > 5) {
    throw new Error('Review quality must be a whole number from 0 to 5');
  }
  const ease = nextEase(card.ease, quality);
  if (quality < PASS_QUALITY) {
    return { ...card, repetitions: 0, intervalDays: 0, ease, dueAt: now + RELEARN_DELAY_MS };
  }
  const intervalDays =
    card.repetitions === 0
      ? 1
      : card.repetitions === 1
        ? 6
        : Math.round(card.intervalDays * card.ease);
  return {
    ...card,
    repetitions: card.repetitions + 1,
    intervalDays,
    ease,
    dueAt: now + intervalDays * DAY_MS,
  };
}

/** How late a card is compared with its interval; relearning cards are always most urgent. */
export function urgency(card: Card, now: number): number {
  if (card.intervalDays === 0) return Number.POSITIVE_INFINITY;
  return (now - card.dueAt) / (card.intervalDays * DAY_MS);
}

/** Cards due at `now`, most urgent first (ties: the one due earliest). */
export function dueCards(cards: readonly Card[], now: number): Card[] {
  return cards
    .filter((card) => card.dueAt <= now)
    .sort((a, b) => urgency(b, now) - urgency(a, now) || a.dueAt - b.dueAt);
}
