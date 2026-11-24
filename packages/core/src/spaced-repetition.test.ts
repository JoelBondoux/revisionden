import { describe, expect, it } from 'vitest';
import { DAY_MS, dueCards, newCard, reviewCard, type Card } from './spaced-repetition';

const now = Date.UTC(2026, 10, 24, 17, 0);

describe('reviewCard', () => {
  it('starts a new card due straight away with the standard ease', () => {
    expect(newCard('c1', now)).toEqual({
      id: 'c1',
      repetitions: 0,
      intervalDays: 0,
      ease: 2.5,
      dueAt: now,
    });
  });

  it('grows the interval on each success: 1 day, 6 days, then times the ease', () => {
    let card = newCard('c1', now);
    card = reviewCard(card, 5, now);
    expect(card.intervalDays).toBe(1);
    expect(card.dueAt).toBe(now + DAY_MS);
    card = reviewCard(card, 5, card.dueAt);
    expect(card.intervalDays).toBe(6);
    const before = card;
    card = reviewCard(card, 4, card.dueAt);
    expect(card.intervalDays).toBe(Math.round(6 * before.ease));
    expect(card.repetitions).toBe(3);
  });

  it('resets on failure and brings the card back within 10 minutes', () => {
    let card = newCard('c1', now);
    card = reviewCard(reviewCard(card, 5, now), 5, now + DAY_MS);
    const failed = reviewCard(card, 1, now + 7 * DAY_MS);
    expect(failed.repetitions).toBe(0);
    expect(failed.intervalDays).toBe(0);
    expect(failed.dueAt).toBe(now + 7 * DAY_MS + 10 * 60 * 1000);
  });

  it('makes hard cards come back more often by lowering the ease, never below 1.3', () => {
    let card = newCard('c1', now);
    const easy = reviewCard(card, 5, now).ease;
    const hard = reviewCard(card, 3, now).ease;
    expect(hard).toBeLessThan(easy);
    for (let i = 0; i < 20; i++) card = reviewCard(card, 0, now);
    expect(card.ease).toBe(1.3);
  });

  it('rejects a quality outside 0 to 5', () => {
    expect(() => reviewCard(newCard('c1', now), 6, now)).toThrow(/quality/);
    expect(() => reviewCard(newCard('c1', now), 2.5, now)).toThrow(/quality/);
  });
});

describe('dueCards', () => {
  const card = (id: string, intervalDays: number, dueAt: number): Card => ({
    id,
    repetitions: 1,
    intervalDays,
    ease: 2.5,
    dueAt,
  });

  it('leaves out cards that are not due yet', () => {
    expect(dueCards([card('later', 3, now + 1)], now)).toEqual([]);
  });

  it('orders due cards by urgency: overdue compared with their interval', () => {
    const cards = [
      card('long-interval-1-day-late', 30, now - DAY_MS),
      card('short-interval-1-day-late', 1, now - DAY_MS),
      card('due-now', 6, now),
      card('relearning', 0, now - 60 * 1000),
    ];
    expect(dueCards(cards, now).map((c) => c.id)).toEqual([
      'relearning',
      'short-interval-1-day-late',
      'long-interval-1-day-late',
      'due-now',
    ]);
  });
});
