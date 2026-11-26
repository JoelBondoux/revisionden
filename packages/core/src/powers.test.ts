import { describe, expect, it } from 'vitest';
import { hasPowers, parsePowers, showsPowers, type PowerPart } from './powers';

/** Writes parts back as text with {…} for each superscript, to compare easily. */
const show = (parts: PowerPart[]): string =>
  parts.map((p) => (p.kind === 'text' ? p.text : `{${show(p.parts)}}`)).join('');
const sup = (text: string) => show(parsePowers(text));

describe('powers shown as superscripts (F9)', () => {
  it('raises a whole number, a letter or a signed number', () => {
    expect(sup('Solve x^2 + 11x + 24 = 0')).toBe('Solve x{2} + 11x + 24 = 0');
    expect(sup('x^n')).toBe('x{n}');
    expect(sup('10^-3')).toBe('10{-3}');
    expect(sup('10^−3')).toBe('10{−3}');
    expect(sup('2^10 = 1024')).toBe('2{10} = 1024');
  });

  it('raises a bracket without its brackets', () => {
    expect(sup('10^(2 + 8)')).toBe('10{2 + 8}');
    expect(sup('3.2 × 10^(8+2)')).toBe('3.2 × 10{8+2}');
    expect(sup('8^(2/3)')).toBe('8{2/3}');
    expect(sup('x^((a+b)c)')).toBe('x{(a+b)c}');
  });

  it('raises only the power, not what follows it', () => {
    expect(sup('(2x)^2')).toBe('(2x){2}');
    expect(sup('x^2y')).toBe('x{2}y');
    expect(sup('p^3q')).toBe('p{3}q');
  });

  it('reads a^b^c as a to the power b^c (right to left, as in maths)', () => {
    expect(sup('a^b^c')).toBe('a{b{c}}');
    expect(sup('2^3^2')).toBe('2{3{2}}');
  });

  it('reads powers inside a raised bracket too', () => {
    expect(sup('e^(x^2)')).toBe('e{x{2}}');
  });

  it('leaves text without a power untouched', () => {
    const text = 'What is a tangent? Think: 3 × 4 = 12.';
    expect(parsePowers(text)).toEqual([{ kind: 'text', text }]);
    expect(hasPowers(text)).toBe(false);
    expect(hasPowers('x^2')).toBe(true);
  });

  it('leaves a caret with nothing to raise as it is', () => {
    expect(sup('Press ^ then 2')).toBe('Press ^ then 2');
    expect(sup('x^')).toBe('x^');
    expect(sup('x^(2')).toBe('x^(2');
  });

  it('shows powers in every subject except computing, where ^ is a real symbol', () => {
    expect(showsPowers('gcse-maths')).toBe(true);
    expect(showsPowers('gcse-maths-h-a1')).toBe(true);
    expect(showsPowers(undefined)).toBe(true);
    expect(showsPowers('a-level-computer-science')).toBe(false);
    expect(showsPowers('gcse-computing-topic-1')).toBe(false);
  });
});
