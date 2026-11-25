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
export type LessonItem = z.infer<typeof lessonItemSchema>;
export type Lesson = z.infer<typeof lessonSchema>;
export type AnswerRequest = z.infer<typeof answerRequestSchema>;
export type AnswerResult = z.infer<typeof answerResultSchema>;
