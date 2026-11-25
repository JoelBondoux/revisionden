/**
 * Recall checks (docs/PRODUCT_RULES.md, Quick wins): at the start of a lesson on a topic the
 * student has practised before, 2 quick questions on things learned in earlier lessons
 * ("Remember this?").
 *
 * - Only when a lesson topic has been practised before; otherwise none.
 * - From questions the student has already answered (never flashcards, never unpractised topics),
 *   on other topics first; the lesson's own topics only fill any gap.
 * - Chosen with the normal next-item rules: weak spots weigh more and come first.
 * - Answers are normal Learn mode answers: right ones earn normal XP, wrong ones lower mastery
 *   no more than any answer and become flashcards. They can be skipped.
 */
import { selectNextItems, type Candidate, type TopicState } from './next-item';
import type { Rng } from './rng';

export const RECALL_COUNT = 2;

export interface RecallTopic extends TopicState {
  /** True when the student has answered at least one question in the topic. */
  practised: boolean;
}

export interface SelectRecallInput {
  /** The lesson's topic, or a unit's topics for a unit challenge. */
  lessonTopicIds: readonly string[];
  topics: readonly RecallTopic[];
  /** Items the student has answered before. */
  seenItems: readonly Candidate[];
  rng: Rng;
  count?: number;
}

export function selectRecallItems(input: SelectRecallInput): Candidate[] {
  const count = input.count ?? RECALL_COUNT;
  const lesson = new Set(input.lessonTopicIds);
  const practised = input.topics.filter((t) => t.practised);
  if (!practised.some((t) => lesson.has(t.topicId))) return [];
  const practisedIds = new Set(practised.map((t) => t.topicId));
  const questions = input.seenItems.filter(
    (c) => c.kind === 'question' && practisedIds.has(c.topicId),
  );
  const pick = (topicFilter: (id: string) => boolean, n: number) =>
    n <= 0
      ? []
      : selectNextItems({
          topics: practised.filter((t) => topicFilter(t.topicId)),
          candidates: questions.filter((c) => topicFilter(c.topicId)),
          count: n,
          rng: input.rng,
        });
  const others = pick((id) => !lesson.has(id), count);
  return [...others, ...pick((id) => lesson.has(id), count - others.length)];
}
