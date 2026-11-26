import { describe, expect, it } from 'vitest';
import { DAY_MS, type Card } from './spaced-repetition';
import {
  DAILY_CARD_LIMIT,
  EXTRA_CARDS,
  cardsLeftToday,
  pickTodaysCards,
  type CapCandidate,
} from './card-limit';

const NOW = Date.parse('2026-11-26T12:00:00Z');
const card = (id: string, daysLate: number, intervalDays: number): Card => ({
  id,
  repetitions: intervalDays === 0 ? 0 : 2,
  intervalDays,
  ease: 2.5,
  dueAt: NOW - daysLate * DAY_MS,
});
const c = (
  id: string,
  daysLate: number,
  intervalDays: number,
  extra: Partial<CapCandidate> = {},
): CapCandidate => ({ card: card(id, daysLate, intervalDays), weakSpot: false, ...extra });

describe('daily flashcard limit (F11, owner)', () => {
  it('is 20 cards a day, with 10 more on request', () => {
    expect(DAILY_CARD_LIMIT).toBe(20);
    expect(EXTRA_CARDS).toBe(10);
    expect(cardsLeftToday(0)).toBe(20);
    expect(cardsLeftToday(7)).toBe(13);
    expect(cardsLeftToday(25)).toBe(0);
    expect(cardsLeftToday(20, 10)).toBe(10);
  });

  it('picks the most overdue for their interval first', () => {
    const picked = pickTodaysCards([c('a', 1, 10), c('b', 5, 5), c('c', 2, 1)], NOW, 2);
    expect(picked.map((p) => p.id)).toEqual(['c', 'b']);
  });

  it('puts cards being relearned (wrong just now) before everything', () => {
    const picked = pickTodaysCards([c('old', 30, 2), c('relearn', 0, 0)], NOW, 1);
    expect(picked.map((p) => p.id)).toEqual(['relearn']);
  });

  it('among equally overdue cards, prefers weak spots, then recent wrong answers', () => {
    const picked = pickTodaysCards(
      [
        c('plain', 2, 2),
        c('wrong', 2, 2, { wrongAnswerAt: NOW - DAY_MS }),
        c('older-wrong', 2, 2, { wrongAnswerAt: NOW - 5 * DAY_MS }),
        c('weak', 2, 2, { weakSpot: true }),
      ],
      NOW,
      4,
    );
    expect(picked.map((p) => p.id)).toEqual(['weak', 'wrong', 'older-wrong', 'plain']);
  });

  it('only picks cards that are due, and never more than are left', () => {
    expect(pickTodaysCards([c('soon', -1, 3), c('due', 1, 3)], NOW, 5).map((p) => p.id)).toEqual([
      'due',
    ]);
    expect(pickTodaysCards([c('a', 1, 3)], NOW, 0)).toEqual([]);
  });
});
