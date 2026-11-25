import { describe, expect, it } from 'vitest';
import { LearnAttemptResponseSchema, StartingTestResultSchema } from './learning-schemas';

const progress = {
  xpToday: 40,
  totalXp: 400,
  dailyGoalXp: 50,
  goalMet: false,
  streak: { current: 2, best: 3, skipDays: 0 },
};

const attempt = {
  id: '00000000-0000-4000-8000-000000000500',
  itemId: '00000000-0000-4000-8000-000000000001',
  correct: true,
  score: 1,
  xpEarned: 15,
  createdAt: '2026-11-25T10:00:00.000Z',
  feedback: null,
  progress,
  flashcardAdded: false,
};

describe('combo fields in learn responses (J4)', () => {
  it('carries the combo and its bonus XP on a marked answer', () => {
    const parsed = LearnAttemptResponseSchema.parse({ ...attempt, combo: 3, comboBonusXp: 5 });
    expect(parsed.combo).toBe(3);
    expect(parsed.comboBonusXp).toBe(5);
  });

  it('still reads an answer from before combos', () => {
    const parsed = LearnAttemptResponseSchema.parse(attempt);
    expect(parsed.combo).toBeUndefined();
    expect(parsed.comboBonusXp).toBeUndefined();
  });

  it('shows the best combo and its bonus at the starting test reveal', () => {
    const base = { id: attempt.id, correct: 4, answered: 5, total: 5, topics: [] };
    expect(StartingTestResultSchema.parse(base).bestCombo).toBeUndefined();
    expect(
      StartingTestResultSchema.parse({ ...base, bestCombo: 4, comboBonusXp: 10 }),
    ).toMatchObject({ bestCombo: 4, comboBonusXp: 10 });
  });

  it('rejects a negative combo', () => {
    expect(LearnAttemptResponseSchema.safeParse({ ...attempt, combo: -1 }).success).toBe(false);
  });
});
