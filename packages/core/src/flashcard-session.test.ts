import { describe, expect, it } from 'vitest';
import {
  FLASHCARD_SESSION_MAX_CARDS,
  FLASHCARD_SESSION_MIN_CARDS,
  FLASHCARD_SESSION_XP,
  MAX_REWARDED_SESSIONS_PER_DAY,
  countCardInSession,
  sessionOutcome,
} from './flashcard-session';
import { DEFAULT_DAILY_GOAL_XP } from './xp';

describe('flashcard session rules', () => {
  it('uses the product owner’s numbers', () => {
    expect(FLASHCARD_SESSION_MAX_CARDS).toBe(20);
    expect(FLASHCARD_SESSION_MIN_CARDS).toBe(5);
    expect(FLASHCARD_SESSION_XP).toBe(20);
    expect(MAX_REWARDED_SESSIONS_PER_DAY).toBe(2);
  });

  it('never lets flashcards alone reach the daily goal', () => {
    expect(FLASHCARD_SESSION_XP * MAX_REWARDED_SESSIONS_PER_DAY).toBeLessThan(
      DEFAULT_DAILY_GOAL_XP,
    );
  });

  it('counts each card once, even when "Again" brings it back', () => {
    let cards: string[] = [];
    cards = countCardInSession(cards, 'a');
    cards = countCardInSession(cards, 'b');
    cards = countCardInSession(cards, 'a');
    expect(cards).toEqual(['a', 'b']);
  });

  it('stops counting after 20 cards', () => {
    let cards: string[] = [];
    for (let i = 0; i < 25; i++) cards = countCardInSession(cards, `c${i}`);
    expect(cards).toHaveLength(20);
  });
});

describe('session outcome', () => {
  const base = { cardsCounted: 5, dueLeft: 0, rewardedToday: 0 };

  it('pays 20 XP for a completed session of at least 5 cards, whatever the ratings', () => {
    expect(sessionOutcome(base)).toEqual({ completed: true, xp: 20, reason: 'rewarded' });
  });

  it('completes after 20 cards even with cards still due', () => {
    expect(sessionOutcome({ ...base, cardsCounted: 20, dueLeft: 7 })).toMatchObject({
      completed: true,
      xp: 20,
    });
  });

  it('pays nothing for leaving early', () => {
    expect(sessionOutcome({ ...base, cardsCounted: 8, dueLeft: 3 })).toEqual({
      completed: false,
      xp: 0,
      reason: 'left_early',
    });
  });

  it('pays nothing for a completed session of fewer than 5 cards', () => {
    expect(sessionOutcome({ ...base, cardsCounted: 4 })).toEqual({
      completed: true,
      xp: 0,
      reason: 'too_few_cards',
    });
  });

  it('pays at most 2 sessions a day', () => {
    expect(sessionOutcome({ ...base, rewardedToday: 1 }).xp).toBe(20);
    expect(sessionOutcome({ ...base, rewardedToday: 2 })).toEqual({
      completed: true,
      xp: 0,
      reason: 'daily_limit',
    });
  });
});
