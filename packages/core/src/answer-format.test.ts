import { describe, expect, it } from 'vitest';
import {
  meetsRounding,
  roundingOf,
  shownPrecision,
  standardForm,
  withoutSubject,
  withoutThousands,
} from './answer-format';

describe('answers that state their subject', () => {
  it('reads "t = RHS" as RHS when t is the declared subject, ignoring spaces', () => {
    expect(withoutSubject('t = (v - u)/a', 't')).toBe('(v - u)/a');
    expect(withoutSubject('f^-1(x)=(x+3)/2', 'f^-1(x)')).toBe('(x+3)/2');
    expect(withoutSubject(' f ^-1 (x) = 2x', 'f^-1(x)')).toBe('2x');
  });

  it('leaves the answer alone for another subject, no subject, or more than one = sign', () => {
    expect(withoutSubject('u = 4', 't')).toBe('u = 4');
    expect(withoutSubject('t = 4', undefined)).toBe('t = 4');
    expect(withoutSubject('t = 4 = 4', 't')).toBe('t = 4 = 4');
    expect(withoutSubject('t =', 't')).toBe('t =');
  });
});

describe('the accuracy an answer is written to', () => {
  it('counts decimal places as the digits after the point', () => {
    expect(shownPrecision('28.27')).toMatchObject({ decimalPlaces: 2 });
    expect(shownPrecision('28')).toMatchObject({ decimalPlaces: 0 });
    expect(shownPrecision('-0.50')).toMatchObject({ decimalPlaces: 2 });
  });

  it('counts significant figures from the first non-zero digit', () => {
    expect(shownPrecision('28.3')).toMatchObject({ figures: [3, 3] });
    expect(shownPrecision('0.0123')).toMatchObject({ figures: [3, 3] });
    expect(shownPrecision('0.0120')).toMatchObject({ figures: [3, 3] });
  });

  it('lets trailing zeros of a whole number count or not, since 4500 may be 2, 3 or 4 sf', () => {
    expect(shownPrecision('4500')).toMatchObject({ figures: [2, 4] });
    expect(shownPrecision('30')).toMatchObject({ figures: [1, 2] });
  });

  it('is null for anything that is not a plain decimal', () => {
    expect(shownPrecision('3/4')).toBeNull();
    expect(shownPrecision('28.27 cm')).toBeNull();
    expect(shownPrecision('')).toBeNull();
  });
});

describe('rounded answers', () => {
  it('needs exactly the asked number of decimal places and the same value', () => {
    const twoDp = { decimal_places: 2 };
    expect(meetsRounding('28.27', '28.27', twoDp)).toBe(true);
    expect(meetsRounding('28.274', '28.27', twoDp)).toBe(false);
    expect(meetsRounding('28.3', '28.27', twoDp)).toBe(false);
    expect(meetsRounding('28.270', '28.27', twoDp)).toBe(false);
    expect(meetsRounding('28.28', '28.27', twoDp)).toBe(false);
  });

  it('needs the asked number of significant figures and the same value', () => {
    const threeSf = { significant_figures: 3 };
    expect(meetsRounding('28.3', '28.3', threeSf)).toBe(true);
    expect(meetsRounding('28.27', '28.3', threeSf)).toBe(false);
    expect(meetsRounding('4500', '4500', { significant_figures: 2 })).toBe(true);
    expect(meetsRounding('4500', '4500', { significant_figures: 5 })).toBe(false);
  });

  it('compares rounded values exactly, however small or precise', () => {
    expect(meetsRounding('0.000000002', '0.000000001', { significant_figures: 1 })).toBe(false);
    expect(meetsRounding('1.0000000001', '1.0000000000', { decimal_places: 10 })).toBe(false);
    expect(meetsRounding('-0.50', '-0.50', { decimal_places: 2 })).toBe(true);
    expect(meetsRounding('0.50', '-0.50', { decimal_places: 2 })).toBe(false);
    expect(meetsRounding('4500', '4500', { significant_figures: 2 })).toBe(true);
  });

  it('does not accept a fraction or words where a rounded decimal is asked for', () => {
    expect(meetsRounding('1/2', '0.50', { decimal_places: 2 })).toBe(false);
    expect(meetsRounding('about 0.50', '0.50', { decimal_places: 2 })).toBe(false);
  });

  it('reads the rounding an answer key asks for, if any', () => {
    expect(roundingOf({ decimal_places: 2 })).toEqual({ decimal_places: 2 });
    expect(roundingOf({ significant_figures: 3 })).toEqual({ significant_figures: 3 });
    expect(roundingOf({})).toBeNull();
  });
});

