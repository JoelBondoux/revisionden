import { describe, expect, it } from 'vitest';
import { normaliseAnswer, sameAnswer } from './answer-normalise';
import { markShortAnswer } from './learning';

const ok = { correct: true, score: 1 };
const no = { correct: false, score: 0 };

describe('normalising a typed maths answer', () => {
  it('ignores spaces and capitals in maths answers', () => {
    expect(sameAnswer('y = 2x + 3', 'Y=2X+3')).toBe(true);
    expect(sameAnswer('(3, 1)', '( 3 ,1 )')).toBe(true);
  });

  it('treats the unicode minus and dashes as a hyphen minus', () => {
    expect(sameAnswer('-8x', '−8x')).toBe(true);
    expect(sameAnswer('(-2, -7)', '(–2, −7)')).toBe(true);
  });

  it('treats ×, a dot, * and x between numbers as the same multiply', () => {
    expect(sameAnswer('p^3q', 'p^3 × q')).toBe(true);
    expect(sameAnswer('p^3q', 'p^3*q')).toBe(true);
    expect(sameAnswer('4√2', '4 × √2')).toBe(true);
    expect(sameAnswer('3*4', '3 x 4')).toBe(true);
    expect(sameAnswer('3*4', '3·4')).toBe(true);
  });

  it('never joins two numbers when it drops a multiply sign', () => {
    expect(sameAnswer('3*4', '34')).toBe(false);
  });

  it('keeps a multiply sign before a signed number, so 3n × -2 is not 3n - 2', () => {
    expect(sameAnswer('3n-2', '3n*-2')).toBe(false);
    expect(sameAnswer('3n-2', '3n × −2')).toBe(false);
    expect(sameAnswer('3n*-2', '3n × −2')).toBe(true);
  });

  it('treats ÷ and / the same', () => {
    expect(sameAnswer('3/4', '3 ÷ 4')).toBe(true);
  });

  it('treats superscripts and ^ the same', () => {
    expect(sameAnswer('(x + 3)^2 + 2', '(x+3)²+2')).toBe(true);
    expect(sameAnswer('x^2 + y^2 = 36', 'x² + y² = 36')).toBe(true);
    expect(sameAnswer('n^10', 'n¹⁰')).toBe(true);
  });

  it('treats ≤, ≥ and <=, >= the same', () => {
    expect(sameAnswer('x ≤ 3', 'x<=3')).toBe(true);
    expect(sameAnswer('x ≥ 3', 'x >= 3')).toBe(true);
  });

  it('treats √, sqrt and sqrt( ) the same', () => {
    expect(sameAnswer('4√2', '4sqrt(2)')).toBe(true);
    expect(sameAnswer('4√2', '4 sqrt 2')).toBe(true);
    expect(sameAnswer('√32', 'sqrt(32)')).toBe(true);
    expect(sameAnswer('4√2', '√32')).toBe(false);
  });

  it('leaves word answers to the plain word rules (one space between words)', () => {
    expect(normaliseAnswer('  A   Tangent ')).toBe('a tangent');
    expect(sameAnswer('a tangent', 'at angent')).toBe(false);
  });
});

