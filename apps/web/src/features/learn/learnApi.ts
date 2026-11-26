import { createContext, useContext } from 'react';
import type { ZodType } from 'zod';
import {
  FlashcardReviewResponseSchema,
  FlashcardSessionResultSchema,
  FlashcardSessionSchema,
  FlashcardSchema,
  FlashcardsOverviewSchema,
  ItemHelpResponseSchema,
  LearnAttemptResponseSchema,
  LessonResponseSchema,
  ProgressSchema,
  StartingTestResponseSchema,
  StartingTestResultSchema,
  SubjectTopicsResponseSchema,
  type CreateFlashcardRequest,
  type Flashcard,
  type FlashcardReviewResponse,
  type FlashcardSession,
  type FlashcardSessionResult,
  type FlashcardsOverview,
  type LearnAttemptRequest,
  type LearnAttemptResponse,
  type LessonResponse,
  type Progress,
  type StartingTestResponse,
  type StartingTestResult,
  type SubjectTopicsResponse,
} from '@revisionden/core';
import { apiRequest } from '../../api/client';
import { defaultBaseUrl } from '../../api/ApiContext';

export type FlashcardRating = 'again' | 'hard' | 'good' | 'easy';

export interface LearnApi {
  getLesson(query: { topicId?: string; subjectId?: string }): Promise<LessonResponse>;
  getCommandWords(): Promise<LessonResponse>;
  getSubjectTopics(subjectId: string): Promise<SubjectTopicsResponse>;
  getProgress(): Promise<Progress>;
  startStartingTest(subjectId: string): Promise<StartingTestResponse>;
  finishStartingTest(id: string): Promise<StartingTestResult>;
  submitAttempt(attempt: LearnAttemptRequest): Promise<LearnAttemptResponse>;
  /** "Help me understand" (F10): the item's verified steps, ending on the answer. */
  getItemHelp(itemId: string): Promise<string[]>;
  /** Today's cards under the daily limit (F11); `extra` asks for more ("10 more"). */
  getFlashcards(extra?: number): Promise<FlashcardsOverview>;
  getDeck(topicId: string): Promise<Flashcard[]>;
  /** Starts a review session: deck XP is paid per completed session (F3). */
  /** Starts a review session; with a topic id, for that one deck. */
  startFlashcardSession(topicId?: string): Promise<FlashcardSession>;
  reviewFlashcard(
    id: string,
    rating: FlashcardRating,
    sessionId: string,
  ): Promise<FlashcardReviewResponse>;
  finishFlashcardSession(sessionId: string): Promise<FlashcardSessionResult>;
  createFlashcard(card: CreateFlashcardRequest): Promise<Flashcard>;
}

interface Options {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
}

/**
 * Client for the student learning routes (`/v1/student/...`). The student device session is
 * a cookie, so every request includes credentials. Every response is checked with the shared
 * schemas from `@revisionden/core`.
 */
export function createLearnApi({
  baseUrl,
  fetch = (...args) => globalThis.fetch(...args),
}: Options): LearnApi {
  const request = <T>(path: string, schema: ZodType<T>, body?: unknown): Promise<T> =>
    apiRequest({ baseUrl, fetch }, `v1/student/${path}`, schema, {
      method: body === undefined ? 'GET' : 'POST',
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  const enc = encodeURIComponent;
  return {
    getLesson: (query) => {
      const params = new URLSearchParams(
        Object.entries(query).filter((e): e is [string, string] => e[1] !== undefined),
      );
      return request(`learn/lesson?${params.toString()}`, LessonResponseSchema);
    },
    getCommandWords: () => request('learn/command-words', LessonResponseSchema),
    getSubjectTopics: (subjectId) =>
      request(`learn/subjects/${enc(subjectId)}/topics`, SubjectTopicsResponseSchema),
    getProgress: () => request('learn/progress', ProgressSchema),
    startStartingTest: (subjectId) =>
      request('learn/starting-tests', StartingTestResponseSchema, { subjectId }),
    finishStartingTest: (id) =>
      request(`learn/starting-tests/${enc(id)}/finish`, StartingTestResultSchema, {}),
    submitAttempt: (attempt) => request('learn/attempts', LearnAttemptResponseSchema, attempt),
    getItemHelp: async (itemId) =>
      (await request(`learn/items/${enc(itemId)}/help`, ItemHelpResponseSchema)).steps,
    getFlashcards: (extra) =>
      request(extra ? `flashcards?extra=${extra}` : 'flashcards', FlashcardsOverviewSchema),
    getDeck: (topicId) => request(`flashcards/decks/${enc(topicId)}`, FlashcardSchema.array()),
    startFlashcardSession: (topicId) =>
      request('flashcards/sessions', FlashcardSessionSchema, topicId ? { topicId } : {}),
    reviewFlashcard: (id, rating, sessionId) =>
      request(`flashcards/${enc(id)}/review`, FlashcardReviewResponseSchema, {
        rating,
        sessionId,
      }),
    finishFlashcardSession: (sessionId) =>
      request(`flashcards/sessions/${enc(sessionId)}/finish`, FlashcardSessionResultSchema, {}),
    createFlashcard: (card) => request('flashcards', FlashcardSchema, card),
  };
}

const LearnApiContext = createContext<LearnApi>(
  createLearnApi({ baseUrl: defaultBaseUrl(import.meta.env, window.location.origin) }),
);

export const LearnApiProvider = LearnApiContext.Provider;

export function useLearnApi(): LearnApi {
  return useContext(LearnApiContext);
}

/** "gcse-maths" → "GCSE Maths", "a-level-further-maths" → "A-Level Further Maths". */
export function subjectLabel(subjectId: string): string {
  const words = subjectId.replace(/^a-level-/, 'alevel-').split('-');
  return words
    .map((w) =>
      w === 'gcse' ? 'GCSE' : w === 'alevel' ? 'A-Level' : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(' ');
}
