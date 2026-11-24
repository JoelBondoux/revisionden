import { describe, expect, it } from 'vitest';
import {
  DECK_REVIEW_XP,
  RATING_QUALITY,
  formatReviewDelay,
  isServable,
  localDate,
  markMultipleChoice,
  markNumeric,
  markShortAnswer,
  pickStartingTest,
  previewReviews,
  recordGoalMet,
  servableStatuses,
  streakAsOf,
  weekStartOf,
  type StartingTestCandidate,
} from './learning';
import { ItemTypeSchema } from './schemas';
import { createRng } from './rng';
import { DAY_MS, newCard, RELEARN_DELAY_MS } from './spaced-repetition';
import { newStreak, type StreakState } from './streaks';

describe('content gate', () => {
  it('serves only verified items when the draft flag is off', () => {
    expect(servableStatuses(false)).toEqual(['verified']);
    expect(isServable('verified', false)).toBe(true);
    expect(isServable('draft', false)).toBe(false);
  });

  it('adds drafts when the development flag is on', () => {
    expect(servableStatuses(true)).toEqual(['verified', 'draft']);
    expect(isServable('draft', true)).toBe(true);
  });

  it('never serves quarantined or retired items, even with the flag on', () => {
    expect(isServable('quarantined', true)).toBe(false);
    expect(isServable('retired', true)).toBe(false);
  });
});

describe('content item types', () => {
  it('uses the same type names as the content files, with no mapping', () => {
    for (const t of [
      'multiple_choice',
      'short_answer',
      'numeric',
      'worked_maths',
      'flashcard',
      'extended_answer',
    ]) {
      expect(ItemTypeSchema.parse(t)).toBe(t);
    }
  });

  it('rejects the old names and unknown types', () => {
    for (const t of ['working', 'long_answer', 'essay']) {
      expect(ItemTypeSchema.safeParse(t).success).toBe(false);
    }
  });
});

describe('marking', () => {
  it('marks a multiple choice answer by option number', () => {
    expect(markMultipleChoice({ option: 2 }, 2)).toEqual({ correct: true, score: 1 });
    expect(markMultipleChoice({ option: 2 }, 1)).toEqual({ correct: false, score: 0 });
    expect(markMultipleChoice({ option: 2 }, '2')).toEqual({ correct: false, score: 0 });
  });

  it('accepts any listed short answer, ignoring case and extra spaces', () => {
    const key = { accepted: ['Test answer', 'other answer'] };
    expect(markShortAnswer(key, '  test   ANSWER ')).toEqual({ correct: true, score: 1 });
    expect(markShortAnswer(key, 'Other answer')).toEqual({ correct: true, score: 1 });
    expect(markShortAnswer(key, 'wrong')).toEqual({ correct: false, score: 0 });
    expect(markShortAnswer(key, 7)).toEqual({ correct: false, score: 0 });
  });

  it('compares numeric answers as numbers, including fractions', () => {
    expect(markNumeric({ value: '4' }, '4.0')).toEqual({ correct: true, score: 1 });
    expect(markNumeric({ value: '0.5' }, '1/2')).toEqual({ correct: true, score: 1 });
    expect(markNumeric({ value: '4' }, '5')).toEqual({ correct: false, score: 0 });
    expect(markNumeric({ value: '4' }, '')).toEqual({ correct: false, score: 0 });
    expect(markNumeric({ value: '4' }, 4)).toEqual({ correct: false, score: 0 });
  });

  it('accepts numeric answers within the tolerance', () => {
    expect(markNumeric({ value: '3.14', tolerance: 0.005 }, '3.142')).toEqual({
      correct: true,
      score: 1,
    });
    expect(markNumeric({ value: '3.14', tolerance: 0.005 }, '3.15').correct).toBe(false);
  });

  it('falls back to exact text when the expected value is not a plain number', () => {
    expect(markNumeric({ value: '2sqrt(3)' }, '2 sqrt(3)').correct).toBe(true);
    expect(markNumeric({ value: '2sqrt(3)' }, '3').correct).toBe(false);
  });

  it('does not divide by zero in a fraction answer', () => {
    expect(markNumeric({ value: '1' }, '1/0').correct).toBe(false);
  });
});

describe('flashcard ratings', () => {
  it('maps the four buttons onto review quality', () => {
    expect(RATING_QUALITY).toEqual({ again: 1, hard: 3, good: 4, easy: 5 });
  });

  it('previews when the card comes back for each button', () => {
    const now = 1_000_000;
    const preview = previewReviews(newCard('c1', now), now);
    expect(preview.again).toBe(RELEARN_DELAY_MS);
    expect(preview.hard).toBe(DAY_MS);
    expect(preview.good).toBe(DAY_MS);
    expect(preview.easy).toBe(DAY_MS);
  });

  it('gives longer gaps for better ratings on a mature card', () => {
    const now = 0;
    const card = { id: 'c', repetitions: 3, intervalDays: 10, ease: 2.5, dueAt: now };
    const p = previewReviews(card, now);
    expect(p.again).toBeLessThan(p.hard);
    expect(p.hard).toBeLessThanOrEqual(p.good);
    expect(p.good).toBeLessThanOrEqual(p.easy);
  });

  it('earns 2 XP per card reviewed in a deck', () => {
    expect(DECK_REVIEW_XP).toBe(2);
  });

  it('formats review delays in plain words', () => {
    expect(formatReviewDelay(30_000)).toBe('< 1 min');
    expect(formatReviewDelay(RELEARN_DELAY_MS)).toBe('10 min');
    expect(formatReviewDelay(3 * 60 * 60 * 1000)).toBe('3 hours');
    expect(formatReviewDelay(60 * 60 * 1000)).toBe('1 hour');
    expect(formatReviewDelay(DAY_MS)).toBe('1 day');
    expect(formatReviewDelay(6 * DAY_MS)).toBe('6 days');
    expect(formatReviewDelay(45 * DAY_MS)).toBe('2 months');
    expect(formatReviewDelay(31 * DAY_MS)).toBe('1 month');
  });
});

