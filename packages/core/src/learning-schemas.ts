/**
 * Request and response schemas for the learning loop (workstream F): lessons, the starting
 * test, attempts, progress and flashcards. Answers are never sent with a question; flashcards
 * are the exception (the back is the answer the student checks themselves against).
 */
import { z } from 'zod';
import { RewardCardSchema } from './rewards-schemas';
import { IdSchema, IsoDateTimeSchema, ModeSchema } from './schemas';

const text = z.string().min(1);

const itemBase = {
  id: IdSchema,
  topicId: text,
  topicTitle: text,
  /** True for unverified content, only ever served with the development flag on. */
  draft: z.boolean(),
  hint: text.optional(),
};

export const LearnItemSchema = z.discriminatedUnion('type', [
  z.object({
    ...itemBase,
    type: z.literal('multiple_choice'),
    prompt: text,
    options: z.array(text).min(2).max(6),
  }),
  z.object({ ...itemBase, type: z.literal('short_answer'), prompt: text }),
  z.object({ ...itemBase, type: z.literal('numeric'), prompt: text, unit: text.optional() }),
  z.object({ ...itemBase, type: z.literal('worked_maths'), prompt: text }),
  z.object({ ...itemBase, type: z.literal('extended_answer'), prompt: text }),
  z.object({
    ...itemBase,
    type: z.literal('flashcard'),
    front: text,
    back: text,
    sourceRef: text.optional(),
  }),
]);
export type LearnItem = z.infer<typeof LearnItemSchema>;

export const LessonResponseSchema = z.object({
  items: z.array(LearnItemSchema),
  /** True when any item served is a draft: the app shows a "DRAFT CONTENT" banner. */
  draftContent: z.boolean(),
});
export type LessonResponse = z.infer<typeof LessonResponseSchema>;

// Starting test

export const StartingTestRequestSchema = z.object({ subjectId: text }).strict();

export const StartingTestResponseSchema = LessonResponseSchema.extend({
  id: IdSchema,
  subjectId: text,
  timeLimitSeconds: z.number().int().positive(),
});
export type StartingTestResponse = z.infer<typeof StartingTestResponseSchema>;

export const TopicMasterySchema = z.object({
  topicId: text,
  title: text,
  /** 0 to 100. */
  mastery: z.number().int().min(0).max(100),
});
export type TopicMastery = z.infer<typeof TopicMasterySchema>;

export const StartingTestResultSchema = z.object({
  id: IdSchema,
  correct: z.number().int().min(0),
  answered: z.number().int().min(0),
  total: z.number().int().min(0),
  topics: z.array(TopicMasterySchema),
  /** Test mode combos are shown at the reveal (docs/GAME_FEEL.md): the best run and its bonus. */
  bestCombo: z.number().int().min(0).optional(),
  comboBonusXp: z.number().int().min(0).optional(),
});
export type StartingTestResult = z.infer<typeof StartingTestResultSchema>;

// Attempts and progress

export const LearnAnswerSchema = z.union([
  z.number().int().min(0),
  z.string().max(500),
  z.object({ lines: z.array(z.string().max(200)).min(1).max(30) }).strict(),
  z.boolean(),
]);

export const LearnAttemptRequestSchema = z
  .object({
    itemId: IdSchema,
    answer: LearnAnswerSchema,
    timeMs: z.number().int().min(0),
    mode: ModeSchema,
    startingTestId: IdSchema.optional(),
  })
  .strict();
export type LearnAttemptRequest = z.infer<typeof LearnAttemptRequestSchema>;

export const ProgressSchema = z.object({
  xpToday: z.number().int().min(0),
  totalXp: z.number().int().min(0),
  dailyGoalXp: z.number().int().positive(),
  goalMet: z.boolean(),
  streak: z.object({
    current: z.number().int().min(0),
    best: z.number().int().min(0),
    skipDays: z.number().int().min(0),
  }),
});
export type Progress = z.infer<typeof ProgressSchema>;

export const FeedbackSchema = z.object({
  correctAnswer: text,
  explanation: text.optional(),
  /** For maths working: the 0-based line that first goes wrong, or null if none. */
  firstWrongLine: z.number().int().min(0).nullable().optional(),
});
export type Feedback = z.infer<typeof FeedbackSchema>;

