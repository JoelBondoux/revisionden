import { describe, expect, it } from 'vitest';
import { explainSteps } from './flashcard-explain';

describe('Explain steps for a flashcard (verified content only)', () => {
  it('walks through the worked steps and ends on the answer', () => {
    expect(explainSteps({ steps: ['2x + 3 = 7', '2x = 4'], answer: 'x = 2' })).toEqual([
      '2x + 3 = 7',
      '2x = 4',
      'Answer: x = 2',
    ]);
  });

  it('uses the mark scheme when there are no worked steps', () => {
    expect(explainSteps({ markScheme: ['M1 for a method', 'A1 for 12'], answer: '12' })).toEqual([
      'M1 for a method',
      'A1 for 12',
      'Answer: 12',
    ]);
  });

  it('adds the formula and every condition it needs', () => {
    expect(
      explainSteps({
        backFormula: { formula: 'x = (-b +- sqrt(b^2 - 4ac))/(2a)', conditions: ['a ≠ 0'] },
        answer: 'the quadratic formula',
      }),
    ).toEqual([
      'Formula: x = (-b +- sqrt(b^2 - 4ac))/(2a)',
      'Condition: a ≠ 0',
      'Answer: the quadratic formula',
    ]);
  });

  it('has no steps (so no Explain button) when the content has none', () => {
    expect(explainSteps({ answer: 'tangent' })).toEqual([]);
    expect(explainSteps({ steps: [], markScheme: [], answer: 'tangent' })).toEqual([]);
  });
});
