/**
 * Flashcard deck XP is per session, not per card (product owner, 2026-11-25; see
 * docs/PRODUCT_RULES.md "Flashcard buttons").
 *
 * - A session ends when the due queue is empty or after 20 cards, whichever comes first.
 * - A completed session of at least 5 cards earns 20 XP, whatever the ratings. Fewer than 5
 *   cards, or leaving early, earns nothing.
 * - At most 2 rewarded sessions a UK day (40 XP), so flashcards alone never reach the daily goal.
 * - A card answered "Again" that comes back in the same session counts once.
 *
 * Balance over five years (docs/REWARDS.md): the level curve assumes about 60 XP a practice
 * day. Flashcards add at most 40 XP a day, so they help but cannot outpace lessons, and the
 * 300 XP daily reward cap still applies.
 */
export const FLASHCARD_SESSION_MAX_CARDS = 20;
export const FLASHCARD_SESSION_MIN_CARDS = 5;
export const FLASHCARD_SESSION_XP = 20;
export const MAX_REWARDED_SESSIONS_PER_DAY = 2;

/** Adds a reviewed card to the session's count: each card once, at most 20. */
export function countCardInSession(cardIds: readonly string[], cardId: string): string[] {
  if (cardIds.includes(cardId) || cardIds.length >= FLASHCARD_SESSION_MAX_CARDS) {
    return [...cardIds];
  }
  return [...cardIds, cardId];
}

export type SessionOutcomeReason = 'rewarded' | 'left_early' | 'too_few_cards' | 'daily_limit';

export interface SessionOutcome {
  completed: boolean;
  xp: number;
  reason: SessionOutcomeReason;
}

/**
 * The result of finishing a session. It is complete when 20 cards were counted or no cards
 * are left due; then it pays 20 XP if it had at least 5 cards and today's 2 rewarded sessions
 * are not used up.
 */
export function sessionOutcome(input: {
  cardsCounted: number;
  dueLeft: number;
  rewardedToday: number;
}): SessionOutcome {
  const completed = input.cardsCounted >= FLASHCARD_SESSION_MAX_CARDS || input.dueLeft === 0;
  if (!completed) return { completed, xp: 0, reason: 'left_early' };
  if (input.cardsCounted < FLASHCARD_SESSION_MIN_CARDS) {
    return { completed, xp: 0, reason: 'too_few_cards' };
  }
  if (input.rewardedToday >= MAX_REWARDED_SESSIONS_PER_DAY) {
    return { completed, xp: 0, reason: 'daily_limit' };
  }
  return { completed, xp: FLASHCARD_SESSION_XP, reason: 'rewarded' };
}
