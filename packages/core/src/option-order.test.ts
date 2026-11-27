import { describe, expect, it } from 'vitest';
import { createRng } from './rng';
import { shuffledOptionOrder } from './option-order';

/*
 * F22: multiple choice options are shown in a fresh order each time a question is served, so the
 * right answer is not always first (it was option 1 in nearly every item). The order is a list of
 * the options' original positions, so marking still goes by which option was picked.
 */
describe('shuffled option order (F22)', () => {
  it('is a reordering of every option, each once', () => {
    const order = shuffledOptionOrder(['a', 'b', 'c', 'd'], createRng(7));
    expect([...order].sort()).toEqual([0, 1, 2, 3]);
  });

  it('puts the first option first only about as often as chance over many serves', () => {
    const rng = createRng(42);
    let first = 0;
    const serves = 2000;
    for (let i = 0; i < serves; i += 1) {
      if (shuffledOptionOrder(['right', 'b', 'c', 'd'], rng)[0] === 0) first += 1;
    }
    expect(first).toBeGreaterThan(serves * 0.18);
    expect(first).toBeLessThan(serves * 0.32);
  });

  it('keeps "none of these" and "all of the above" type options last, in their order', () => {
    const options = ['x = 1', 'All of the above', 'x = 2', 'None of these', 'x = 3'];
    for (let seed = 0; seed < 50; seed += 1) {
      const order = shuffledOptionOrder(options, createRng(seed));
      expect(order.slice(-2)).toEqual([1, 3]);
      expect([...order.slice(0, 3)].sort()).toEqual([0, 2, 4]);
    }
  });

  it('pins "both of them" and "neither of these" too, whatever the case', () => {
    const order = shuffledOptionOrder(['A', 'neither of these', 'B', 'Both of them'], createRng(3));
    expect(order.slice(-2)).toEqual([1, 3]);
  });

  it('gives the same order for the same randomness, so a serve can be replayed in tests', () => {
    const options = ['a', 'b', 'c', 'd', 'e'];
    expect(shuffledOptionOrder(options, createRng(9))).toEqual(
      shuffledOptionOrder(options, createRng(9)),
    );
  });
});
