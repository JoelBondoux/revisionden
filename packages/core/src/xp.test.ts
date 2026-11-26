import { describe, expect, it } from 'vitest';
import { DEFAULT_DAILY_GOAL_XP, GIFT_XP, XP_PER_CORRECT, dailyGoalMet, xpForAnswer } from './xp';

describe('xpForAnswer', () => {
  it('gives more XP for harder answer types', () => {
    expect(XP_PER_CORRECT).toEqual({
      flashcard: 5,
      multiple_choice: 10,
      short_answer: 15,
      numeric: 15,
      worked_maths: 20,
      extended_answer: 30,
      area_model: 10,
    });
    expect(xpForAnswer({ type: 'worked_maths', score: 1 })).toBe(20);
  });

  it('gives nothing for a wrong answer', () => {
    expect(xpForAnswer({ type: 'numeric', score: 0 })).toBe(0);
  });

  it('gives part of the XP for part marks, rounded', () => {
    expect(xpForAnswer({ type: 'extended_answer', score: 0.5 })).toBe(15);
    expect(xpForAnswer({ type: 'short_answer', score: 1 / 3 })).toBe(5);
  });

  it('doubles XP on the parent focus that week', () => {
    expect(xpForAnswer({ type: 'multiple_choice', score: 1, focus: true })).toBe(20);
  });

  it('rejects a score outside 0 to 1', () => {
    expect(() => xpForAnswer({ type: 'numeric', score: 1.2 })).toThrow(/score/);
  });

  it('gives 20 XP for gifting a day', () => {
    expect(GIFT_XP).toBe(20);
  });
});

describe('dailyGoalMet', () => {
  it('is met when XP today reaches the goal', () => {
    expect(DEFAULT_DAILY_GOAL_XP).toBe(50);
    expect(dailyGoalMet(49)).toBe(false);
    expect(dailyGoalMet(50)).toBe(true);
    expect(dailyGoalMet(30, 30)).toBe(true);
  });
});
