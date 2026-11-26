import { describe, expect, it } from 'vitest';
import { COUNT_UP_MS, MAX_ENTER_MS, countUpValue, easeOutCubic, staggerDelay } from './count-up';

describe('easing', () => {
  it('starts at 0, ends at 1 and is past halfway at the midpoint (ease-out)', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });

  it('clamps times outside 0 to 1', () => {
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(2)).toBe(1);
  });
});

describe('the value at a moment of the count', () => {
  it('is 0 at the start, part way in the middle and exactly the value at the end', () => {
    expect(countUpValue(240, 0)).toBe(0);
    const mid = countUpValue(240, COUNT_UP_MS / 2);
    expect(mid).toBeGreaterThan(120);
    expect(mid).toBeLessThan(240);
    expect(Number.isInteger(mid)).toBe(true);
    expect(countUpValue(240, COUNT_UP_MS)).toBe(240);
    expect(countUpValue(240, COUNT_UP_MS * 3)).toBe(240);
  });

  it('waits at 0 before its stagger delay', () => {
    expect(countUpValue(50, -30)).toBe(0);
  });

  it('counts decimals to the right number of places', () => {
    const mid = countUpValue(2.5, COUNT_UP_MS / 2, { decimals: 1 });
    expect(mid * 10).toBeCloseTo(Math.round(mid * 10), 10);
    expect(countUpValue(2.5, COUNT_UP_MS, { decimals: 1 })).toBe(2.5);
  });

  it('never overshoots, and counts down to zero or negative values the same way', () => {
    for (let t = 0; t <= COUNT_UP_MS; t += 35) expect(countUpValue(9, t)).toBeLessThanOrEqual(9);
    expect(countUpValue(0, COUNT_UP_MS / 2)).toBe(0);
    expect(countUpValue(-4, COUNT_UP_MS)).toBe(-4);
  });
});

describe('stagger', () => {
  it('is at most 60ms between items', () => {
    expect(staggerDelay(1, 4)).toBeLessThanOrEqual(60);
    expect(staggerDelay(0, 4)).toBe(0);
  });

  it('keeps the whole set within 1 second, however many items there are', () => {
    for (const count of [1, 4, 8, 12, 52]) {
      expect(staggerDelay(count - 1, count) + COUNT_UP_MS).toBeLessThanOrEqual(MAX_ENTER_MS);
    }
  });
});
