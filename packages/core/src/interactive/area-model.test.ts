import { describe, expect, it } from 'vitest';
import {
  AREA_MODEL_LIMITS,
  areaModelLayout,
  checkAreaModelPair,
  correctPair,
  factorPairs,
  factorisedForm,
  formatAreaModelAnswer,
  isScopeA,
  parseAreaModelAnswer,
  quadraticText,
} from './area-model';

describe('factor pairs', () => {
  it('lists every pair of whole numbers that multiply to c, smaller first', () => {
    expect(factorPairs(6)).toEqual([
      [1, 6],
      [2, 3],
    ]);
    expect(factorPairs(12)).toEqual([
      [1, 12],
      [2, 6],
      [3, 4],
    ]);
  });

  it('includes a repeated factor once for a square number', () => {
    expect(factorPairs(9)).toEqual([
      [1, 9],
      [3, 3],
    ]);
  });

  it('has nothing for zero, negatives or non-whole numbers', () => {
    expect(factorPairs(0)).toEqual([]);
    expect(factorPairs(-6)).toEqual([]);
    expect(factorPairs(2.5)).toEqual([]);
  });
});

describe('the pair that splits the middle term', () => {
  it('is the factor pair of c that adds to b', () => {
    expect(correctPair({ b: 5, c: 6 })).toEqual([2, 3]);
    expect(correctPair({ b: 7, c: 12 })).toEqual([3, 4]);
    expect(correctPair({ b: 8, c: 12 })).toEqual([2, 6]);
  });

  it('is missing when x² + bx + c does not factorise over whole numbers', () => {
    expect(correctPair({ b: 4, c: 6 })).toBeNull();
  });
});

describe('scope A (owner, 2026-11-26): x² + bx + c with b and c positive', () => {
  it('accepts positive whole b and c that factorise, within the limits', () => {
    expect(isScopeA({ b: 5, c: 6 })).toBe(true);
    expect(isScopeA({ b: 7, c: 12 })).toBe(true);
  });

  it('rejects zero or negative numbers (scope B is not in the pilot)', () => {
    expect(isScopeA({ b: 1, c: -6 })).toBe(false);
    expect(isScopeA({ b: -5, c: 6 })).toBe(false);
    expect(isScopeA({ b: 0, c: 0 })).toBe(false);
  });

  it('rejects quadratics that do not factorise, and non-whole numbers', () => {
    expect(isScopeA({ b: 4, c: 6 })).toBe(false);
    expect(isScopeA({ b: 5.5, c: 6 })).toBe(false);
  });

  it('rejects numbers too big to draw as tiles', () => {
    const { maxB, maxC } = AREA_MODEL_LIMITS;
    // b over its limit (x² + 14x + 13 = (x + 1)(x + 13) factorises).
    expect(maxB).toBe(13);
    expect(isScopeA({ b: 14, c: 13 })).toBe(false);
    // c over its limit while b is within it (x² + 13x + 40 = (x + 5)(x + 8) factorises).
    expect(maxC).toBe(36);
    expect(isScopeA({ b: 13, c: 40 })).toBe(false);
    expect(isScopeA({ b: 13, c: 36 })).toBe(true);
  });
});

describe('checking a chosen pair', () => {
  it('is right when the pair multiplies to c and adds to b, in either order', () => {
    expect(checkAreaModelPair({ b: 5, c: 6 }, [2, 3])).toEqual({
      correct: true,
      sum: 5,
      product: 6,
    });
    expect(checkAreaModelPair({ b: 5, c: 6 }, [3, 2]).correct).toBe(true);
  });

  it('is wrong when the pair multiplies to c but adds to something else', () => {
    expect(checkAreaModelPair({ b: 5, c: 6 }, [1, 6])).toEqual({
      correct: false,
      sum: 7,
      product: 6,
    });
  });

  it('is wrong when the pair does not multiply to c', () => {
    expect(checkAreaModelPair({ b: 5, c: 6 }, [1, 4]).correct).toBe(false);
  });
});

describe('the answer sent to the server', () => {
  it('is the pair written smaller first, so the order the student picked never matters', () => {
    expect(formatAreaModelAnswer([3, 2])).toBe('2,3');
    expect(parseAreaModelAnswer('2,3')).toEqual([2, 3]);
    expect(parseAreaModelAnswer(' 3 , 2 ')).toEqual([2, 3]);
  });

  it('is rejected when it is not two whole numbers', () => {
    for (const bad of ['', '2', '2,3,4', 'a,b', '2.5,3', '-2,3']) {
      expect(parseAreaModelAnswer(bad)).toBeNull();
    }
  });
});

describe('written forms', () => {
  it('writes the quadratic and its factorised form', () => {
    expect(quadraticText({ b: 5, c: 6 })).toBe('x^2 + 5x + 6');
    expect(factorisedForm([2, 3])).toBe('(x + 2)(x + 3)');
    expect(factorisedForm([3, 2])).toBe('(x + 2)(x + 3)');
  });

  it('writes 1x as x', () => {
    expect(quadraticText({ b: 1, c: 0 })).toBe('x^2 + x');
  });
});

describe('tile layout for a chosen pair', () => {
  it('puts the x² square in the corner with q strips to its right, p below and p by q units', () => {
    const layout = areaModelLayout([2, 3]);
    expect(layout.square).toEqual({ row: 0, col: 0 });
    expect(layout.rightStrips).toBe(3);
    expect(layout.bottomStrips).toBe(2);
    expect(layout.units).toHaveLength(6);
    expect(layout.units[0]).toEqual({ row: 0, col: 0 });
    expect(layout.units[5]).toEqual({ row: 1, col: 2 });
  });

  it('labels the sides x + q along the top and x + p down the left', () => {
    expect(areaModelLayout([2, 3]).sides).toEqual({
      top: ['x', '+3'],
      left: ['x', '+2'],
    });
  });

  it('uses as many strips and units as the quadratic has', () => {
    const layout = areaModelLayout([3, 4]);
    expect(layout.rightStrips + layout.bottomStrips).toBe(7);
    expect(layout.units).toHaveLength(12);
  });
});
