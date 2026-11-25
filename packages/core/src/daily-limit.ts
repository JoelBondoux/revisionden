/**
 * Daily limit (wellbeing): docs/PRODUCT_RULES.md "Daily limit (wellbeing)".
 *
 * One limit per student, in active study minutes (the stats rule: time between answers, gaps over
 * 5 minutes not counted). Defaults depend on the level and the day type; a parent can set their
 * own limit per day type, and may add 30 minutes in exam season. Once a week the app may
 * suggest a change to the parent; it never changes the limit by itself.
 * Pure functions: dates (YYYY-MM-DD, family time zone) and instants are passed in.
 */
import type { Level } from './onboarding';
import { addDays, type DateRange } from './stats';

export type DayType = 'school' | 'other';

export const DAILY_LIMIT_DEFAULTS: Record<Level, Record<DayType, number>> = {
  gcse: { school: 60, other: 90 },
  a_level: { school: 90, other: 120 },
};

/** The app never suggests going past these (a parent may still set any limit by hand). */
export const DAILY_LIMIT_CEILINGS: Record<Level, Record<DayType, number>> = {
  gcse: { school: 120, other: 180 },
  a_level: { school: 150, other: 210 },
};

export const EXAM_SEASON_EXTRA_MINUTES = 30;
/** Exam season starts this many days before the first exam. */
export const EXAM_SEASON_LEAD_DAYS = 42;
/** Lowest and highest limit a parent can set, and the lowest the app suggests. */
export const MIN_DAILY_LIMIT = 15;
export const MAX_DAILY_LIMIT = 360;

const RAISE_MINUTES = 10;
const RAISE_EVERY_DAYS = 14;
const SUGGEST_EVERY_DAYS = 7;
const RAISE_MIN_DAYS_AT_LIMIT = 4;
const STEADY_POINTS = 5;
const TIRED_POINTS = 10;
const ABANDONED_SIGN = 2;
const WINDOW_MS = 15 * 60_000;
const LONG_SESSION_MS = 30 * 60_000;

export interface DailyLimitSettings {
  /** The parent's own limit for school days, or null for the default. */
  schoolDayMinutes: number | null;
  otherDayMinutes: number | null;
  /** The parent agreed to the exam-season extra. */
  examSeasonExtra: boolean;
}

const dayIndex = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

/** Weekdays are school days; weekends and holidays are other days. */
export function dayTypeOf(date: string, holidays: readonly DateRange[] = []): DayType {
  const weekend = dayIndex(date) === 0 || dayIndex(date) === 6;
  const holiday = holidays.some((h) => date >= h.start && date < h.end);
  return weekend || holiday ? 'other' : 'school';
}

/** From 6 weeks before the first exam to the day of the last one. */
export function inExamSeason(date: string, examDates: readonly string[]): boolean {
  if (examDates.length === 0) return false;
  const sorted = [...examDates].sort();
  return date >= addDays(sorted[0]!, -EXAM_SEASON_LEAD_DAYS) && date <= sorted.at(-1)!;
}

export function dailyLimitFor(input: {
  level: Level;
  settings: DailyLimitSettings;
  date: string;
  examDates?: readonly string[];
  holidays?: readonly DateRange[];
}): { minutes: number; dayType: DayType; examSeason: boolean } {
  const { level, settings, date } = input;
  const dayType = dayTypeOf(date, input.holidays);
  const own = dayType === 'school' ? settings.schoolDayMinutes : settings.otherDayMinutes;
  const base = own ?? DAILY_LIMIT_DEFAULTS[level][dayType];
  const examSeason = inExamSeason(date, input.examDates ?? []);
  const extra = examSeason && settings.examSeasonExtra ? EXAM_SEASON_EXTRA_MINUTES : 0;
  return { minutes: base + extra, dayType, examSeason };
}

export interface LimitStatus {
  limitMinutes: number;
  usedMinutes: number;
  leftMinutes: number;
  reached: boolean;
}

export function limitStatus(usedMs: number, limitMinutes: number): LimitStatus {
  const usedMinutes = Math.floor(usedMs / 60_000);
  return {
    limitMinutes,
    usedMinutes,
    leftMinutes: Math.max(0, limitMinutes - usedMinutes),
    reached: usedMinutes >= limitMinutes,
  };
}

/** Only a timed paper already under way may finish (and earn) past the limit. */
export function creditsPastLimit(activity: 'practice' | 'timed_paper'): boolean {
  return activity === 'timed_paper';
}

// ---------------------------------------------------------------------------------------------
// Weekly suggestions
// ---------------------------------------------------------------------------------------------

export interface LimitSession {
  start: number;
  end: number;
  answers: { at: number; score: number | null }[];
}

const accuracy = (answers: LimitSession['answers']) => {
  const marked = answers.filter((a) => a.score !== null);
  if (marked.length === 0) return null;
  return (100 * marked.reduce((t, a) => t + a.score!, 0)) / marked.length;
};

const longSessions = (sessions: readonly LimitSession[]) =>
  sessions.filter((s) => s.end - s.start >= LONG_SESSION_MS);

