/**
 * Shared schemas for the daily limit (docs/PRODUCT_RULES.md "Daily limit (wellbeing)"), used by
 * the API and the web app.
 */
import { z } from 'zod';
import { MAX_DAILY_LIMIT, MIN_DAILY_LIMIT } from './daily-limit';

const Minutes = z.number().int().min(0);
const Limit = z.number().int().min(MIN_DAILY_LIMIT).max(MAX_DAILY_LIMIT);
const PerDayType = z.object({ school: Minutes, other: Minutes });

/** Today's limit: minutes used and left (active study minutes, family time zone). */
export const DailyLimitTodaySchema = z.object({
  limitMinutes: Minutes,
  usedMinutes: Minutes,
  leftMinutes: Minutes,
  reached: z.boolean(),
  dayType: z.enum(['school', 'other']),
  examSeason: z.boolean(),
});
export type DailyLimitToday = z.infer<typeof DailyLimitTodaySchema>;

export const StudentDailyLimitSchema = DailyLimitTodaySchema.extend({
  /** Set when a parent changed the limit since the student last looked. */
  changed: z.object({ schoolDayMinutes: Minutes, otherDayMinutes: Minutes }).nullable(),
}).strict();
export type StudentDailyLimit = z.infer<typeof StudentDailyLimitSchema>;

export const DailyLimitSuggestionSchema = z
  .object({
    kind: z.enum(['raise', 'ease']),
    change: z.number().int(),
    schoolDayMinutes: Minutes,
    otherDayMinutes: Minutes,
    reason: z.string(),
  })
  .strict();

export const ParentDailyLimitSchema = z
  .object({
    /** The limits in use for each day type (the parent's own, or the defaults). */
    settings: z.object({
      schoolDayMinutes: Minutes,
      otherDayMinutes: Minutes,
      examSeasonExtra: z.boolean(),
    }),
    /** Which day types use a limit the parent set by hand. */
    custom: z.object({ school: z.boolean(), other: z.boolean() }),
    defaults: PerDayType,
    ceilings: PerDayType,
    today: DailyLimitTodaySchema,
    suggestion: DailyLimitSuggestionSchema.nullable(),
  })
  .strict();
export type ParentDailyLimit = z.infer<typeof ParentDailyLimitSchema>;

/** A parent's change: a limit per day type (null goes back to the default) and the exam extra. */
export const UpdateDailyLimitRequestSchema = z
  .object({
    schoolDayMinutes: Limit.nullable().optional(),
    otherDayMinutes: Limit.nullable().optional(),
    examSeasonExtra: z.boolean().optional(),
  })
  .strict()
  .refine((u) => Object.keys(u).length > 0, 'Change at least one thing');
export type UpdateDailyLimitRequest = z.infer<typeof UpdateDailyLimitRequestSchema>;

export const DailyLimitSuggestionActionSchema = z
  .object({ action: z.enum(['accept', 'dismiss']) })
  .strict();