describe('UK thousands separators', () => {
  it('drops a space, thin space, non-breaking space or comma between groups of exactly three digits', () => {
    expect(withoutThousands('38 700')).toBe('38700');
    expect(withoutThousands('38\u2009700')).toBe('38700');
    expect(withoutThousands('38\u00a0700')).toBe('38700');
    expect(withoutThousands('38\u202f700')).toBe('38700');
    expect(withoutThousands('38,700')).toBe('38700');
    expect(withoutThousands(' -1 234 567.25 ')).toBe('-1234567.25');
    expect(withoutThousands('1,234,567')).toBe('1234567');
  });

  it('leaves anything else alone, so "3 87" stays two numbers', () => {
    expect(withoutThousands('3 87')).toBe('3 87');
    expect(withoutThousands('38 70')).toBe('38 70');
    expect(withoutThousands('3870 0')).toBe('3870 0');
    expect(withoutThousands('1234 567')).toBe('1234 567');
    expect(withoutThousands('38,700 000')).toBe('38,700 000'); // mixed separators
    expect(withoutThousands('1 234.567 8')).toBe('1 234.567 8'); // no grouping after the point
    expect(withoutThousands('3/4')).toBe('3/4');
  });
});

describe('standard form', () => {
  it('reads a × 10^n in its common spellings as an exact plain decimal', () => {
    for (const text of [
      '6.4 × 10^8',
      '6.4×10^8',
      '6.4 x 10^8',
      '6.4X10^8',
      '6.4 * 10^8',
      '6.4 · 10^8',
      '6.4 × 10⁸',
      '6.4e8',
      '6.4E+8',
    ]) {
      expect(standardForm(text)?.plain).toBe('640000000');
    }
    expect(standardForm('3.2 × 10^-4')?.plain).toBe('0.00032');
    expect(standardForm('3.2 × 10^(−4)')?.plain).toBe('0.00032');
    expect(standardForm('3.2 × 10⁻⁴')?.plain).toBe('0.00032');
    expect(standardForm('3.20e-4')?.plain).toBe('0.000320');
    expect(standardForm('-1.5 × 10^2')?.plain).toBe('-150');
  });

  it('knows the significant figures and whether it is proper standard form', () => {
    expect(standardForm('6.40 × 10^8')).toMatchObject({ figures: 3, proper: true });
    expect(standardForm('64 × 10^7')).toMatchObject({ plain: '640000000', proper: false });
    expect(standardForm('0.64 × 10^9')?.proper).toBe(false);
  });

  it('refuses a power of ten beyond ±100 instead of building a huge number', () => {
    for (const text of [
      '1e999999999',
      '1e-999999999',
      '1 × 10^999999999',
      '1 × 10⁹⁹⁹⁹⁹⁹⁹⁹⁹',
      '1e101',
    ]) {
      expect(() => standardForm(text)).not.toThrow();
      expect(standardForm(text)).toBeNull();
      expect(shownPrecision(text)).toBeNull();
      expect(meetsRounding(text, '1', { significant_figures: 1 })).toBe(false);
    }
    expect(standardForm('1e100')?.plain).toBe(`1${'0'.repeat(100)}`);
    expect(standardForm('1e-100')?.plain).toBe(`0.${'0'.repeat(99)}1`);
  });

  it('is null for anything that is not a × 10^n', () => {
    for (const text of [
      '640000000',
      '6.4 × 10',
      '6.4 × 9^8',
      '6.4 × 10^8.5',
      '6.4 ×× 10^8',
      'e8',
      '6.4e',
    ]) {
      expect(standardForm(text)).toBeNull();
    }
  });

  it('shows the accuracy of the number in front for significant figures', () => {
    expect(shownPrecision('6.40 × 10^8')?.figures).toEqual([3, 3]);
    expect(meetsRounding('6.4 × 10^8', '640000000', { significant_figures: 2 })).toBe(true);
    expect(meetsRounding('6.40 × 10^8', '640000000', { significant_figures: 2 })).toBe(false);
    expect(meetsRounding('6.4 × 10^-3', '0.0064', { decimal_places: 4 })).toBe(true);
  });
});
