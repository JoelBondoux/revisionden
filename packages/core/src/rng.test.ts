import { describe, expect, it } from 'vitest';
import { createRng, weightedPick } from './rng';

describe('createRng', () => {
  it('gives the same numbers for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('gives different numbers for different seeds, always from 0 up to 1', () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(a()).not.toBe(b());
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const n = rng();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });
});

describe('weightedPick', () => {
  it('picks in proportion to the weights', () => {
    const rng = createRng(3);
    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 10_000; i++)
      counts[
        weightedPick(
          [
            ['a', 1],
            ['b', 3],
          ] as const,
          rng,
        )
      ]++;
    expect(counts.b / 10_000).toBeCloseTo(0.75, 1);
  });

  it('never picks an option with zero weight', () => {
    const rng = createRng(4);
    for (let i = 0; i < 100; i++)
      expect(
        weightedPick(
          [
            ['a', 0],
            ['b', 1],
          ],
          rng,
        ),
      ).toBe('b');
  });

  it('refuses an empty list or weights that add up to nothing', () => {
    expect(() => weightedPick([], createRng(1))).toThrow(/weight/);
    expect(() => weightedPick([['a', 0]], createRng(1))).toThrow(/weight/);
  });
});