describe('answers whose order does not matter', () => {
  const any = { anyOrder: true };

  it('accepts commuted products and sums only when the item says order does not matter', () => {
    expect(sameAnswer('p^3q', 'qp^3', any)).toBe(true);
    expect(sameAnswer('p^3q', 'q × p^3', any)).toBe(true);
    expect(sameAnswer('3n + 2', '2 + 3n', any)).toBe(true);
    expect(sameAnswer('24 - 4n', '−4n + 24', any)).toBe(true);
    expect(sameAnswer('3x + 4y = 25', '4y + 3x = 25', any)).toBe(true);
    expect(sameAnswer('3n + 2', '2 + 3n')).toBe(false);
  });

  it('reorders a product of letters only, but never the letters of a word', () => {
    expect(sameAnswer('pq', 'qp', any)).toBe(true);
    expect(sameAnswer('abc', 'cab', any)).toBe(true);
    expect(sameAnswer('tangent', 'gnattne', any)).toBe(false);
    expect(sameAnswer('pq', 'qp')).toBe(false);
  });

  it('keeps signs with their terms', () => {
    expect(sameAnswer('24 - 4n', '4n - 24', any)).toBe(false);
  });

  it('accepts a reordered list or pair of values', () => {
    expect(sameAnswer('x = 3, y = 2', 'y = 2 and x = 3', any)).toBe(true);
    expect(sameAnswer('x = 3, y = 2', 'y=2; x=3', any)).toBe(true);
    expect(sameAnswer('-1, 0, 1, 2, 3', '3, 2, 1, 0, −1', any)).toBe(true);
    expect(sameAnswer('x = 3, y = 2', 'x = 2, y = 3', any)).toBe(false);
  });

  it('reorders the items of a list, never the letters inside an item (F23)', () => {
    const outcomes = 'HH, HT, TH, TT';
    expect(sameAnswer(outcomes, 'TH, HH, TT, HT', any)).toBe(true);
    expect(sameAnswer(outcomes, 'HH, HT, HT, TT', any)).toBe(false);
    expect(sameAnswer('HT', 'TH', any)).toBe(true); // one item on its own is still a product
    expect(sameAnswer('HT, TT', 'TH, TT', any)).toBe(false);
  });

  it('accepts a list with or without outer set braces (F23)', () => {
    expect(sameAnswer('4, 5, 6', '{4, 5, 6}', any)).toBe(true);
    expect(sameAnswer('{4, 5, 6}', '6, 4, 5', any)).toBe(true);
    expect(sameAnswer('4, 5, 6', '{4, 5, 6}')).toBe(true);
    expect(sameAnswer('4, 5, 6', '{4, 5, 7}', any)).toBe(false);
  });

  it('never reorders a coordinate', () => {
    expect(sameAnswer('(3, 1)', '(1, 3)', any)).toBe(false);
  });

  it('accepts the sides of an equation either way round', () => {
    expect(sameAnswer('y = 2x + 3', '2x + 3 = y', any)).toBe(true);
    expect(sameAnswer('x < 7', '7 < x', any)).toBe(false);
  });
});

describe('optional units', () => {
  it('accepts the answer with or without a unit the item allows', () => {
    const units = { units: ['cm', 'centimetres'] };
    expect(sameAnswer('12', '12 cm', units)).toBe(true);
    expect(sameAnswer('12', '12 Centimetres', units)).toBe(true);
    expect(sameAnswer('12 cm', '12', units)).toBe(true);
    expect(sameAnswer('12', '12 m', units)).toBe(false);
    expect(sameAnswer('12', '12 cm')).toBe(false);
  });
});

describe('marking a short answer', () => {
  it('needs only one written form of an answer (cases from the S3-A Algebra run)', () => {
    // Each pair: the first accepted form in the S3-A item, and another form it had to list.
    const cases: [string, string, { any_order?: boolean }?][] = [
      ['-8x', '−8x'],
      ['p^3q', 'q × p^3', { any_order: true }],
      ['(-2, -7)', '(−2,−7)'],
      ['x ≤ 3', 'x<=3'],
      ['-1, 0, 1, 2, 3', '−1,0,1,2,3'],
      ['4√2', '4sqrt2'],
      ['(x + 3)^2 + 2', '(x+3)²+2'],
      ['y = -3x + 7', 'y=−3x+7'],
      ['x^2 + y^2 = 36', 'y^2+x^2=36', { any_order: true }],
      ['3x + 4y = 25', '4y+3x=25', { any_order: true }],
      ['24 - 4n', '−4n+24', { any_order: true }],
      ['n^2 + n', 'n²+n'],
      ['x = 3, y = 2', 'y=2andx=3', { any_order: true }],
    ];
    for (const [first, other, extra] of cases) {
      expect(
        markShortAnswer({ accepted: [first], ...extra }, other),
        `${first} / ${other}`,
      ).toEqual(ok);
    }
  });

  it('reads optional units from the item', () => {
    expect(markShortAnswer({ accepted: ['12'], units: ['cm'] }, '12cm')).toEqual(ok);
    expect(markShortAnswer({ accepted: ['12'] }, '12cm')).toEqual(no);
  });

  it('still rejects a wrong answer', () => {
    expect(markShortAnswer({ accepted: ['3n + 2'], any_order: true }, '3n + 3')).toEqual(no);
  });
});
