import { describe, expect, it } from 'vitest';
import {
  EXPECTED_SECONDS,
  REVIEW_LADDER_DAYS,
  RETRY_WEIGHT,
  PARK_AFTER_MISSES,
  dueReviewPoints,
  endOnSuccess,
  expectedSeconds,
  planAfterMiss,
  isShaky,
  learningPointOf,
  reviewAfterAnswer,
  type LessonEntry,
} from './mistakes';

const fixed = (value: number) => () => value;

describe('expected time for a question', () => {
  it('has a rough guide per question type', () => {
    expect(expectedSeconds('multiple_choice')).toBe(EXPECTED_SECONDS.multiple_choice);
    expect(expectedSeconds('worked_maths')).toBeGreaterThan(expectedSeconds('numeric')!);
  });

  it('uses the item’s own expected time when it has one', () => {
    expect(expectedSeconds('multiple_choice', 45)).toBe(45);
  });

  it('never times long answers (they are not marked yet)', () => {
    expect(expectedSeconds('extended_answer')).toBeNull();
  });
});

describe('slow means shaky', () => {
  const base = { type: 'multiple_choice' as const, correct: true };
  const limit = 2 * EXPECTED_SECONDS.multiple_choice * 1000;

  it('marks a right answer that took more than twice the expected time as shaky', () => {
    expect(isShaky({ ...base, timeMs: limit + 1 })).toBe(true);
    expect(isShaky({ ...base, timeMs: limit })).toBe(false);
  });

  it('never marks a wrong answer or a long answer as shaky', () => {
    expect(isShaky({ ...base, correct: false, timeMs: limit * 5 })).toBe(false);
    expect(isShaky({ type: 'extended_answer', correct: true, timeMs: 10 ** 9 })).toBe(false);
  });

  it('follows the item’s own expected time', () => {
    expect(isShaky({ ...base, expectedSeconds: 60, timeMs: limit + 1 })).toBe(false);
  });
});

describe('learning point', () => {
  it('is the item’s learning point tag, or its topic when it has none', () => {
    expect(learningPointOf({ topicId: 't1', learningPoint: 'lp-a' })).toBe('lp-a');
    expect(learningPointOf({ topicId: 't1', learningPoint: null })).toBe('t1');
    expect(learningPointOf({ topicId: 't1' })).toBe('t1');
  });
});

describe('in-lesson retry', () => {
  type I = { id: string; point: string };
  const q = (...ids: string[]): LessonEntry<I>[] => ids.map((id) => ({ item: { id, point: id } }));
  const it_ = (id: string, point = id): I => ({ id, point });
  const pointOf = (i: I) => i.point;
  const show = (queue: LessonEntry<I>[]) =>
    queue.map((e) => e.item.id + (e.reason ? `(${e.reason})` : ''));
  const plan = (
    queue: LessonEntry<I>[],
    index: number,
    found: { similar?: I; easier?: I; confidence?: I } = {},
    rng = fixed(0),
  ) => planAfterMiss(queue, index, { ...found, pointOf }, rng);

  it('puts a similar question 2 to 4 questions later, after a confidence question', () => {
    const queue = q('a', 'b', 'c', 'd', 'e', 'f');
    const result = plan(queue, 0, { similar: it_('x', 'a'), confidence: it_('k') });
    expect(result.outcome).toBe('retry');
    expect(show(result.queue)).toEqual([
      'a',
      'b',
      'c',
      'k(confidence)',
      'x(similar)',
      'd',
      'e',
      'f',
    ]);
    expect(show(plan(queue, 0, { similar: it_('x', 'a') }, fixed(0.99)).queue)).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
      'x(similar)',
      'f',
    ]);
  });

  it('brings the same question back at the end when there is no similar one', () => {
    const result = plan(q('a', 'b', 'c'), 1);
    expect(show(result.queue)).toEqual(['a', 'b', 'c', 'b(again)']);
  });

  it('retries each learning point at most once a lesson, and steps down to an easier one', () => {
    const first = plan(q('a', 'b', 'c'), 0, { similar: it_('x', 'a') });
    const retryAt = first.queue.findIndex((e) => e.reason === 'similar');
    const second = plan(first.queue, retryAt, { easier: it_('e', 'a') });
    expect(second.outcome).toBe('stepDown');
    expect(show(second.queue).slice(retryAt, retryAt + 2)).toEqual(['x(similar)', 'e(easier)']);
    expect(second.queue.filter((e) => e.reason === 'similar' || e.reason === 'again')).toHaveLength(
      1,
    );
  });

  it('counts a second miss on the same point in a later question as a step down too', () => {
    const queue: LessonEntry<I>[] = [
      { item: it_('a', 'p') },
      { item: it_('b') },
      { item: it_('c', 'p') },
    ];
    const first = plan(queue, 0);
    const result = plan(first.queue, 2);
    expect(result.outcome).toBe('stepDown');
  });

  it('allows at most 2 retries a lesson', () => {
    let queue = q('a', 'b', 'c', 'd');
    queue = plan(queue, 0).queue;
    queue = plan(queue, 1).queue;
    const third = plan(queue, 2);
    expect(third.outcome).toBe('none');
    expect(third.queue).toBe(queue);
  });

  it('never puts two retries in a row: a confidence question goes between them', () => {
    let queue = q('a', 'b');
    queue = plan(queue, 0).queue;
    const withConfidence = plan(queue, 1, { confidence: it_('k') });
    expect(show(withConfidence.queue)).toEqual(['a', 'b', 'a(again)', 'k(confidence)', 'b(again)']);
    // Without one, the second point waits for the review ladder instead.
    const without = plan(queue, 1);
    expect(without.outcome).toBe('none');
    expect(without.queue).toBe(queue);
  });

  it('ends a lesson on a success: a confidence question after a wrong last answer', () => {
    const queue = q('a', 'b');
    expect(show(endOnSuccess(queue, false, it_('k')))).toEqual(['a', 'b', 'k(confidence)']);
    expect(endOnSuccess(queue, true, it_('k'))).toBe(queue);
    expect(endOnSuccess(queue, false, null)).toBe(queue);
  });
});

