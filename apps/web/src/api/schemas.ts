import { z } from 'zod';

/*
 * Topic map and cards-due shapes for the student device. Workstream F2 moves these into
 * `@revisionden/core` with the API endpoints (GET /v1/student/map and /v1/student/cards/due).
 * Everything else the web app reads uses the shared schemas in core.
 */

export const topicStatusSchema = z.enum(['mastered', 'in-progress', 'weak', 'locked']);

export const topicSchema = z.object({
  id: z.string(),
  title: z.string(),
  lessonId: z.string(),
  status: topicStatusSchema,
  /** Topic mastery, 0 to 100. */
  mastery: z.number().int().min(0).max(100),
});

export const unitChallengeSchema = z.object({
  lessonId: z.string(),
  unlockAtPercent: z.number().int().min(0).max(100),
  unlocked: z.boolean(),
});

export const unitSchema = z.object({
  id: z.string(),
  title: z.string(),
  masteryPercent: z.number().int().min(0).max(100),
  topics: z.array(topicSchema),
  challenge: unitChallengeSchema,
});

export const nextMissionSchema = z.object({
  kind: z.enum(['weak-spot', 'continue', 'review']),
  title: z.string(),
  lessonId: z.string(),
  minutes: z.number().int().positive(),
});

export const topicMapSchema = z.object({
  subject: z.string(),
  qualification: z.string(),
  streakDays: z.number().int().nonnegative(),
  xpToday: z.number().int().nonnegative(),
  dailyGoalXp: z.number().int().positive(),
  nextMission: nextMissionSchema.nullable(),
  units: z.array(unitSchema),
});

export const cardsDueSchema = z.object({
  due: z.number().int().nonnegative(),
});

export type TopicStatus = z.infer<typeof topicStatusSchema>;
export type Topic = z.infer<typeof topicSchema>;
export type UnitChallenge = z.infer<typeof unitChallengeSchema>;
export type Unit = z.infer<typeof unitSchema>;
export type NextMission = z.infer<typeof nextMissionSchema>;
export type TopicMap = z.infer<typeof topicMapSchema>;
export type CardsDue = z.infer<typeof cardsDueSchema>;
