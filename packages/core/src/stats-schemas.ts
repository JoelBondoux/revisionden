/**
 * Shared Zod schemas for the statistics dashboards (workstream K), used by the API and the
 * web app. Panels whose feature is not built yet (plan, school report, parent-set reward,
 * predicted grade, level) are null, which the web app shows as "Not set up yet", never zero.
 * No free text written by the student appears anywhere here.
 */
import { z } from 'zod';
import { STATS_PERIODS } from './stats';

const LocalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Percent = z.number().int().min(0).max(100);
const Count = z.number().int().min(0);

export const StatsPeriodSchema = z.enum(STATS_PERIODS);

export const StatsQuerySchema = z.object({ period: StatsPeriodSchema.default('week') });

const RangeSchema = z.object({ start: LocalDate, end: LocalDate, label: z.string() });

const BucketValueSchema = z.object({ start: LocalDate, label: z.string(), value: Count });

const Compared = <T extends z.ZodTypeAny>(value: T) =>
  z.object({ value, previous: value }).strict();

export const StudentStatsSchema = z
  .object({
    period: StatsPeriodSchema,
    range: RangeSchema,
    tiles: z.object({
      xp: Compared(Count),
      answered: z.object({ value: Count, correct: Count, previous: Count }),
      accuracy: Compared(Percent.nullable()),
      streak: z.object({ current: Count }),
    }),
    chart: z.object({
      buckets: z.array(BucketValueSchema),
      /** Daily goal (week) or weekly goal (term) in XP; null for the year. */
      goal: Count.nullable(),
    }),
    mastery: z.array(
      z.object({
        subjectId: z.string(),
        name: z.string(),
        mastery: Percent,
        change: z.number().int(),
      }),
    ),
    personalBests: z.object({
      longestStreak: Count,
      longestCorrectRun: Count,
      bestWeek: z.object({ weekStart: LocalDate, xp: Count }).nullable(),
    }),
    /** Target grades a parent has set (workstream K8), read-only for the student. */
    targets: z.array(
      z.object({ subjectId: z.string(), name: z.string(), targetGrade: z.string() }),
    ),
    /** Level progress from the rewards progression (workstream R); null until it lands. */
    level: z
      .object({ level: z.number().int().min(1), xpIntoLevel: Count, xpForNextLevel: Count })
      .nullable(),
  })
  .strict();
export type StudentStats = z.infer<typeof StudentStatsSchema>;

export const ActivityEntrySchema = z
  .object({
    kind: z.enum(['lesson', 'test', 'starting_test', 'flashcards']),
    at: z.string().datetime(),
    count: z.number().int().min(1),
    subjectId: z.string().nullable(),
  })
  .strict();

export const ParentDashboardSchema = z
  .object({
    student: z.object({ id: z.string().uuid(), nickname: z.string() }),
    week: RangeSchema,
    timeZone: z.string(),
    tiles: z.object({
      activeMinutes: Compared(Count),
      /** Plan sessions done of planned; null until the study plan exists ("No plan yet"). */
      planKept: z.object({ done: Count, planned: Count }).nullable(),
      accuracy: Compared(Percent.nullable()),
      streak: z.object({ current: Count, best: Count }),
    }),
    studyTime: z.object({
      /** Active study minutes for each of the last 8 weeks, oldest first. */
      weeks: z.array(BucketValueSchema),
      planMinutes: Count.nullable(),
    }),
    subjects: z.array(
      z.object({
        subjectId: z.string(),
        name: z.string(),
        mastery: Percent,
        /** Change in mastery over the last 4 weeks. */
        change: z.number().int(),
        predictedGrade: z.string().nullable(),
        targetGrade: z.string().nullable(),
      }),
    ),
    weakSpots: z.array(
      z.object({
        topicId: z.string(),
        title: z.string(),
        subjectId: z.string(),
        then: Percent,
        now: Percent,
      }),
    ),
    /** Latest school report effort scores, on the school's own scale; null until entered. */
    effortScores: z
      .object({
        date: LocalDate,
        scores: z.array(z.object({ label: z.string(), value: z.string(), scale: z.string() })),
      })
      .nullable(),
    /**
     * Parent-set rewards with progress (workstream R5, `ParentReward` in rewards-schemas), not
     * yet given ones first. Empty shows "Not set up yet". The note to the student is left out.
     */
    rewards: z.array(
      z
        .object({
          title: z.string().max(60),
          targetLabel: z.string(),
          current: z.number().min(0),
          goal: z.number().min(0),
          reached: z.boolean(),
          given: z.boolean(),
        })
        .strict(),
    ),
    healthyHabits: z.object({
      quietHourSessions: Count,
      daysOverCap: Count,
      restDays: Count,
      dailyCapMinutes: Count,
    }),
    aiSpend: z.object({
      month: z.string().regex(/^\d{4}-\d{2}$/),
      spentMicroUsd: Count,
      capMicroUsd: Count,
    }),
    recentActivity: z.array(ActivityEntrySchema).max(10),
  })
  .strict();
export type ParentDashboard = z.infer<typeof ParentDashboardSchema>;
