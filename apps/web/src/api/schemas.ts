import { z } from 'zod';

/*
 * TODO(workstream C): these are temporary local schemas. Replace them with the shared Zod
 * schemas from `@revisionden/core` once workstream C publishes them, and delete this file.
 */

export const studentSchema = z.object({
  id: z.string(),
  nickname: z.string(),
  avatarCode: z.string(),
  yearGroup: z.number().int().min(9).max(13),
});

export const familySchema = z.object({
  students: z.array(studentSchema),
});

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

const multipleChoiceItemSchema = z.object({
  id: z.string(),
  type: z.literal('multiple-choice'),
  prompt: z.string(),
  options: z.array(z.object({ id: z.string(), text: z.string() })).min(2),
});

const shortAnswerItemSchema = z.object({
  id: z.string(),
  type: z.literal('short-answer'),
  prompt: z.string(),
});

export const lessonItemSchema = z.discriminatedUnion('type', [
  multipleChoiceItemSchema,
  shortAnswerItemSchema,
]);

export const lessonSchema = z.object({
  id: z.string(),
  title: z.string(),
  topic: z.string(),
  items: z.array(lessonItemSchema).min(1),
});

export const answerRequestSchema = z.object({
  itemId: z.string(),
  answer: z.string(),
});

export const answerResultSchema = z.object({
  correct: z.boolean(),
  correctAnswer: z.string(),
  explanation: z.string(),
  xpEarned: z.number().int().nonnegative(),
});

export type Student = z.infer<typeof studentSchema>;
export type Family = z.infer<typeof familySchema>;
export type TopicStatus = z.infer<typeof topicStatusSchema>;
export type Topic = z.infer<typeof topicSchema>;
export type UnitChallenge = z.infer<typeof unitChallengeSchema>;
export type Unit = z.infer<typeof unitSchema>;
export type NextMission = z.infer<typeof nextMissionSchema>;
export type TopicMap = z.infer<typeof topicMapSchema>;
export type CardsDue = z.infer<typeof cardsDueSchema>;
export type LessonItem = z.infer<typeof lessonItemSchema>;
export type Lesson = z.infer<typeof lessonSchema>;
export type AnswerRequest = z.infer<typeof answerRequestSchema>;
export type AnswerResult = z.infer<typeof answerResultSchema>;
