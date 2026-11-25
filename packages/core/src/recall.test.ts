import { describe, expect, it } from 'vitest';
import { createRng } from './rng';
import { RECALL_COUNT, selectRecallItems, type RecallTopic } from './recall';
import type { Candidate } from './next-item';

const topic = (topicId: string, mastery: number, practised = true): RecallTopic => ({
  topicId,
  subjectId: 'maths',
  mastery,
  practised,
});

const seen = (topicId: string, n: number): Candidate[] =>
  Array.from({ length: n }, (_, i) => ({
    itemId: `${topicId}-${i}`,
    topicId,
    kind: 'question' as const,
  }));

describe('recall checks', () => {
  it('are 2 questions', () => {
    expect(RECALL_COUNT).toBe(2);
  });

  it('only start a lesson on a topic the student has practised before', () => {
    expect(
      selectRecallItems({
        lessonTopicIds: ['new'],
        topics: [topic('new', 0, false), topic('old', 40)],
        seenItems: seen('old', 5),
        rng: createRng(1),
      }),
    ).toEqual([]);
  });

  it('ask about things from earlier lessons on other topics first', () => {
    const picked = selectRecallItems({
      lessonTopicIds: ['now'],
      topics: [topic('now', 50), topic('old-a', 30), topic('old-b', 70)],
      seenItems: [...seen('now', 5), ...seen('old-a', 5), ...seen('old-b', 5)],
      rng: createRng(4),
    });
    expect(picked).toHaveLength(2);
    expect(picked.every((c) => c.topicId !== 'now')).toBe(true);
  });

  it("fall back to the lesson topic's own earlier questions when nothing else has been seen", () => {
    const picked = selectRecallItems({
      lessonTopicIds: ['now'],
      topics: [topic('now', 50)],
      seenItems: seen('now', 5),
      rng: createRng(2),
    });
    expect(picked.map((c) => c.topicId)).toEqual(['now', 'now']);
  });

  it('use one from another topic and one from this one when only one other was seen', () => {
    const picked = selectRecallItems({
      lessonTopicIds: ['now'],
      topics: [topic('now', 50), topic('old', 30)],
      seenItems: [...seen('now', 3), ...seen('old', 1)],
      rng: createRng(2),
    });
    expect(picked.map((c) => c.topicId).sort()).toEqual(['now', 'old']);
  });

  it('never use flashcards or items from topics not practised', () => {
    const picked = selectRecallItems({
      lessonTopicIds: ['now'],
      topics: [topic('now', 50), topic('ghost', 10, false)],
      seenItems: [
        { itemId: 'card', topicId: 'now', kind: 'flashcard', due: true },
        ...seen('ghost', 3),
      ],
      rng: createRng(2),
    });
    expect(picked).toEqual([]);
  });

  it('are the same for the same seed', () => {
    const input = {
      lessonTopicIds: ['now'],
      topics: [topic('now', 50), topic('a', 20), topic('b', 80)],
      seenItems: [...seen('a', 6), ...seen('b', 6)],
    };
    expect(selectRecallItems({ ...input, rng: createRng(9) })).toEqual(
      selectRecallItems({ ...input, rng: createRng(9) }),
    );
  });
});
