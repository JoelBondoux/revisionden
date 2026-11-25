/**
 * Daily 5-a-day (docs/PRODUCT_RULES.md, Quick wins): a short mixed set from topics the student
 * has already practised, across their subjects, chosen by spaced repetition and weak spots.
 *
 * - Only practised topics (a last practice time no later than now); never brand-new topics.
 * - Spaced repetition: each topic's mastery drifts down with time since it was last practised,
 *   using the same 30-day half-life as topic mastery, so long-unpractised topics come up more.
 * - Then the usual next-item rules (`selectNextItems`): weak spots weigh more and come first,
 *   due flashcards before questions, never more than 3 in a row from one topic.
 * - With too few topics to keep the variety rule, the set is topped up from the same topics, so
 *   it still has 5 when there are 5 servable items.
 * - The API seeds the randomness with `dailySeed(studentId, day)` and stores the set for the day.
 */
import { z } from 'zod';
import { LearnItemSchema } from './learning-schemas';
import { MASTERY_HALF_LIFE_DAYS } from './mastery';
import { selectNextItems, type Candidate, type TopicState } from './next-item';
import type { Rng } from './rng';
import { DAY_MS } from './spaced-repetition';

export const DAILY_SET_SIZE = 5;

export interface DailyTopic extends TopicState {
  /** When the student last answered a question in this topic (ms), or null if never. */
  lastPractisedAt: number | null;
}

export interface SelectDailySetInput {
  topics: readonly DailyTopic[];
  candidates: readonly Candidate[];
  /** Milliseconds since the epoch. */
  now: number;
  rng: Rng;
  count?: number;
}

/** Mastery after drifting down since the topic was last practised (30-day half-life). */
export function effectiveMastery(mastery: number, lastPractisedAt: number, now: number): number {
  const days = Math.max(0, now - lastPractisedAt) / DAY_MS;
  return Math.round(mastery * 0.5 ** (days / MASTERY_HALF_LIFE_DAYS));
}

export function selectDailySet(input: SelectDailySetInput): Candidate[] {
  const { now } = input;
  const practised = input.topics.filter(
    (t): t is DailyTopic & { lastPractisedAt: number } =>
      t.lastPractisedAt !== null && t.lastPractisedAt <= now,
  );
  if (practised.length === 0) return [];
  const count = input.count ?? DAILY_SET_SIZE;
  const picked = selectNextItems({
    topics: practised.map((t) => ({
      topicId: t.topicId,
      subjectId: t.subjectId,
      mastery: effectiveMastery(t.mastery, t.lastPractisedAt, now),
    })),
    candidates: input.candidates,
    count,
    rng: input.rng,
  });
  if (picked.length >= count) return picked;
  // Top up from the practised topics, due flashcards first, keeping the topics' order.
  const topicIds = new Set(practised.map((t) => t.topicId));
  const used = new Set(picked.map((c) => c.itemId));
  const spare = input.candidates.filter(
    (c) =>
      topicIds.has(c.topicId) && !used.has(c.itemId) && (c.kind === 'question' || c.due === true),
  );
  const byKind = [
    ...spare.filter((c) => c.kind === 'flashcard'),
    ...spare.filter((c) => c.kind === 'question'),
  ];
  return [...picked, ...byKind.slice(0, count - picked.length)];
}

/** A stable seed for one student's set on one day (FNV-1a hash), so a reload shows the same set. */
export function dailySeed(studentId: string, day: string): number {
  let hash = 0x811c9dc5;
  for (const ch of `${studentId}|${day}`) {
    hash ^= ch.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

export interface DailySetProgress {
  /** The set's items already answered, in set order (the player skips these). */
  answeredItemIds: string[];
  answered: number;
  total: number;
  /** True once every item in the set has been answered (a set with no items is never done). */
  done: boolean;
}

/** How much of today's set is answered, from the item ids answered since the set was made. */
export function dailySetProgress(
  setItemIds: readonly string[],
  answeredIds: readonly string[],
): DailySetProgress {
  const answeredSet = new Set(answeredIds);
  const answeredItemIds = setItemIds.filter((id) => answeredSet.has(id));
  const answered = answeredItemIds.length;
  return {
    answeredItemIds,
    answered,
    total: setItemIds.length,
    done: setItemIds.length > 0 && answered === setItemIds.length,
  };
}

export const DailySetResponseSchema = z.object({
  /** The student's local day (YYYY-MM-DD) this set is for. */
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Empty when nothing has been practised yet: the map then shows no 5-a-day card. */
  items: z.array(LearnItemSchema),
  draftContent: z.boolean(),
  answeredItemIds: z.array(z.string()),
  answered: z.number().int().min(0),
  total: z.number().int().min(0),
  done: z.boolean(),
});
export type DailySetResponse = z.infer<typeof DailySetResponseSchema>;
