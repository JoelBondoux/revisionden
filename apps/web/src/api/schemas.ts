import { z } from 'zod';

/*
 * TODO(workstream C): these are temporary local schemas. Replace them with the shared Zod
 * schemas from `@revisionden/core` once workstream C publishes them, and delete this file.
 */

export const studentSchema = z.object({
  id: z.string(),
  nickname: z.string(),
  avatarCode: z.string(),
  yearGroup: z.number().int().min(7).max(13),
});

export const familySchema = z.object({
  students: z.array(studentSchema),
});

export const pathNodeStatusSchema = z.enum(['done', 'current', 'locked', 'weak']);

export const pathNodeSchema = z.object({
  id: z.string(),
  title: z.string(),
  lessonId: z.string(),
  status: pathNodeStatusSchema,
});

export const pathUnitSchema = z.object({
  id: z.string(),
  title: z.string(),
  nodes: z.array(pathNodeSchema),
});

export const learningPathSchema = z.object({
  subject: z.string(),
  qualification: z.string(),
  streakDays: z.number().int().nonnegative(),
  xpToday: z.number().int().nonnegative(),
  dailyGoalXp: z.number().int().positive(),
  units: z.array(pathUnitSchema),
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
export type PathNodeStatus = z.infer<typeof pathNodeStatusSchema>;
export type PathNode = z.infer<typeof pathNodeSchema>;
export type PathUnit = z.infer<typeof pathUnitSchema>;
export type LearningPath = z.infer<typeof learningPathSchema>;
export type LessonItem = z.infer<typeof lessonItemSchema>;
export type Lesson = z.infer<typeof lessonSchema>;
export type AnswerRequest = z.infer<typeof answerRequestSchema>;
export type AnswerResult = z.infer<typeof answerResultSchema>;
