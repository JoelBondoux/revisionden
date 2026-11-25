/**
 * Stats for the hidden tracks added in R7b (see docs/REWARDS.md "More hidden tracks"). Pure:
 * the API loads records and passes them in. All learning-based; none measure time spent.
 */
import { topicMastery, WEAK_SPOT_THRESHOLD } from './mastery';

/** A topic is "strong" from this mastery (the Comeback Kid line). */
export const STRONG_TOPIC_MASTERY = 80;
/** Answers needed in a topic before a low mastery counts as a real weak spot. */
export const WEAK_SPOT_MIN_ANSWERS = 3;

export interface TopicAnswer {
  topicId: string;
  /** Time in ms. */
  at: number;
  /** Fraction of marks, 0 to 1. */
  score: number;
}

/** Topics that were a weak spot (below 60, after 3+ answers) and later reached 80+ mastery. */
export function weakSpotsTurnedStrong(answers: readonly TopicAnswer[]): number {
  const byTopic = new Map<string, TopicAnswer[]>();
  for (const a of answers) byTopic.set(a.topicId, [...(byTopic.get(a.topicId) ?? []), a]);
  let count = 0;
  for (const list of byTopic.values()) {
    const sorted = [...list].sort((a, b) => a.at - b.at);
    let wasWeak = false;
    for (let i = 0; i < sorted.length; i++) {
      const mastery = topicMastery(
        sorted.slice(0, i + 1).map((a) => ({ at: a.at, score: a.score })),
        sorted[i]!.at,
      );
      if (i + 1 >= WEAK_SPOT_MIN_ANSWERS && mastery < WEAK_SPOT_THRESHOLD) wasWeak = true;
      if (wasWeak && mastery >= STRONG_TOPIC_MASTERY) {
        count += 1;
        break;
      }
    }
  }
  return count;
}

/** The kinds of practice the Explorer track counts (first use of each). */
export const PRACTICE_KINDS = [
  'lesson',
  'flashcardSession',
  'startingTest',
  'timedPaper',
  'workedMaths',
  'homeworkMarking',
  'planEdit',
] as const;
export type PracticeKind = (typeof PRACTICE_KINDS)[number];

export function practiceKindsTried(used: Partial<Record<PracticeKind, boolean>>): number {
  return PRACTICE_KINDS.filter((kind) => used[kind]).length;
}
