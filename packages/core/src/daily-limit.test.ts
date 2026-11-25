import { describe, expect, it } from 'vitest';
import {
  DAILY_LIMIT_CEILINGS,
  DAILY_LIMIT_DEFAULTS,
  MIN_DAILY_LIMIT,
  applySuggestion,
  creditsPastLimit,
  dailyLimitFor,
  dayTypeOf,
  inExamSeason,
  lateSessionAccuracyDrop,
  limitStatus,
  weeklySuggestion,
  type LimitSession,
  type SuggestionInput,
} from './daily-limit';

const MIN = 60_000;
const DAY = 86_400_000;
const none = { schoolDayMinutes: null, otherDayMinutes: null, examSeasonExtra: false };

describe('day types', () => {
  it('treats weekdays as school days and weekends and holidays as other days', () => {
    expect(dayTypeOf('2026-11-25')).toBe('school'); // Wednesday
    expect(dayTypeOf('2026-11-28')).toBe('other'); // Saturday
    expect(dayTypeOf('2026-11-29')).toBe('other'); // Sunday
    const holidays = [{ start: '2026-12-21', end: '2027-01-04' }];
    expect(dayTypeOf('2026-12-22', holidays)).toBe('other');
    expect(dayTypeOf('2027-01-04', holidays)).toBe('school');
  });
});

describe('exam season', () => {
  const exams = ['2027-05-20', '2027-05-11', '2027-06-15'];

  it('runs from 6 weeks before the first exam to the last exam', () => {
    expect(inExamSeason('2027-03-29', exams)).toBe(false);
    expect(inExamSeason('2027-03-30', exams)).toBe(true); // 42 days before 11 May
    expect(inExamSeason('2027-06-15', exams)).toBe(true);
    expect(inExamSeason('2027-06-16', exams)).toBe(false);
    expect(inExamSeason('2027-04-10', [])).toBe(false);
  });
});

describe('the daily limit', () => {
  it('uses the defaults for the level and day type', () => {
    expect(DAILY_LIMIT_DEFAULTS).toEqual({
      gcse: { school: 60, other: 90 },
      a_level: { school: 90, other: 120 },
    });
    expect(DAILY_LIMIT_CEILINGS).toEqual({
      gcse: { school: 120, other: 180 },
      a_level: { school: 150, other: 210 },
    });
    expect(dailyLimitFor({ level: 'gcse', settings: none, date: '2026-11-25' })).toEqual({
      minutes: 60,
      dayType: 'school',
      examSeason: false,
    });
    expect(dailyLimitFor({ level: 'a_level', settings: none, date: '2026-11-28' }).minutes).toBe(
      120,
    );
  });

  it("uses the parent's own limit for each day type, even above the ceiling", () => {
    const settings = { schoolDayMinutes: 45, otherDayMinutes: 200, examSeasonExtra: false };
    expect(dailyLimitFor({ level: 'gcse', settings, date: '2026-11-25' }).minutes).toBe(45);
    expect(dailyLimitFor({ level: 'gcse', settings, date: '2026-11-28' }).minutes).toBe(200);
  });

  it('adds 30 minutes in exam season only when the parent agrees', () => {
    const exams = ['2027-05-11'];
    const date = '2027-04-21'; // a Wednesday in exam season
    expect(dailyLimitFor({ level: 'gcse', settings: none, date, examDates: exams })).toEqual({
      minutes: 60,
      dayType: 'school',
      examSeason: true,
    });
    const agreed = { ...none, examSeasonExtra: true };
    expect(dailyLimitFor({ level: 'gcse', settings: agreed, date, examDates: exams }).minutes).toBe(
      90,
    );
  });

  it('says how many minutes are left and when the limit is reached', () => {
    expect(limitStatus(25.6 * MIN, 60)).toEqual({
      limitMinutes: 60,
      usedMinutes: 25,
      leftMinutes: 35,
      reached: false,
    });
    expect(limitStatus(60 * MIN, 60)).toMatchObject({ leftMinutes: 0, reached: true });
    expect(limitStatus(75 * MIN, 60)).toMatchObject({ usedMinutes: 75, leftMinutes: 0 });
  });

  it('lets only timed papers carry on past the limit', () => {
    expect(creditsPastLimit('practice')).toBe(false);
    expect(creditsPastLimit('timed_paper')).toBe(true);
  });
});

/** A session of `minutes`, one answer a minute: early answers right, late ones as given. */
function session(start: number, minutes: number, lateRight: number): LimitSession {
  const answers = Array.from({ length: minutes + 1 }, (_, i) => {
    const late = i > minutes - 15;
    const score = late ? (i % 100 < lateRight * 100 ? 1 : 0) : 1;
    return { at: start + i * MIN, score };
  });
  return { start, end: start + minutes * MIN, answers };
}

describe('late-session accuracy', () => {
  const t = Date.parse('2026-11-20T16:00:00Z');

  it('compares the first and last 15 minutes of sessions of 30 minutes or more', () => {
    // Late answers: every other one right, so late accuracy is about 50%.
    const tired: LimitSession = {
      start: t,
      end: t + 40 * MIN,
      answers: Array.from({ length: 41 }, (_, i) => ({
        at: t + i * MIN,
        score: i > 25 && i % 2 === 0 ? 0 : 1,
      })),
    };
    const drop = lateSessionAccuracyDrop([tired])!;
    expect(drop).toBeGreaterThan(40);
    expect(drop).toBeLessThan(60);
  });

  it('has no signal without long sessions, and ignores unmarked answers', () => {
    expect(lateSessionAccuracyDrop([session(t, 20, 1)])).toBeNull();
    const steady = session(t, 40, 1);
    steady.answers.push({ at: t + 39 * MIN, score: null });
    expect(lateSessionAccuracyDrop([steady])).toBe(0);
  });
});