describe('starting test', () => {
  const item = (
    itemId: string,
    topicId: string,
    difficulty = 3,
    type: StartingTestCandidate['type'] = 'numeric',
  ): StartingTestCandidate => ({ itemId, topicId, difficulty, type });

  it('takes one item per topic before taking a second from any topic', () => {
    const picked = pickStartingTest(
      [item('a1', 'a'), item('a2', 'a'), item('b1', 'b'), item('c1', 'c')],
      { count: 3, rng: createRng(1) },
    );
    expect(picked).toHaveLength(3);
    expect(new Set(picked.map((id) => id[0]))).toEqual(new Set(['a', 'b', 'c']));
  });

  it('prefers middle difficulty within a topic', () => {
    const picked = pickStartingTest([item('easy', 't', 1), item('mid', 't', 3)], {
      count: 1,
      rng: createRng(2),
    });
    expect(picked).toEqual(['mid']);
  });

  it('leaves out flashcards and long answers', () => {
    const picked = pickStartingTest(
      [item('f', 't', 3, 'flashcard'), item('l', 't', 3, 'extended_answer'), item('q', 'u')],
      { count: 5, rng: createRng(3) },
    );
    expect(picked).toEqual(['q']);
  });

  it('comes back with fewer items when there are not enough', () => {
    expect(
      pickStartingTest([item('a1', 'a'), item('a2', 'a')], { count: 10, rng: createRng(4) }),
    ).toHaveLength(2);
  });

  it('is repeatable for the same seed', () => {
    const items = ['a', 'b', 'c', 'd', 'e'].map((t) => item(`${t}1`, t));
    const first = pickStartingTest(items, { count: 3, rng: createRng(9) });
    expect(pickStartingTest(items, { count: 3, rng: createRng(9) })).toEqual(first);
  });
});

describe('daily goal and streak', () => {
  const met = (state: StreakState, date: string) => recordGoalMet(state, date);

  it('counts the first day the goal is met', () => {
    expect(met(newStreak(), '2026-11-24')).toMatchObject({ current: 1, best: 1 });
  });

  it('counts a day only once', () => {
    const once = met(newStreak(), '2026-11-24');
    expect(met(once, '2026-11-24')).toBe(once);
  });

  it('grows on back-to-back days and breaks after a missed day with no skip days', () => {
    const two = met(met(newStreak(), '2026-11-23'), '2026-11-24');
    expect(two.current).toBe(2);
    expect(met(two, '2026-11-26')).toMatchObject({ current: 1, best: 2 });
  });

  it('pays a skip day for last week when it was hit', () => {
    let state = newStreak();
    for (const d of ['16', '17', '18', '19', '20', '21', '22']) state = met(state, `2026-11-${d}`);
    // Monday of the next week: last week had its goal days, so 1 skip day is earned.
    state = recordGoalMet(state, '2026-11-23', { daysGoalMetLastWeek: 5 });
    expect(state.skipDays).toBe(1);
    expect(state.lastSettledWeek).toBe('2026-11-16');
  });

  it('shows a streak that has lapsed without changing what is stored', () => {
    const state = met(newStreak(), '2026-11-20');
    expect(streakAsOf(state, '2026-11-21').current).toBe(1);
    expect(streakAsOf(state, '2026-11-24').current).toBe(0);
    expect(streakAsOf(newStreak(), '2026-11-24').current).toBe(0);
    expect(state.current).toBe(1);
  });

  it('shows a streak kept alive by skip days', () => {
    const state = { ...met(newStreak(), '2026-11-20'), skipDays: 2 };
    expect(streakAsOf(state, '2026-11-23')).toMatchObject({ current: 1, skipDays: 0 });
  });

  it('works out the calendar date in the student’s time zone', () => {
    // 23:30 UTC on 30 June is already 1 July in London (BST).
    expect(localDate(new Date('2026-06-30T23:30:00Z'))).toBe('2026-07-01');
    expect(localDate(new Date('2026-11-24T23:30:00Z'))).toBe('2026-11-24');
  });

  it('finds the Monday that starts the week', () => {
    expect(weekStartOf('2026-11-24')).toBe('2026-11-23');
    expect(weekStartOf('2026-11-23')).toBe('2026-11-23');
    expect(weekStartOf('2026-11-29')).toBe('2026-11-23');
  });
});
