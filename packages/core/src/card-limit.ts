/**
 * Daily flashcard limit (workstream F11, owner 2026-11-26; docs/PRODUCT_RULES.md "Flashcards and
 * mastery"). "Cards 99+" felt like a chore, so review is capped at 20 cards a day, with 10 more
 * on request for keen students.
 *
 * - Which 20: the most useful first. Cards being relearned (missed just now), then the most
 *   overdue for their interval (`urgency`); among equally overdue cards, weak-spot topics first,
 *   then cards from the most recent wrong answers, then the one due earliest.
 * - The student's own cards count towards the cap. Browsing All decks is not review: no cap.
 * - Cards past the cap stay due and roll to the next day. SM-2 sets the next interval from the
 *   card's own interval, not from how late it was reviewed, so a card held back by the cap is
 *   never treated as forgotten.
 */
import { urgency, type Card } from './spaced-repetition';

export const DAILY_CARD_LIMIT = 20;
/** The "10 more" button for keen students. */
export const EXTRA_CARDS = 10;

/** Review cards left today, after `reviewedToday` distinct cards and any extra asked for. */
export function cardsLeftToday(reviewedToday: number, extra = 0): number {
  return Math.max(0, DAILY_CARD_LIMIT + extra - reviewedToday);
}

export interface CapCandidate {
  card: Card;
  /** The card's topic is a weak spot (mastery below 60). */
  weakSpot: boolean;
  /** When the wrong answer behind a wrong-answer card was given (ms), if it is one. */
  wrongAnswerAt?: number;
}

/** Today's review cards: the most useful due cards first, at most `left` of them. */
export function pickTodaysCards(
  candidates: readonly CapCandidate[],
  now: number,
  left: number,
): Card[] {
  if (left <= 0) return [];
  return candidates
    .filter((c) => c.card.dueAt <= now)
    .sort(
      (a, b) =>
        urgency(b.card, now) - urgency(a.card, now) ||
        Number(b.weakSpot) - Number(a.weakSpot) ||
        (b.wrongAnswerAt ?? -Infinity) - (a.wrongAnswerAt ?? -Infinity) ||
        a.card.dueAt - b.card.dueAt,
    )
    .slice(0, left)
    .map((c) => c.card);
}