describe('weekly suggestions', () => {
  const today = '2026-11-25';
  const base: SuggestionInput = {
    today,
    level: 'gcse',
    current: { school: 60, other: 90 },
    days: [],
    sessions: [],
    restDays: 2,
    abandonedSessions: 0,
    lastSuggestedOn: null,
    lastRaiseOn: null,
  };
  const t = Date.parse('2026-11-20T16:00:00Z');
  const atLimit = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      day: `2026-11-${String(12 + i).padStart(2, '0')}`,
      usedMinutes: 60,
      limitMinutes: 60,
    }));
  const tiredSession: LimitSession = {
    start: t,
    end: t + 40 * MIN,
    answers: Array.from({ length: 41 }, (_, i) => ({
      at: t + i * MIN,
      score: i > 25 && i % 2 === 0 ? 0 : 1,
    })),
  };
  const steadySession = session(t, 40, 1);

  it('suggests nothing without signs either way', () => {
    expect(weeklySuggestion(base)).toBeNull();
  });

  it('suggests +10 when the limit is reached on 4 days with steady accuracy', () => {
    const input = { ...base, days: atLimit(4), sessions: [steadySession] };
    expect(weeklySuggestion(input)).toEqual({
      kind: 'raise',
      change: 10,
      schoolDayMinutes: 70,
      otherDayMinutes: 100,
      reason: 'Reached the daily limit on 4 days in the last two weeks, with steady accuracy.',
    });
    expect(weeklySuggestion({ ...input, days: atLimit(3) })).toBeNull();
    expect(weeklySuggestion({ ...input, sessions: [] })).toBeNull();
  });

  it('suggests a rise at most once a fortnight and never past the ceiling', () => {
    const input = { ...base, days: atLimit(5), sessions: [steadySession] };
    expect(weeklySuggestion({ ...input, lastRaiseOn: '2026-11-15' })).toBeNull();
    expect(weeklySuggestion({ ...input, lastRaiseOn: '2026-11-11' })?.kind).toBe('raise');
    expect(weeklySuggestion({ ...input, current: { school: 120, other: 150 } })).toBeNull();
    expect(weeklySuggestion({ ...input, current: { school: 115, other: 175 } })).toMatchObject({
      schoolDayMinutes: 120,
      otherDayMinutes: 180,
    });
  });

  it('suggests easing off by 10 when accuracy drops by more than 10 points late on', () => {
    const suggestion = weeklySuggestion({ ...base, sessions: [tiredSession] })!;
    expect(suggestion).toMatchObject({
      kind: 'ease',
      change: -10,
      schoolDayMinutes: 50,
      otherDayMinutes: 80,
    });
    expect(suggestion.reason).toMatch(/^Accuracy dips after about 25 minutes/);
  });

  it('suggests easing off by 15 when there are two or more tiredness signs', () => {
    const suggestion = weeklySuggestion({
      ...base,
      days: atLimit(5),
      sessions: [tiredSession],
      abandonedSessions: 2,
      restDays: 0,
    })!;
    expect(suggestion).toMatchObject({ kind: 'ease', change: -15, schoolDayMinutes: 45 });
    expect(suggestion.reason).toContain('Several sessions were stopped part-way.');
    expect(suggestion.reason).toContain('No rest days in the last two weeks.');
  });

  it('never suggests a limit below the minimum', () => {
    const low = { ...base, current: { school: 20, other: 20 }, restDays: 0 };
    expect(weeklySuggestion(low)).toMatchObject({
      schoolDayMinutes: MIN_DAILY_LIMIT,
      otherDayMinutes: MIN_DAILY_LIMIT,
    });
    expect(weeklySuggestion({ ...low, current: { school: 15, other: 15 } })).toBeNull();
  });

  it('makes at most one suggestion a week', () => {
    const input = { ...base, restDays: 0 };
    expect(weeklySuggestion({ ...input, lastSuggestedOn: '2026-11-20' })).toBeNull();
    expect(weeklySuggestion({ ...input, lastSuggestedOn: '2026-11-18' })?.kind).toBe('ease');
  });

  it('applies an accepted suggestion to both day types', () => {
    const suggestion = weeklySuggestion({ ...base, restDays: 0 })!;
    expect(applySuggestion(none, suggestion)).toEqual({
      schoolDayMinutes: 50,
      otherDayMinutes: 80,
      examSeasonExtra: false,
    });
    expect(DAY).toBe(86_400_000);
  });
});

describe('a rise never lowers a limit set by hand', () => {
  it('keeps a weekend limit the parent set above the ceiling', () => {
    const t = Date.parse('2026-11-20T16:00:00Z');
    const steady = session(t, 40, 1);
    const days = Array.from({ length: 4 }, (_, i) => ({
      day: `2026-11-${String(12 + i).padStart(2, '0')}`,
      usedMinutes: 60,
      limitMinutes: 60,
    }));
    const suggestion = weeklySuggestion({
      today: '2026-11-25',
      level: 'gcse',
      current: { school: 60, other: 200 },
      days,
      sessions: [steady],
      restDays: 2,
      abandonedSessions: 0,
      lastSuggestedOn: null,
      lastRaiseOn: null,
    });
    expect(suggestion).toMatchObject({ schoolDayMinutes: 70, otherDayMinutes: 200 });
  });
});
