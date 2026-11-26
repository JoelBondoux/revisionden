import { describe, expect, it } from 'vitest';
import {
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

  it('needs a rounded answer written to the asked accuracy, not just close to it', () => {
    const key = { value: '28.27', decimal_places: 2 };
    expect(markNumeric(key, '28.27').correct).toBe(true);
    expect(markNumeric(key, '28.274').correct).toBe(false);
    expect(markNumeric(key, '28.3').correct).toBe(false);
    expect(markNumeric(key, '28.270').correct).toBe(false);
    const sf = { value: '28.3', significant_figures: 3 };
    expect(markNumeric(sf, ' 28.3 ').correct).toBe(true);
    expect(markNumeric(sf, '28.27').correct).toBe(false);
    expect(markNumeric(sf, '28.30').correct).toBe(false);
  });

  it('accepts an answer that states the declared subject, such as "t = 4"', () => {
    expect(markNumeric({ value: '4', subject: 't' }, 't = 4').correct).toBe(true);
    expect(markNumeric({ value: '4', subject: 't' }, 'u = 4').correct).toBe(false);
    expect(markNumeric({ value: '4' }, 't = 4').correct).toBe(false);
  });

  it('accepts a UK thousands separator in groups of three, but not stray spaces inside a number', () => {
    for (const given of ['38 700', '38\u2009700', '38\u00a0700', '38,700', '38700']) {
      expect(markNumeric({ value: '38700' }, given).correct).toBe(true);
      expect(markNumeric({ value: '38700', significant_figures: 3 }, given).correct).toBe(true);
    }
    expect(markNumeric({ value: '387' }, '3 87').correct).toBe(false);
    expect(markNumeric({ value: '38700' }, '38 70 0').correct).toBe(false);
    expect(markNumeric({ value: '1234.5', decimal_places: 1 }, '1 234.5').correct).toBe(true);
    expect(markNumeric({ value: '0.75' }, '3 / 4').correct).toBe(true);
    expect(markNumeric({ value: '4' }, ' 4 ').correct).toBe(true);
  });

  it('marks standard form by value, in its common spellings', () => {
    const key = { value: '6.4 × 10^8' };
    for (const given of ['6.4 × 10^8', '6.4×10⁸', '6.4x10^8', '6.4 * 10^8', '6.4e8']) {
      expect(markNumeric(key, given).correct).toBe(true);
    }
    expect(markNumeric(key, '6.5 × 10^8').correct).toBe(false);
    expect(markNumeric(key, '6.4 × 10^9').correct).toBe(false);
  });

  it('marks a huge power of ten wrong rather than failing', () => {
    for (const given of ['1e999999999', '1e-999999999']) {
      expect(() => markNumeric({ value: '6.4 × 10^8' }, given)).not.toThrow();
      expect(markNumeric({ value: '6.4 × 10^8' }, given).correct).toBe(false);
      expect(markNumeric({ value: '640000000' }, given).correct).toBe(false);
      expect(markNumeric({ value: '1', significant_figures: 1 }, given).correct).toBe(false);
    }
  });

  it('needs proper standard form when the answer is in standard form', () => {
    const key = { value: '6.4 × 10^8' };
    expect(markNumeric(key, '64 × 10^7').correct).toBe(false);
    expect(markNumeric(key, '640000000').correct).toBe(false);
    expect(markNumeric(key, '640 000 000').correct).toBe(false);
  });

  it('accepts standard form for a plain answer, and combines with rounding', () => {
    expect(markNumeric({ value: '640000000' }, '6.4 × 10^8').correct).toBe(true);
    expect(markNumeric({ value: '0.00032' }, '3.2 × 10⁻⁴').correct).toBe(true);
    const sf = { value: '6.4 × 10^8', significant_figures: 2 };
    expect(markNumeric(sf, '6.4 × 10^8').correct).toBe(true);
    expect(markNumeric(sf, '6.40 × 10^8').correct).toBe(false);
    expect(markNumeric(sf, '64 × 10^7').correct).toBe(false);
    expect(markNumeric({ value: '38700', significant_figures: 3 }, '3.87 × 10^4').correct).toBe(
      true,
    );
  });

  it('reads the unicode minus and dash minus signs as a minus', () => {
    expect(markNumeric({ value: '-1' }, '−1').correct).toBe(true);
    expect(markNumeric({ value: '-0.25' }, '−1/4').correct).toBe(true);
    expect(markNumeric({ value: '-1/4' }, '−1/4').correct).toBe(true);
    expect(markNumeric({ value: '-1' }, '–1').correct).toBe(true);
    expect(markNumeric({ value: '-1' }, '1').correct).toBe(false);
    expect(markNumeric({ value: '-3.2', decimal_places: 1 }, '−3.2').correct).toBe(true);
  });

  it("accepts an answer typed with the item's own unit, and refuses a different unit", () => {
    expect(markNumeric({ value: '15', unit: 'm' }, '15 m').correct).toBe(true);
    expect(markNumeric({ value: '15', unit: 'm' }, '15m').correct).toBe(true);
    expect(markNumeric({ value: '15', unit: 'm' }, '15 metres').correct).toBe(true);
    expect(markNumeric({ value: '15', unit: 'm' }, '15 cm').correct).toBe(false);
    expect(markNumeric({ value: '9600', unit: 'pounds' }, '£9600').correct).toBe(true);
    expect(markNumeric({ value: '9600', unit: 'pounds' }, '£9 600').correct).toBe(true);
    expect(markNumeric({ value: '9600', unit: 'pounds' }, '9600 pounds').correct).toBe(true);
    expect(markNumeric({ value: '92', unit: '£' }, '£92').correct).toBe(true);
    expect(markNumeric({ value: '100', unit: 'pence' }, '100p').correct).toBe(true);
    expect(markNumeric({ value: '100', unit: 'pence' }, '£100').correct).toBe(false);
    expect(markNumeric({ value: '5', unit: 'cm' }, '5 cm').correct).toBe(true);
    expect(markNumeric({ value: '5', unit: 'cm' }, '5 m').correct).toBe(false);
    expect(markNumeric({ value: '5', unit: 'cm' }, '5 mm').correct).toBe(false);
    const area = { value: '28.3', unit: 'cm^2', significant_figures: 3 };
    expect(markNumeric(area, '28.3 cm^2').correct).toBe(true);
    expect(markNumeric(area, '28.3 cm²').correct).toBe(true);
    expect(markNumeric(area, '28.3 cm').correct).toBe(false);
    expect(markNumeric({ value: '4', unit: 'hours' }, '4 hours').correct).toBe(true);
    expect(markNumeric({ value: '4', unit: 'hours' }, '4 h').correct).toBe(true);
    expect(markNumeric({ value: '3', unit: 'm/s^2' }, '3 m/s²').correct).toBe(true);
    expect(markNumeric({ value: '50', unit: 'km/h' }, '50 km/h').correct).toBe(true);
    expect(markNumeric({ value: '50', unit: 'km/h' }, '50 m/s').correct).toBe(false);
    expect(markNumeric({ value: '15' }, '15 m').correct).toBe(false);
  });

  it('reads a mixed number such as "1 1/3", never as 11/3', () => {
    expect(markNumeric({ value: '4/3' }, '1 1/3').correct).toBe(true);
    expect(markNumeric({ value: '11/3' }, '1 1/3').correct).toBe(false);
    expect(markNumeric({ value: '-4/3' }, '−1 1/3').correct).toBe(true);
    expect(markNumeric({ value: '2.5' }, '2 1/2').correct).toBe(true);
    expect(markNumeric({ value: '1500.5' }, '1 500 1/2').correct).toBe(false);
    expect(markNumeric({ value: '4/3' }, '1 1/0').correct).toBe(false);
  });

  it('needs the asked form: a fraction, a simplest fraction, standard form or index form', () => {
    const fraction = { value: '3/8', form: 'fraction' as const };
    expect(markNumeric(fraction, '3/8').correct).toBe(true);
    expect(markNumeric(fraction, '6/16').correct).toBe(true);
    expect(markNumeric(fraction, '0.375').correct).toBe(false);
    expect(markNumeric(fraction, '3 / 8').correct).toBe(true);
    expect(markNumeric({ value: '3/8', form: 'simplest_fraction' as const }, '3 / 8').correct).toBe(
      true,
    );
    expect(markNumeric({ value: '4/3', form: 'fraction' as const }, '1 1/3').correct).toBe(false);
    expect(markNumeric({ value: '11/3', form: 'fraction' as const }, '1 1/3').correct).toBe(false);
    expect(markNumeric({ value: '49/20', form: 'fraction' as const }, '2.45').correct).toBe(false);
    expect(markNumeric({ value: '49/20', form: 'fraction' as const }, '2 9/20').correct).toBe(
      false,
    );
    const improper = { value: '49/20', form: 'improper_fraction' as const };
    expect(markNumeric(improper, '49/20').correct).toBe(true);
    expect(markNumeric(improper, '2 9/20').correct).toBe(false);
    expect(markNumeric(improper, '98/40').correct).toBe(false);
    const simplest = { value: '23/33', form: 'simplest_fraction' as const };
    expect(markNumeric(simplest, '23/33').correct).toBe(true);
    expect(markNumeric(simplest, '69/99').correct).toBe(false);
    expect(markNumeric(simplest, '0.69696969').correct).toBe(false);
    expect(markNumeric(simplest, '24/33').correct).toBe(false);
    expect(markNumeric({ value: '-1/6', form: 'simplest_fraction' as const }, '−1/6').correct).toBe(
      true,
    );
    expect(markNumeric({ value: '23/33' }, '69/99').correct).toBe(true);
    const standard = { value: '6.4*10^8', form: 'standard_form' as const };
    expect(markNumeric(standard, '6.4 × 10^8').correct).toBe(true);
    expect(markNumeric(standard, '640000000').correct).toBe(false);
    expect(
      markNumeric({ value: '640000000', form: 'standard_form' as const }, '6.4 × 10⁸').correct,
    ).toBe(true);
    const index = { value: '2^3 × 3^2 × 5', form: 'index_form' as const };
    expect(markNumeric(index, '2³ × 3² × 5').correct).toBe(true);
    expect(markNumeric(index, '5 × 3^2 × 2^3').correct).toBe(true);
    expect(markNumeric(index, '360').correct).toBe(false);
    expect(markNumeric(index, '2^3 × 3^2 × 7').correct).toBe(false);
    expect(
      markNumeric({ value: '360', form: 'index_form' as const }, '2^3 × 3^2 × 5').correct,
    ).toBe(true);
  });

  it('accepts area and volume units in words and with ² or ³', () => {
    const area = { value: '8', unit: 'm^2' };
    for (const given of ['8 m^2', '8 m²', '8 square metres', '8 sq m', '8 metres squared']) {
      expect(markNumeric(area, given).correct, given).toBe(true);
    }
    expect(markNumeric(area, '8 m').correct).toBe(false);
    expect(markNumeric(area, '8 cm²').correct).toBe(false);
    const volume = { value: '2500000', unit: 'cm^3' };
    for (const given of ['2500000 cm³', '2 500 000 cubic centimetres', '2500000 cm cubed']) {
      expect(markNumeric(volume, given).correct, given).toBe(true);
    }
    expect(markNumeric(volume, '2500000 square centimetres').correct).toBe(false);
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
