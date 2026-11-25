import { describe, expect, it } from 'vitest';
import { DAY_MS } from './spaced-repetition';
import { createRng } from './rng';
import {
  DAILY_SET_SIZE,
  DailySetResponseSchema,
  dailySeed,
  dailySetProgress,
  effectiveMastery,
  selectDailySet,
  type DailyTopic,
} from './daily';
import type { Candidate } from './next-item';

const NOW = Date.UTC(2026, 10, 25, 9, 0, 0);

const topic = (
  topicId: string,
  subjectId: string,
  mastery: number,
  daysAgo: number | null,
): DailyTopic => ({
  topicId,
  subjectId,
  mastery,
  lastPractisedAt: daysAgo === null ? null : NOW - daysAgo * DAY_MS,
});

const questions = (topicId: string, n: number): Candidate[] =>
  Array.from({ length: n }, (_, i) => ({
    itemId: `${topicId}-q${i}`,
    topicId,
    kind: 'question' as const,
  }));

describe('daily 5-a-day', () => {
  it('has 5 questions', () => {
    expect(DAILY_SET_SIZE).toBe(5);
  });

  it('only uses topics the student has already practised, never brand-new ones', () => {
    const picked = selectDailySet({
      topics: [topic('done', 'maths', 50, 2), topic('new', 'maths', 0, null)],
      candidates: [...questions('done', 10), ...questions('new', 10)],
      now: NOW,
      rng: createRng(1),
    });
    expect(picked).toHaveLength(5);
    expect(picked.filter((c) => c.topicId === 'new')).toEqual([]);
  });

  it('ignores topics practised in the future (a wrong clock), as if new', () => {
    const picked = selectDailySet({
      topics: [topic('future', 'maths', 50, -1)],
      candidates: questions('future', 10),
      now: NOW,
      rng: createRng(1),
    });
    expect(picked).toEqual([]);
  });

  it('mixes topics and subjects, at most 3 in a row from one topic', () => {
    const picked = selectDailySet({
      topics: [
        topic('algebra', 'maths', 40, 3),
        topic('cells', 'biology', 45, 5),
        topic('forces', 'physics', 90, 1),
      ],
      candidates: [
        ...questions('algebra', 10),
        ...questions('cells', 10),
        ...questions('forces', 10),
      ],
      now: NOW,
      rng: createRng(7),
    });
    expect(picked).toHaveLength(5);
    expect(new Set(picked.map((c) => c.topicId)).size).toBeGreaterThan(1);
  });

  it('weights weak and long-unpractised topics more (spaced repetition)', () => {
    const topics = [topic('fresh-strong', 'maths', 90, 0), topic('stale-weak', 'maths', 40, 60)];
    const candidates = [...questions('fresh-strong', 50), ...questions('stale-weak', 50)];
    let stale = 0;
    for (let seed = 1; seed <= 40; seed++) {
      stale += selectDailySet({ topics, candidates, now: NOW, rng: createRng(seed) }).filter(
        (c) => c.topicId === 'stale-weak',
      ).length;
    }
    expect(stale).toBeGreaterThan(40 * 5 * 0.7);
  });

  it('serves due flashcards before questions and skips cards not yet due', () => {
    const picked = selectDailySet({
      topics: [topic('a', 'maths', 50, 1)],
      candidates: [
        ...questions('a', 2),
        { itemId: 'card-due', topicId: 'a', kind: 'flashcard', due: true },
        { itemId: 'card-later', topicId: 'a', kind: 'flashcard', due: false },
      ],
      now: NOW,
      rng: createRng(3),
    });
    expect(picked[0]?.itemId).toBe('card-due');
    expect(picked.map((c) => c.itemId)).not.toContain('card-later');
  });

  it('gives the same set for the same student, day and data', () => {
    const input = {
      topics: [topic('a', 'maths', 30, 2), topic('b', 'maths', 60, 4)],
      candidates: [...questions('a', 10), ...questions('b', 10)],
      now: NOW,
    };
    const seed = dailySeed('student-1', '2026-11-25');
    expect(selectDailySet({ ...input, rng: createRng(seed) })).toEqual(
      selectDailySet({ ...input, rng: createRng(seed) }),
    );
    expect(dailySeed('student-1', '2026-11-25')).not.toBe(dailySeed('student-1', '2026-11-26'));
    expect(dailySeed('student-1', '2026-11-25')).not.toBe(dailySeed('student-2', '2026-11-25'));
  });

  it('is empty when nothing has been practised yet', () => {
    expect(
      selectDailySet({ topics: [], candidates: questions('a', 5), now: NOW, rng: createRng(1) }),
    ).toEqual([]);
  });

  it('lets mastery drift down with the same 30-day half-life as topic mastery', () => {
    expect(effectiveMastery(80, NOW, NOW)).toBe(80);
    expect(effectiveMastery(80, NOW - 30 * DAY_MS, NOW)).toBe(40);
    expect(effectiveMastery(80, NOW + DAY_MS, NOW)).toBe(80);
  });

  it('is done once every question in the set has been answered', () => {
    expect(dailySetProgress(['a', 'b', 'c'], ['b', 'x', 'b'])).toEqual({
      answeredItemIds: ['b'],
      answered: 1,
      total: 3,
      done: false,
    });
    expect(dailySetProgress(['a', 'b'], ['b', 'a'])).toMatchObject({
      answeredItemIds: ['a', 'b'],
      done: true,
    });
    expect(dailySetProgress([], [])).toMatchObject({ answered: 0, total: 0, done: false });
  });

  it('has a response schema for the API', () => {
    expect(
      DailySetResponseSchema.parse({
        day: '2026-11-25',
        items: [],
        draftContent: false,
        answeredItemIds: [],
        answered: 0,
        total: 0,
        done: false,
      }).total,
    ).toBe(0);
    expect(() => DailySetResponseSchema.parse({ day: 'today' })).toThrow();
  });
});
