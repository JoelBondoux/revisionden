import { describe, expect, it } from 'vitest';
import {
  EXPECTED_SECONDS,
  MAX_RETRIES_PER_LESSON,
  REVIEW_LADDER_DAYS,
  RETRY_WEIGHT,
  dueReviewPoints,
  expectedSeconds,
  insertRetry,
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
  const queue: LessonEntry<string>[] = ['a', 'b', 'c', 'd', 'e', 'f'].map((item) => ({ item }));
  const items = (q: LessonEntry<string>[]) => q.map((e) => e.item + (e.retry ? '*' : ''));

  it('puts a similar question 2 to 4 questions after the missed one', () => {
    expect(items(insertRetry(queue, 0, { item: 'x', similar: true }, fixed(0)))).toEqual([
      'a',
      'b',
      'c',
      'x*',
      'd',
      'e',
      'f',
    ]);
    expect(items(insertRetry(queue, 0, { item: 'x', similar: true }, fixed(0.99)))).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
      'x*',
      'f',
    ]);
  });

  it('puts a similar question at the end when the lesson is nearly over', () => {
    expect(items(insertRetry(queue, 4, { item: 'x', similar: true }, fixed(0)))).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
      'f',
      'x*',
    ]);
  });

  it('brings the same question back at the end when there is no similar one', () => {
    const next = insertRetry(queue, 1, { item: 'b', similar: false }, fixed(0));
    expect(items(next)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'b*']);
    expect(next.at(-1)).toEqual({ item: 'b', retry: 'again' });
  });

  it('allows at most 2 retries a lesson', () => {
    let q = insertRetry(queue, 0, { item: 'x', similar: true }, fixed(0));
    q = insertRetry(q, 1, { item: 'y', similar: true }, fixed(0));
    expect(q.filter((e) => e.retry)).toHaveLength(MAX_RETRIES_PER_LESSON);
    expect(insertRetry(q, 2, { item: 'z', similar: true }, fixed(0))).toBe(q);
  });

  it('never retries a retry', () => {
    const q = insertRetry(queue, 0, { item: 'x', similar: true }, fixed(0));
    expect(insertRetry(q, 3, { item: 'y', similar: true }, fixed(0))).toBe(q);
  });
});

describe('review ladder across sessions', () => {
  it('brings a missed learning point back the next day', () => {
    expect(reviewAfterAnswer(null, 'wrong', '2026-11-25')).toEqual({
      rung: 0,
      dueDay: '2026-11-26',
    });
    expect(reviewAfterAnswer(null, 'shaky', '2026-11-25')).toEqual({
      rung: 0,
      dueDay: '2026-11-26',
    });
  });

  it('leaves nothing on the ladder for a right answer that was not on it', () => {
    expect(reviewAfterAnswer(null, 'right', '2026-11-25')).toBeNull();
  });

  it('climbs 1, 3 then 7 days with each right answer on time, then leaves the ladder', () => {
    expect(REVIEW_LADDER_DAYS).toEqual([1, 3, 7]);
    const day1 = reviewAfterAnswer({ rung: 0, dueDay: '2026-11-26' }, 'right', '2026-11-26');
    expect(day1).toEqual({ rung: 1, dueDay: '2026-11-29' });
    const day3 = reviewAfterAnswer(day1, 'right', '2026-11-29');
    expect(day3).toEqual({ rung: 2, dueDay: '2026-12-06' });
    expect(reviewAfterAnswer(day3, 'right', '2026-12-06')).toBeNull();
  });

  it('ignores a right answer before the point is due (for example the retry in the lesson)', () => {
    const point = { rung: 0, dueDay: '2026-11-26' };
    expect(reviewAfterAnswer(point, 'right', '2026-11-25')).toBe(point);
  });

  it('starts again from the next day after a wrong or slow answer', () => {
    const point = { rung: 2, dueDay: '2026-12-06' };
    expect(reviewAfterAnswer(point, 'shaky', '2026-12-06')).toEqual({
      rung: 0,
      dueDay: '2026-12-07',
    });
  });

  it('lists the points due today, the most overdue first', () => {
    const points = [
      { learningPoint: 'b', rung: 0, dueDay: '2026-11-25' },
      { learningPoint: 'a', rung: 0, dueDay: '2026-11-20' },
      { learningPoint: 'c', rung: 0, dueDay: '2026-11-26' },
    ];
    expect(dueReviewPoints(points, '2026-11-25').map((p) => p.learningPoint)).toEqual(['a', 'b']);
  });
});

describe('retry weight', () => {
  it('counts a retry at half weight for mastery', () => {
    expect(RETRY_WEIGHT).toBe(0.5);
  });
});
