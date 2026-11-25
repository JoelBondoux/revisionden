import { describe, expect, it } from 'vitest';
import {
  DailyLimitSuggestionActionSchema,
  ParentDailyLimitSchema,
  StudentDailyLimitSchema,
  UpdateDailyLimitRequestSchema,
} from './daily-limit-schemas';

const today = {
  limitMinutes: 60,
  usedMinutes: 20,
  leftMinutes: 40,
  reached: false,
  dayType: 'school',
  examSeason: false,
} as const;

describe('daily limit schemas', () => {
  it("accepts the student's view with a change notice", () => {
    const view = { ...today, changed: { schoolDayMinutes: 50, otherDayMinutes: 80 } };
    expect(StudentDailyLimitSchema.parse(view)).toEqual(view);
    expect(StudentDailyLimitSchema.parse({ ...today, changed: null }).changed).toBeNull();
  });

  it("accepts the parent's view with a pending suggestion", () => {
    const view = {
      settings: { schoolDayMinutes: 60, otherDayMinutes: 90, examSeasonExtra: false },
      custom: { school: false, other: false },
      defaults: { school: 60, other: 90 },
      ceilings: { school: 120, other: 180 },
      today,
      suggestion: {
        kind: 'ease',
        change: -10,
        schoolDayMinutes: 50,
        otherDayMinutes: 80,
        reason: 'No rest days in the last two weeks.',
      },
    };
    expect(ParentDailyLimitSchema.parse(view)).toEqual(view);
  });

  it('takes a limit from 15 minutes to 6 hours, or null for the default', () => {
    expect(UpdateDailyLimitRequestSchema.parse({ schoolDayMinutes: 45 })).toEqual({
      schoolDayMinutes: 45,
    });
    expect(
      UpdateDailyLimitRequestSchema.parse({ otherDayMinutes: null }).otherDayMinutes,
    ).toBeNull();
    for (const bad of [{ schoolDayMinutes: 10 }, { schoolDayMinutes: 361 }, {}, { x: 1 }]) {
      expect(UpdateDailyLimitRequestSchema.safeParse(bad).success).toBe(false);
    }
  });

  it('accepts or dismisses a suggestion', () => {
    expect(DailyLimitSuggestionActionSchema.parse({ action: 'accept' })).toEqual({
      action: 'accept',
    });
    expect(DailyLimitSuggestionActionSchema.safeParse({ action: 'ignore' }).success).toBe(false);
  });
});

describe('progress carries the daily limit', () => {
  it('lets every progress response say whether the limit is reached', async () => {
    const { ProgressSchema } = await import('./learning-schemas');
    const progress = {
      xpToday: 40,
      totalXp: 400,
      dailyGoalXp: 50,
      goalMet: false,
      streak: { current: 1, best: 3, skipDays: 0 },
    };
    expect(ProgressSchema.parse(progress)).toEqual(progress);
    const withLimit = { ...progress, dailyLimit: today };
    expect(ProgressSchema.parse(withLimit).dailyLimit).toEqual(today);
  });
});
