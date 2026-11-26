import { describe, expect, it } from 'vitest';
import { correctAnswerText, markItem, type ItemRow } from './items';
import type { MathsEngine } from './maths-engine';

const row = (type: string, key: Record<string, unknown>, verify = {}, body = {}) =>
  ({ type, answer: { key, verify }, body }) as unknown as ItemRow;

describe('answer format when marking', () => {
  it('marks a rounded numeric answer only when written to the asked accuracy', async () => {
    const item = row('numeric', { value: '28.27', decimal_places: 2 });
    expect((await markItem(item, '28.27', undefined))?.correct).toBe(true);
    expect((await markItem(item, '28.274', undefined))?.correct).toBe(false);
  });

  it('passes the declared subject to the maths engine with the expected expression', async () => {
    let sent: unknown;
    const engine: MathsEngine = {
      async checkWorking(_lines, expected) {
        sent = expected;
        return { firstWrongLine: null, finalAnswerCorrect: true };
      },
    };
    const item = row(
      'worked_maths',
      { expression: '(v - u)/a', subject: 't' },
      { method: 'expression', expression: '(v - u)/a' },
    );
    await markItem(item, { lines: ['t = (v - u)/a'] }, engine);
    expect(sent).toEqual({ expression: '(v - u)/a', subject: 't' });
  });

  it('shows an expression answer with its subject, for example "t = (v - u)/a"', () => {
    const item = row('worked_maths', { expression: '(v - u)/a', subject: 't' });
    expect(correctAnswerText(item)).toBe('t = (v - u)/a');
    expect(correctAnswerText(row('worked_maths', { expression: '2x' }))).toBe('2x');
  });
});