export const LearnAttemptResponseSchema = z.object({
  id: IdSchema,
  itemId: IdSchema,
  correct: z.boolean(),
  score: z.number().min(0).max(1),
  xpEarned: z.number().int().min(0),
  createdAt: IsoDateTimeSchema,
  /** Instant feedback (feedback level 1) in learn mode; null in test mode. */
  feedback: FeedbackSchema.nullable(),
  progress: ProgressSchema,
  /** True when a wrong answer was turned into a flashcard. */
  flashcardAdded: z.boolean(),
  /** Learn mode: right answers in a row, this one included (0 in Test mode until the reveal). */
  combo: z.number().int().min(0).optional(),
  /** The combo bonus included in xpEarned (+5 from the 3rd in a row). */
  comboBonusXp: z.number().int().min(0).optional(),
  /** Rewards this answer earned, saved once each (play the reward sound and show them). */
  newlyEarned: z.array(RewardCardSchema),
});
export type LearnAttemptResponse = z.infer<typeof LearnAttemptResponseSchema>;

export const SubjectTopicsResponseSchema = z.object({
  subjectId: text,
  startingTestDone: z.boolean(),
  topics: z.array(TopicMasterySchema.extend({ items: z.number().int().min(0) })),
});
export type SubjectTopicsResponse = z.infer<typeof SubjectTopicsResponseSchema>;

// Flashcards

export const FlashcardRatingSchema = z.enum(['again', 'hard', 'good', 'easy']);

export const FlashcardSchema = z.object({
  id: IdSchema,
  topicId: text,
  topicTitle: text,
  subjectId: text,
  /** deck: from the content; wrong_answer: made from a missed question; own: written by the student. */
  origin: z.enum(['deck', 'wrong_answer', 'own']),
  front: text,
  back: text,
  /** Specification reference of the content behind the card (not for the student's own cards). */
  sourceRef: text.optional(),
  draft: z.boolean(),
  dueAt: IsoDateTimeSchema,
  /** Milliseconds until the card comes back for each rating. */
  nextReviewMs: z.record(FlashcardRatingSchema, z.number().int().min(0)),
});
export type Flashcard = z.infer<typeof FlashcardSchema>;

export const FlashcardDeckSchema = z.object({
  topicId: text,
  title: text,
  subjectId: text,
  total: z.number().int().min(0),
  due: z.number().int().min(0),
});
export type FlashcardDeck = z.infer<typeof FlashcardDeckSchema>;

export const FlashcardsOverviewSchema = z.object({
  due: z.array(FlashcardSchema),
  decks: z.array(FlashcardDeckSchema),
  mine: z.array(FlashcardSchema),
  draftContent: z.boolean(),
});
export type FlashcardsOverview = z.infer<typeof FlashcardsOverviewSchema>;

// Flashcard sessions: deck XP is per completed session, not per card (see flashcard-session.ts).

export const FlashcardSessionSchema = z.object({
  id: IdSchema,
  maxCards: z.number().int().positive(),
  minCards: z.number().int().positive(),
  /** XP for a completed session of at least minCards cards. */
  xp: z.number().int().min(0),
  /** Rewarded sessions still possible today (UK day). */
  rewardedLeftToday: z.number().int().min(0),
});
export type FlashcardSession = z.infer<typeof FlashcardSessionSchema>;

/** Optional deck scope: completion is then checked within that topic's cards only. */
export const FlashcardSessionRequestSchema = z.object({ topicId: text.optional() }).strict();
export type FlashcardSessionRequest = z.infer<typeof FlashcardSessionRequestSchema>;

export const FlashcardReviewRequestSchema = z
  .object({ rating: FlashcardRatingSchema, sessionId: IdSchema })
  .strict();

export const FlashcardReviewResponseSchema = z.object({
  card: FlashcardSchema,
  /** True when the card comes back today (rated Again). */
  comesBackSooner: z.boolean(),
  /** Different cards counted in this session so far (Again repeats count once). */
  cardsCounted: z.number().int().min(0),
});
export type FlashcardReviewResponse = z.infer<typeof FlashcardReviewResponseSchema>;

export const FlashcardSessionResultSchema = z.object({
  completed: z.boolean(),
  reason: z.enum(['rewarded', 'left_early', 'too_few_cards', 'daily_limit']),
  xpEarned: z.number().int().min(0),
  cardsCounted: z.number().int().min(0),
  rewardedLeftToday: z.number().int().min(0),
  progress: ProgressSchema,
  /** Rewards this session earned, saved once each. */
  newlyEarned: z.array(RewardCardSchema),
});
export type FlashcardSessionResult = z.infer<typeof FlashcardSessionResultSchema>;

const cardText = z
  .string()
  .max(300)
  .refine((v) => v.trim().length > 0, 'Required');

export const CreateFlashcardRequestSchema = z
  .object({ topicId: text, front: cardText, back: cardText })
  .strict();
export type CreateFlashcardRequest = z.infer<typeof CreateFlashcardRequestSchema>;
