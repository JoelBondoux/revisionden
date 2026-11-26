import { describe, expect, it } from 'vitest';
import { DAY_MS } from './spaced-repetition';
import { WEAK_SPOT_THRESHOLD, isWeakSpot, topicMastery, type MasteryAttempt } from './mastery';

const now = Date.UTC(2026, 10, 24);
const daysAgo = (d: number) => now - d * DAY_MS;
const right = (d = 0): MasteryAttempt => ({ score: 1, at: daysAgo(d) });
const wrong = (d = 0): MasteryAttempt => ({ score: 0, at: daysAgo(d) });

describe('topicMastery', () => {
  it('is 0 with no attempts', () => {
    expect(topicMastery([], now)).toBe(0);
  });

  it('rises with each correct answer', () => {
    const one = topicMastery([right()], now);
    const three = topicMastery([right(), right(), right()], now);
    expect(one).toBeGreaterThan(0);
    expect(three).toBeGreaterThan(one);
  });

  it('falls when answers are wrong', () => {
    const attempts = [right(), right(), right()];
    expect(topicMastery([...attempts, wrong()], now)).toBeLessThan(topicMastery(attempts, now));
  });

  it('gives old attempts less weight than recent ones', () => {
    const oldWrongRecentRight = topicMastery([wrong(60), wrong(60), right(0), right(0)], now);
    const oldRightRecentWrong = topicMastery([right(60), right(60), wrong(0), wrong(0)], now);
    expect(oldWrongRecentRight).toBeGreaterThan(oldRightRecentWrong);
  });

  it('drifts down when the topic has not been practised for a while', () => {
    const attempts = Array.from({ length: 10 }, () => right(0));
    const later = now + 90 * DAY_MS;
    expect(topicMastery(attempts, later)).toBeLessThan(topicMastery(attempts, now));
  });

  it('counts partial marks', () => {
    const half = topicMastery(
      Array.from({ length: 10 }, () => ({ score: 0.5, at: now })),
      now,
    );
    expect(half).toBeGreaterThan(30);
    expect(half).toBeLessThan(50);
  });

  it('only uses the most recent 30 attempts', () => {
    const old = Array.from({ length: 50 }, () => wrong(1));
    const recent = Array.from({ length: 30 }, () => right(0));
    expect(topicMastery([...old, ...recent], now)).toBe(topicMastery(recent, now));
  });

  it('never goes outside 0 to 100, even with odd scores or future times', () => {
    const many = Array.from({ length: 30 }, () => right(0));
    expect(topicMastery(many, now)).toBeLessThanOrEqual(100);
    expect(topicMastery([{ score: 7, at: now }], now)).toBeLessThanOrEqual(100);
    expect(topicMastery([{ score: -3, at: now }], now)).toBeGreaterThanOrEqual(0);
    expect(topicMastery([{ score: 1, at: now + DAY_MS }], now)).toBeLessThanOrEqual(100);
  });

  it('returns a whole number', () => {
    expect(Number.isInteger(topicMastery([right(3), wrong(1)], now))).toBe(true);
  });
});

describe('retries in mastery', () => {
  it('counts an attempt with weight 0.5 half as much as a first attempt', () => {
    const now = Date.UTC(2026, 10, 25);
    const first = topicMastery([{ score: 1, at: now }], now);
    const retry = topicMastery([{ score: 1, at: now, weight: 0.5 }], now);
    expect(retry).toBeLessThan(first);
    // 1 right at weight 0.5 against the 2 imaginary wrong answers: 0.5 / 2.5 = 20%.
    expect(retry).toBe(20);
  });
});

describe('isWeakSpot', () => {
  it('marks topics below 60% mastery as weak spots', () => {
    expect(WEAK_SPOT_THRESHOLD).toBe(60);
    expect(isWeakSpot(59)).toBe(true);
    expect(isWeakSpot(60)).toBe(false);
  });
});
