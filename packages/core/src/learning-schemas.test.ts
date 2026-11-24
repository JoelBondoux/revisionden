import { describe, expect, it } from 'vitest';
import {
  CreateFlashcardRequestSchema,
  FlashcardReviewRequestSchema,
  FlashcardSchema,
  LearnAttemptRequestSchema,
  LearnAttemptResponseSchema,
  LearnItemSchema,
  LessonResponseSchema,
  StartingTestRequestSchema,
} from './learning-schemas';

const ID = '00000000-0000-4000-8000-000000000001';
const base = { id: ID, topicId: 'test-topic-1', topicTitle: 'Test topic 1', draft: false };

describe('learning schemas', () => {
  it('accepts each item type with its own fields', () => {
    const items = [
      { ...base, type: 'multiple_choice', prompt: 'Test question 1', options: ['A', 'B'] },
      { ...base, type: 'short_answer', prompt: 'Test question 2' },
      { ...base, type: 'numeric', prompt: 'Test question 3', unit: 'cm' },
      { ...base, type: 'worked_maths', prompt: 'Test question 4' },
      { ...base, type: 'extended_answer', prompt: 'Test question 5' },
      { ...base, type: 'flashcard', front: 'Test front', back: 'Test back' },
    ];
    for (const item of items) expect(LearnItemSchema.parse(item)).toMatchObject(item);
    expect(LessonResponseSchema.parse({ items, draftContent: false }).items).toHaveLength(6);
  });

  it('rejects a multiple choice item with one option', () => {
    expect(
      LearnItemSchema.safeParse({ ...base, type: 'multiple_choice', prompt: 'Q', options: ['A'] })
        .success,
    ).toBe(false);
  });

  it('accepts an option number, text, working lines or a flashcard self-check as an answer', () => {
    for (const answer of [1, 'text', { lines: ['x = 1'] }, true]) {
      expect(
        LearnAttemptRequestSchema.safeParse({ itemId: ID, answer, timeMs: 100, mode: 'learn' })
          .success,
      ).toBe(true);
    }
  });

  it('rejects empty working and very long answers', () => {
    const bad = [{ lines: [] }, 'x'.repeat(501), { lines: ['x'.repeat(201)] }];
    for (const answer of bad) {
      expect(
        LearnAttemptRequestSchema.safeParse({ itemId: ID, answer, timeMs: 1, mode: 'learn' })
          .success,
      ).toBe(false);
    }
  });

  it('allows no feedback in test mode', () => {
    const progress = {
      xpToday: 0,
      totalXp: 0,
      dailyGoalXp: 50,
      goalMet: false,
      streak: { current: 0, best: 0, skipDays: 0 },
    };
    const parsed = LearnAttemptResponseSchema.parse({
      id: ID,
      itemId: ID,
      correct: true,
      score: 1,
      xpEarned: 15,
      createdAt: '2026-11-24T10:00:00.000Z',
      feedback: null,
      progress,
      flashcardAdded: false,
    });
    expect(parsed.feedback).toBeNull();
  });

  it('describes a flashcard with when it comes back for each rating', () => {
    const card = {
      id: ID,
      topicId: 'test-topic-1',
      topicTitle: 'Test topic 1',
      subjectId: 'test-subject',
      origin: 'own',
      front: 'Test front',
      back: 'Test back',
      draft: false,
      dueAt: '2026-11-24T10:00:00.000Z',
      nextReviewMs: { again: 600000, hard: 1, good: 1, easy: 1 },
    };
    expect(FlashcardSchema.parse(card)).toMatchObject(card);
  });

  it('checks flashcard requests', () => {
    expect(FlashcardReviewRequestSchema.safeParse({ rating: 'good' }).success).toBe(true);
    expect(FlashcardReviewRequestSchema.safeParse({ rating: 'perfect' }).success).toBe(false);
    expect(
      CreateFlashcardRequestSchema.safeParse({ topicId: 't', front: 'f', back: 'b' }).success,
    ).toBe(true);
    expect(
      CreateFlashcardRequestSchema.safeParse({ topicId: 't', front: ' ', back: 'b' }).success,
    ).toBe(false);
    expect(
      CreateFlashcardRequestSchema.safeParse({ topicId: 't', front: 'f'.repeat(301), back: 'b' })
        .success,
    ).toBe(false);
  });

  it('needs a subject to start a starting test', () => {
    expect(StartingTestRequestSchema.safeParse({ subjectId: 'gcse-maths' }).success).toBe(true);
    expect(StartingTestRequestSchema.safeParse({}).success).toBe(false);
  });
});
