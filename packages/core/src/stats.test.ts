import { describe, expect, it } from 'vitest';
import { topicMastery } from './mastery';
import {
  ACTIVE_GAP_MS,
  activeStudy,
  activeMsInRange,
  addDays,
  answerTotals,
  bestWeekXp,
  DEFAULT_DAILY_CAP_MINUTES,
  groupActivity,
  kindChange,
  longestCorrectRun,
  masteryAt,
  periodRange,
  previousPeriod,
  quietSessions,
  restDays,
  studySessions,
  subjectMastery,
  termOf,
  totalXp,
  weakSpotTrend,
  xpByBucket,
  zonedDayStart,
  type StatsAnswer,
} from './stats';

const MIN = 60_000;
const DAY = 86_400_000;
const at = (iso: string) => Date.parse(iso);
const UK = 'Europe/London';

describe('dates', () => {
  it('adds days across month ends', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('finds the instant a local day starts in UK time, in summer and in winter', () => {
    expect(new Date(zonedDayStart('2026-07-06', UK)).toISOString()).toBe(
      '2026-07-05T23:00:00.000Z',
    );
    expect(new Date(zonedDayStart('2026-11-24', UK)).toISOString()).toBe(
      '2026-11-24T00:00:00.000Z',
    );
  });
});

describe('periods', () => {
  it('runs a week from Monday to Sunday with one bucket a day', () => {
    const week = periodRange('week', '2026-11-26');
    expect(week).toMatchObject({ period: 'week', start: '2026-11-23', end: '2026-11-30' });
    expect(week.buckets.map((b) => b.label)).toEqual([
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat',
      'Sun',
    ]);
    expect(week.buckets[6]).toMatchObject({ start: '2026-11-29', end: '2026-11-30' });
  });

  it('splits the school year into autumn, spring and summer terms', () => {
    expect(termOf('2026-11-24')).toEqual({
      name: 'Autumn',
      start: '2026-09-01',
      end: '2027-01-01',
    });
    expect(termOf('2027-02-10')).toEqual({
      name: 'Spring',
      start: '2027-01-01',
      end: '2027-04-01',
    });
    expect(termOf('2027-06-01')).toEqual({
      name: 'Summer',
      start: '2027-04-01',
      end: '2027-09-01',
    });
    expect(termOf('2027-08-15').name).toBe('Summer');
  });

  it('buckets a term by week, clipped to the term', () => {
    const term = periodRange('term', '2026-11-24');
    expect(term).toMatchObject({ start: '2026-09-01', end: '2027-01-01', label: 'Autumn term' });
    expect(term.buckets).toHaveLength(18);
    expect(term.buckets[0]).toMatchObject({
      start: '2026-09-01',
      end: '2026-09-07',
      label: '1 Sep',
    });
    expect(term.buckets[17]).toMatchObject({ start: '2026-12-28', end: '2027-01-01' });
  });

  it('buckets a school year (September to August) by month', () => {
    const year = periodRange('year', '2026-11-24');
    expect(year).toMatchObject({ start: '2026-09-01', end: '2027-09-01', label: '2026/27' });
    expect(year.buckets).toHaveLength(12);
    expect(year.buckets[0]).toMatchObject({ start: '2026-09-01', end: '2026-10-01', label: 'Sep' });
    expect(year.buckets[11]).toMatchObject({ start: '2027-08-01', label: 'Aug' });
    expect(periodRange('year', '2027-08-31').label).toBe('2026/27');
  });

  it('gives the period before each period', () => {
    expect(previousPeriod(periodRange('week', '2026-11-24'))).toMatchObject({
      start: '2026-11-16',
      end: '2026-11-23',
    });
    expect(previousPeriod(periodRange('term', '2026-11-24'))).toMatchObject({
      start: '2026-04-01',
      end: '2026-09-01',
    });
    expect(previousPeriod(periodRange('term', '2027-02-10'))).toMatchObject({
      start: '2026-09-01',
    });
    expect(previousPeriod(periodRange('year', '2026-11-24'))).toMatchObject({
      start: '2025-09-01',
      end: '2026-09-01',
    });
  });
});

describe('XP', () => {
  const days = [
    { day: '2026-11-22', xp: 9 },
    { day: '2026-11-23', xp: 30 },
    { day: '2026-11-25', xp: 20 },
    { day: '2026-11-25', xp: 5 },
    { day: '2026-11-29', xp: 40 },
    { day: '2026-11-30', xp: 50 },
  ];

  it('totals XP per bucket and leaves days outside the period out', () => {
    const week = periodRange('week', '2026-11-24');
    expect(xpByBucket(days, week).map((b) => b.value)).toEqual([30, 0, 25, 0, 0, 0, 40]);
    expect(totalXp(days, week)).toBe(95);
  });

  it('finds the best week of XP', () => {
    expect(bestWeekXp(days)).toEqual({ weekStart: '2026-11-23', xp: 95 });
    expect(bestWeekXp([])).toBeNull();
  });
});

describe('answers and accuracy', () => {
  const answer = (iso: string, score: number | null): StatsAnswer => ({
    at: at(iso),
    score,
    topicId: 't1',
    subjectId: 's1',
  });

  it('counts part marks as the fraction earned and leaves unmarked answers out', () => {
    const week = periodRange('week', '2026-11-24');
    const totals = answerTotals(
      [
        answer('2026-11-23T10:00:00Z', 1),
        answer('2026-11-23T10:01:00Z', 0.5),
        answer('2026-11-23T10:02:00Z', 0),
        answer('2026-11-23T10:03:00Z', null),
      ],
      week,
      UK,
    );
    expect(totals).toEqual({ answered: 4, correct: 1, marked: 3, accuracy: 50 });
  });

  it('has no accuracy when nothing was marked', () => {
    const week = periodRange('week', '2026-11-24');
    expect(answerTotals([answer('2026-11-23T10:00:00Z', null)], week, UK).accuracy).toBeNull();
  });

  it('puts a late Sunday answer in the right UK week, in summer and in winter', () => {
    // 23:30 UTC on a Sunday is still Sunday in winter (GMT) but Monday in summer (BST).
    const winter = answer('2026-11-29T23:30:00Z', 1);
    expect(answerTotals([winter], periodRange('week', '2026-11-24'), UK).answered).toBe(1);
    const summer = answer('2026-07-05T23:30:00Z', 1);
    expect(answerTotals([summer], periodRange('week', '2026-07-01'), UK).answered).toBe(0);
    expect(answerTotals([summer], periodRange('week', '2026-07-06'), UK).answered).toBe(1);
  });

  it('finds the most correct answers in a row, skipping unmarked answers', () => {
    const scores = [1, 1, null, 1, 1, 0, 1, 1, 1, 0.5];
    const list = scores.map((s, i) => ({ ...answer('2026-11-23T10:00:00Z', s), at: i * MIN }));
    expect(longestCorrectRun([...list].reverse())).toBe(4);
    expect(longestCorrectRun([])).toBe(0);
  });
});

describe('active study time', () => {
  const start = at('2026-11-24T16:00:00Z');

  it('counts time between answers and ends a session after a gap of more than 5 minutes', () => {
    const times = [start, start + 2 * MIN, start + 4 * MIN, start + 19 * MIN, start + 20 * MIN];
    const { days } = activeStudy(times, UK, DEFAULT_DAILY_CAP_MINUTES);
    expect(days).toEqual([{ day: '2026-11-24', ms: 5 * MIN, overCap: false }]);
    expect(studySessions(times)).toEqual([
      { start, end: start + 4 * MIN },
      { start: start + 19 * MIN, end: start + 20 * MIN },
    ]);
  });

  it('still counts a gap of exactly 5 minutes', () => {
    const { days } = activeStudy([start, start + ACTIVE_GAP_MS], UK, 120);
    expect(days[0]!.ms).toBe(5 * MIN);
  });

  it('does not count time past the daily cap', () => {
    const times = Array.from({ length: 31 }, (_, i) => start + i * MIN);
    const { days } = activeStudy(times, UK, 10);
    expect(days).toEqual([{ day: '2026-11-24', ms: 10 * MIN, overCap: true }]);
  });

  it("uses each day's own limit when given one per day", () => {
    const times = Array.from({ length: 31 }, (_, i) => start + i * MIN);
    const limit = (day: string) => (day === '2026-11-24' ? 20 : 5);
    expect(activeStudy(times, UK, limit).days).toEqual([
      { day: '2026-11-24', ms: 20 * MIN, overCap: true },
    ]);
  });

  it('gives time across midnight to the day of the later answer', () => {
    const late = at('2026-11-24T23:58:00Z');
    const { days } = activeStudy([late, late + 3 * MIN], UK, 120);
    expect(days).toEqual([{ day: '2026-11-25', ms: 3 * MIN, overCap: false }]);
  });

  it('totals the active time inside a period', () => {
    const days = [
      { day: '2026-11-22', ms: 7 * MIN, overCap: false },
      { day: '2026-11-24', ms: 3 * MIN, overCap: false },
      { day: '2026-11-25', ms: 4 * MIN, overCap: true },
    ];
    expect(activeMsInRange(days, periodRange('week', '2026-11-24'))).toBe(7 * MIN);
  });
});

describe('healthy habits', () => {
  it('counts sessions that start in quiet hours', () => {
    const sessions = [
      { start: 1, end: 2 },
      { start: 5, end: 6 },
      { start: 9, end: 9 },
    ];
    expect(quietSessions(sessions, (t) => t > 4)).toBe(2);
  });

  it('counts finished days in the period with no study as rest days', () => {
    const week = periodRange('week', '2026-11-26');
    expect(restDays(new Set(['2026-11-23', '2026-11-25']), week, '2026-11-26')).toBe(1);
    const lastWeek = periodRange('week', '2026-11-16');
    expect(restDays(new Set(['2026-11-16']), lastWeek, '2026-11-26')).toBe(6);
  });
});

describe('mastery', () => {
  const now = at('2026-11-24T12:00:00Z');
  const since = now - 7 * DAY;
  const a = (topicId: string, subjectId: string, when: number, score: number | null) => ({
    topicId,
    subjectId,
    at: when,
    score,
  });
  const answers: StatsAnswer[] = [
    a('t1', 'maths', now - 20 * DAY, 1),
    a('t1', 'maths', now - 10 * DAY, 1),
    a('t1', 'maths', now - 2 * DAY, 0),
    a('t2', 'maths', now - 1 * DAY, 1),
    a('t2', 'maths', now - 1 * DAY, null),
    a('t3', 'physics', now - 30 * DAY, 0.5),
  ];

  it('replays topic mastery at a past moment from marked answers only', () => {
    const t1Then = topicMastery(
      [
        { score: 1, at: now - 20 * DAY },
        { score: 1, at: now - 10 * DAY },
      ],
      since,
    );
    expect(masteryAt(answers, ['t1', 't2'], since)).toEqual({ t1: t1Then, t2: 0 });
  });

  it('counts a helped answer as wrong for mastery, but keeps its score for accuracy (F10)', () => {
    const helped = [{ ...a('t9', 'maths', now - DAY, 1), helped: true }];
    expect(masteryAt(helped, ['t9'], now)).toEqual({
      t9: topicMastery([{ score: 0, at: now - DAY }], now),
    });
    expect(
      answerTotals(helped, { start: '2000-01-01', end: '2999-01-01' }, 'Europe/London'),
    ).toMatchObject({
      correct: 1,
      accuracy: 100,
    });
  });

  it('averages topic mastery per subject with the change since a moment', () => {
    const now1 = topicMastery(
      [
        { score: 1, at: now - 20 * DAY },
        { score: 1, at: now - 10 * DAY },
        { score: 0, at: now - 2 * DAY },
      ],
      now,
    );
    const now2 = topicMastery([{ score: 1, at: now - DAY }], now);
    const then1 = masteryAt(answers, ['t1'], since).t1!;
    const result = subjectMastery(answers, now, since);
    expect(result).toEqual([
      {
        subjectId: 'maths',
        mastery: Math.round((now1 + now2) / 2),
        change: Math.round((now1 + now2) / 2) - Math.round(then1 / 2),
      },
      {
        subjectId: 'physics',
        mastery: topicMastery([{ score: 0.5, at: now - 30 * DAY }], now),
        change:
          topicMastery([{ score: 0.5, at: now - 30 * DAY }], now) -
          topicMastery([{ score: 0.5, at: now - 30 * DAY }], since),
      },
    ]);
  });

  it('lists the three weakest topics now with their mastery four weeks ago', () => {
    const more = [...answers, a('t4', 'physics', now - DAY, 1), a('t4', 'physics', now - DAY, 1)];
    const then = now - 28 * DAY;
    const trend = weakSpotTrend(more, now, then);
    expect(trend.map((t) => t.topicId)).toEqual(['t3', 't1', 't2']);
    expect(trend[0]).toEqual({
      topicId: 't3',
      subjectId: 'physics',
      then: topicMastery([{ score: 0.5, at: now - 30 * DAY }], then),
      now: topicMastery([{ score: 0.5, at: now - 30 * DAY }], now),
    });
    expect(weakSpotTrend([], now, then)).toEqual([]);
  });
});

describe('kind framing for the student', () => {
  it('shows gains and "same", and nothing for a drop', () => {
    expect(kindChange(12, 10)).toEqual({ trend: 'up', by: 2 });
    expect(kindChange(10, 10)).toEqual({ trend: 'same' });
    expect(kindChange(8, 10)).toEqual({ trend: 'none' });
    expect(kindChange(null, 10)).toEqual({ trend: 'none' });
    expect(kindChange(5, null)).toEqual({ trend: 'none' });
  });
});

describe('recent activity', () => {
  it('groups back-to-back events of one kind and lists the newest first', () => {
    const t = at('2026-11-24T16:00:00Z');
    const events = [
      { kind: 'lesson' as const, at: t, subjectId: 'maths' },
      { kind: 'lesson' as const, at: t + MIN, subjectId: 'maths' },
      { kind: 'flashcards' as const, at: t + 2 * MIN, subjectId: null },
      { kind: 'lesson' as const, at: t + 30 * MIN, subjectId: 'maths' },
      { kind: 'lesson' as const, at: t + 31 * MIN, subjectId: 'physics' },
    ];
    expect(groupActivity(events)).toEqual([
      { kind: 'lesson', at: t + 31 * MIN, count: 1, subjectId: 'physics' },
      { kind: 'lesson', at: t + 30 * MIN, count: 1, subjectId: 'maths' },
      { kind: 'flashcards', at: t + 2 * MIN, count: 1, subjectId: null },
      { kind: 'lesson', at: t + MIN, count: 2, subjectId: 'maths' },
    ]);
    expect(groupActivity(events, 2)).toHaveLength(2);
  });
});