/**
 * How many points accuracy falls from the first 15 minutes to the last 15 minutes of sessions of
 * 30 minutes or more (averaged over those sessions); null when there are none to compare.
 */
export function lateSessionAccuracyDrop(sessions: readonly LimitSession[]): number | null {
  const drops = longSessions(sessions).flatMap((s) => {
    const early = accuracy(s.answers.filter((a) => a.at < s.start + WINDOW_MS));
    const late = accuracy(s.answers.filter((a) => a.at > s.end - WINDOW_MS));
    return early === null || late === null ? [] : [early - late];
  });
  if (drops.length === 0) return null;
  return drops.reduce((t, d) => t + d, 0) / drops.length;
}

/** The minute, to the nearest 5, from which long sessions tend to dip. */
function dipMinute(sessions: readonly LimitSession[]): number {
  const lengths = longSessions(sessions)
    .map((s) => (s.end - s.start) / 60_000)
    .sort((a, b) => a - b);
  const median = lengths[Math.floor(lengths.length / 2)]!;
  return Math.max(5, Math.round((median - 15) / 5) * 5);
}

export interface SuggestionInput {
  today: string;
  level: Level;
  /** The limits in use now for each day type (before any exam-season extra). */
  current: Record<DayType, number>;
  /** Finished days in the last two weeks. */
  days: { day: string; usedMinutes: number; limitMinutes: number }[];
  /** Study sessions in the last two weeks. */
  sessions: LimitSession[];
  /** Finished days in the last two weeks with no study at all. */
  restDays: number;
  /** Sessions stopped part-way in the last two weeks. */
  abandonedSessions: number;
  lastSuggestedOn: string | null;
  lastRaiseOn: string | null;
}

export interface LimitSuggestion {
  kind: 'raise' | 'ease';
  change: number;
  schoolDayMinutes: number;
  otherDayMinutes: number;
  /** Why, in plain words, for the parent. */
  reason: string;
}

const daysSince = (from: string, to: string) =>
  (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;

/**
 * At most one suggestion a week. Easing off wins over a rise: −10 for one tiredness sign, −15 for
 * two or more. A rise (+10, at most once a fortnight, never past the ceiling) needs the limit
 * reached on 4 days in two weeks with late accuracy within 5 points of early accuracy. The app
 * never prompts a student to keep going, so reaching the limit is their own choice.
 */
export function weeklySuggestion(input: SuggestionInput): LimitSuggestion | null {
  const { today, current } = input;
  if (input.lastSuggestedOn && daysSince(input.lastSuggestedOn, today) < SUGGEST_EVERY_DAYS) {
    return null;
  }
  const drop = lateSessionAccuracyDrop(input.sessions);

  const signs: string[] = [];
  if (drop !== null && drop > TIRED_POINTS) {
    signs.push(
      `Accuracy dips after about ${dipMinute(input.sessions)} minutes (down ${Math.round(drop)} points).`,
    );
  }
  if (input.abandonedSessions >= ABANDONED_SIGN)
    signs.push('Several sessions were stopped part-way.');
  if (input.restDays === 0) signs.push('No rest days in the last two weeks.');
  if (signs.length > 0) {
    const change = signs.length >= 2 ? -15 : -10;
    const school = Math.max(MIN_DAILY_LIMIT, current.school + change);
    const other = Math.max(MIN_DAILY_LIMIT, current.other + change);
    if (school === current.school && other === current.other) return null;
    return {
      kind: 'ease',
      change,
      schoolDayMinutes: school,
      otherDayMinutes: other,
      reason: signs.join(' '),
    };
  }

  const ceiling = DAILY_LIMIT_CEILINGS[input.level];
  const atLimit = input.days.filter((d) => d.usedMinutes >= d.limitMinutes).length;
  const raisedRecently =
    input.lastRaiseOn !== null && daysSince(input.lastRaiseOn, today) < RAISE_EVERY_DAYS;
  const steady = drop !== null && drop <= STEADY_POINTS;
  if (atLimit < RAISE_MIN_DAYS_AT_LIMIT || !steady || raisedRecently) return null;
  if (current.school >= ceiling.school) return null;
  return {
    kind: 'raise',
    change: RAISE_MINUTES,
    schoolDayMinutes: Math.min(ceiling.school, current.school + RAISE_MINUTES),
    // Never lowers a limit a parent set above the ceiling by hand.
    otherDayMinutes: Math.max(
      current.other,
      Math.min(ceiling.other, current.other + RAISE_MINUTES),
    ),
    reason: `Reached the daily limit on ${atLimit} days in the last two weeks, with steady accuracy.`,
  };
}

export function applySuggestion(
  settings: DailyLimitSettings,
  suggestion: Pick<LimitSuggestion, 'schoolDayMinutes' | 'otherDayMinutes'>,
): DailyLimitSettings {
  return {
    ...settings,
    schoolDayMinutes: suggestion.schoolDayMinutes,
    otherDayMinutes: suggestion.otherDayMinutes,
  };
}