describe('review ladder across sessions', () => {
  const at = (rung: number, dueDay: string, misses = 0) => ({
    rung,
    dueDay,
    misses,
    flagged: false,
  });

  it('brings a missed learning point back the next day', () => {
    expect(reviewAfterAnswer(null, 'wrong', '2026-11-25')).toEqual(at(0, '2026-11-26'));
    expect(reviewAfterAnswer(null, 'shaky', '2026-11-25')).toEqual(at(0, '2026-11-26'));
  });

  it('leaves nothing on the ladder for a right answer that was not on it', () => {
    expect(reviewAfterAnswer(null, 'right', '2026-11-25')).toBeNull();
  });

  it('climbs 1, 3 then 7 days with each right answer on time, then leaves the ladder', () => {
    expect(REVIEW_LADDER_DAYS).toEqual([1, 3, 7]);
    const day1 = reviewAfterAnswer(at(0, '2026-11-26'), 'right', '2026-11-26');
    expect(day1).toEqual(at(1, '2026-11-29'));
    const day3 = reviewAfterAnswer(day1, 'right', '2026-11-29');
    expect(day3).toEqual(at(2, '2026-12-06'));
    expect(reviewAfterAnswer(day3, 'right', '2026-12-06')).toBeNull();
  });

  it('ignores a right answer before the point is due (for example the retry in the lesson)', () => {
    const point = at(0, '2026-11-26');
    expect(reviewAfterAnswer(point, 'right', '2026-11-25')).toBe(point);
  });

  it('starts again from the next day after a wrong or slow answer on a visit', () => {
    expect(reviewAfterAnswer(at(2, '2026-12-06'), 'shaky', '2026-12-06')).toEqual(
      at(0, '2026-12-07', 1),
    );
  });

  it('does not count a miss before the point is due as a ladder visit', () => {
    expect(reviewAfterAnswer(at(0, '2026-11-26', 1), 'wrong', '2026-11-25')).toEqual(
      at(0, '2026-11-26', 1),
    );
  });

  it('parks a point missed on 3 ladder visits for a week and flags it as worth a look', () => {
    expect(PARK_AFTER_MISSES).toBe(3);
    expect(reviewAfterAnswer(at(0, '2026-11-28', 2), 'wrong', '2026-11-28')).toEqual({
      rung: 0,
      dueDay: '2026-12-05',
      misses: 0,
      flagged: true,
    });
  });

  it('keeps the flag until the point is cleared', () => {
    const parked = { rung: 0, dueDay: '2026-12-05', misses: 0, flagged: true };
    expect(reviewAfterAnswer(parked, 'right', '2026-12-05')).toEqual({
      rung: 1,
      dueDay: '2026-12-08',
      misses: 0,
      flagged: true,
    });
  });

  it('lists the points due today, the most overdue first', () => {
    const points = [
      { learningPoint: 'b', ...at(0, '2026-11-25') },
      { learningPoint: 'a', ...at(0, '2026-11-20') },
      { learningPoint: 'c', ...at(0, '2026-11-26') },
    ];
    expect(dueReviewPoints(points, '2026-11-25').map((p) => p.learningPoint)).toEqual(['a', 'b']);
  });
});

describe('retry weight', () => {
  it('counts a retry at half weight for mastery', () => {
    expect(RETRY_WEIGHT).toBe(0.5);
  });
});
