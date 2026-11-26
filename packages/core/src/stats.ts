/**
 * Statistics dashboards (workstream K, docs/PRODUCT_RULES.md "Statistics dashboards").
 *
 * Pure functions only: the caller loads the data and passes the time ("today" as a local date
 * and "now" as an instant), so every rule here is tested with fixed clocks.
 *
 * - Periods: week (Monday to Sunday), term (autumn 1 Sep–31 Dec, spring 1 Jan–31 Mar, summer
 *   1 Apr–31 Aug) and school year (1 Sep–31 Aug), all as local dates in the family time zone.
 * - Active study time is the time between answers. A gap of more than 5 minutes ends the
 *   session and is not counted; time past the daily cap is not counted.
 * - Accuracy is correct ÷ marked answers; part marks count as the fraction earned, and unmarked
 *   answers (score null, such as "check with your teacher") are left out.
 */
import { localDate, weekStartOf } from './learning';
import { helpedMasteryScore } from './help';
import { topicMastery, type MasteryAttempt } from './mastery';
import type { DayXp } from './reward-xp';

export const STATS_PERIODS = ['week', 'term', 'year'] as const;
export type StatsPeriod = (typeof STATS_PERIODS)[number];

/** A gap between answers of more than this ends a study session. */
export const ACTIVE_GAP_MS = 5 * 60_000;
/** Daily study cap until the wellbeing work makes it a parent setting (provisional default). */
export const DEFAULT_DAILY_CAP_MINUTES = 120;

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

// ---------------------------------------------------------------------------------------------
// Dates and periods
// ---------------------------------------------------------------------------------------------

/** Local dates (YYYY-MM-DD); `end` is the day after the last day. */
export interface DateRange {
  start: string;
  end: string;
}

export interface Bucket extends DateRange {
  label: string;
}

export interface PeriodRange extends DateRange {
  period: StatsPeriod;
  label: string;
  buckets: Bucket[];
}

const dayTime = (date: string) => Date.parse(`${date}T00:00:00Z`);
const dateOf = (time: number) => new Date(time).toISOString().slice(0, 10);

export function addDays(date: string, days: number): string {
  return dateOf(dayTime(date) + days * DAY_MS);
}

const inRange = (date: string, range: DateRange) => date >= range.start && date < range.end;

/** The instant (ms since the epoch) a local date starts in a time zone. */
export function zonedDayStart(date: string, timeZone: string): number {
  const guess = dayTime(date);
  const offsetAt = (time: number) => {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(time);
    const part = (type: string) => Number(parts.find((p) => p.type === type)!.value);
    const local = Date.UTC(
      part('year'),
      part('month') - 1,
      part('day'),
      part('hour'),
      part('minute'),
    );
    return local - time;
  };
  const first = guess - offsetAt(guess);
  return guess - offsetAt(first);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const yearOf = (date: string) => Number(date.slice(0, 4));
const monthOf = (date: string) => Number(date.slice(5, 7));
const ymd = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}-01`;
const shortDate = (date: string) => `${Number(date.slice(8, 10))} ${MONTHS[monthOf(date) - 1]}`;

export type TermName = 'Autumn' | 'Spring' | 'Summer';

export function termOf(date: string): DateRange & { name: TermName } {
  const year = yearOf(date);
  const month = monthOf(date);
  if (month >= 9) return { name: 'Autumn', start: ymd(year, 9), end: ymd(year + 1, 1) };
  if (month <= 3) return { name: 'Spring', start: ymd(year, 1), end: ymd(year, 4) };
  return { name: 'Summer', start: ymd(year, 4), end: ymd(year, 9) };
}

function schoolYearOf(date: string): DateRange & { label: string } {
  const first = monthOf(date) >= 9 ? yearOf(date) : yearOf(date) - 1;
  return {
    start: ymd(first, 9),
    end: ymd(first + 1, 9),
    label: `${first}/${String((first + 1) % 100).padStart(2, '0')}`,
  };
}

function weekBuckets(range: DateRange): Bucket[] {
  const buckets: Bucket[] = [];
  for (let monday = weekStartOf(range.start); monday < range.end; monday = addDays(monday, 7)) {
    const start = monday < range.start ? range.start : monday;
    const next = addDays(monday, 7);
    buckets.push({ start, end: next > range.end ? range.end : next, label: shortDate(start) });
  }
  return buckets;
}

/** The period containing `today` (a local date), with its chart buckets. */
export function periodRange(period: StatsPeriod, today: string): PeriodRange {
  if (period === 'week') {
    const start = weekStartOf(today);
    const buckets = WEEKDAYS.map((label, i) => ({
      start: addDays(start, i),
      end: addDays(start, i + 1),
      label,
    }));
    return { period, start, end: addDays(start, 7), label: `Week of ${shortDate(start)}`, buckets };
  }
  if (period === 'term') {
    const term = termOf(today);
    return {
      period,
      start: term.start,
      end: term.end,
      label: `${term.name} term`,
      buckets: weekBuckets(term),
    };
  }
  const year = schoolYearOf(today);
  const first = yearOf(year.start);
  const buckets = Array.from({ length: 12 }, (_, i) => {
    const month = ((8 + i) % 12) + 1;
    const y = month >= 9 ? first : first + 1;
    const next = month === 12 ? ymd(y + 1, 1) : ymd(y, month + 1);
    return { start: ymd(y, month), end: next, label: MONTHS[month - 1]! };
  });
  return { period, ...year, buckets };
}

export function previousPeriod(range: PeriodRange): PeriodRange {
  return periodRange(range.period, addDays(range.start, -1));
}

// ---------------------------------------------------------------------------------------------
// XP
// ---------------------------------------------------------------------------------------------

export interface BucketValue {
  start: string;
  label: string;
  value: number;
}

const sumIn = (days: readonly DayXp[], range: DateRange) =>
  days.filter((d) => inRange(d.day, range)).reduce((total, d) => total + d.xp, 0);

export function xpByBucket(days: readonly DayXp[], range: PeriodRange): BucketValue[] {
  return range.buckets.map((b) => ({ start: b.start, label: b.label, value: sumIn(days, b) }));
}

export function totalXp(days: readonly DayXp[], range: DateRange): number {
  return sumIn(days, range);
}

export function bestWeekXp(days: readonly DayXp[]): { weekStart: string; xp: number } | null {
  const weeks = new Map<string, number>();
  for (const d of days) {
    const week = weekStartOf(d.day);
    weeks.set(week, (weeks.get(week) ?? 0) + d.xp);
  }
  let best: { weekStart: string; xp: number } | null = null;
  for (const [weekStart, xp] of [...weeks].sort(([a], [b]) => a.localeCompare(b))) {
    if (!best || xp > best.xp) best = { weekStart, xp };
  }
  return best;
}

// ---------------------------------------------------------------------------------------------
// Answers and accuracy
// ---------------------------------------------------------------------------------------------

export interface StatsAnswer {
  /** Milliseconds since the epoch. */
  at: number;
  /** Fraction of marks, 0 to 1; null when the answer was not marked. */
  score: number | null;
  topicId: string;
  subjectId: string;
  /** Answered after "Help me understand" (F10): counts as wrong for mastery, not for accuracy. */
  helped?: boolean;
}

export interface AnswerTotals {
  answered: number;
  /** Answers with full marks. */
  correct: number;
  marked: number;
  /** 0 to 100, or null when nothing was marked. */
  accuracy: number | null;
}

export function answerTotals(
  answers: readonly StatsAnswer[],
  range: DateRange,
  timeZone: string,
): AnswerTotals {
  const inPeriod = answers.filter((a) => inRange(localDate(new Date(a.at), timeZone), range));
  const marked = inPeriod.filter((a) => a.score !== null);
  const earned = marked.reduce((total, a) => total + a.score!, 0);
  return {
    answered: inPeriod.length,
    correct: marked.filter((a) => a.score === 1).length,
    marked: marked.length,
    accuracy: marked.length ? Math.round((100 * earned) / marked.length) : null,
  };
}

/** Most full-mark answers in a row; unmarked answers neither add to nor break a run. */
export function longestCorrectRun(answers: readonly StatsAnswer[]): number {
  let best = 0;
  let run = 0;
  for (const a of [...answers].sort((x, y) => x.at - y.at)) {
    if (a.score === null) continue;
    run = a.score === 1 ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

// ---------------------------------------------------------------------------------------------
// Active study time and healthy habits
// ---------------------------------------------------------------------------------------------

export interface StudySession {
  start: number;
  end: number;
}

export interface StudyDay {
  day: string;
  /** Active study time counted for the day, after the daily cap. */
  ms: number;
  /** True when the day went past the daily cap. */
  overCap: boolean;
}

export function studySessions(times: readonly number[], gapMs = ACTIVE_GAP_MS): StudySession[] {
  const sessions: StudySession[] = [];
  for (const time of [...times].sort((a, b) => a - b)) {
    const last = sessions.at(-1);
    if (last && time - last.end <= gapMs) last.end = time;
    else sessions.push({ start: time, end: time });
  }
  return sessions;
}

/** Active study time per local day. Time between two answers goes to the later answer's day. */
export function activeStudy(
  times: readonly number[],
  timeZone: string,
  /** The daily limit in minutes, the same every day or looked up per local day. */
  dailyCapMinutes: number | ((day: string) => number),
): { days: StudyDay[] } {
  const sorted = [...times].sort((a, b) => a - b);
  const raw = new Map<string, number>();
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i]! - sorted[i - 1]!;
    if (gap > ACTIVE_GAP_MS) continue;
    const day = localDate(new Date(sorted[i]!), timeZone);
    raw.set(day, (raw.get(day) ?? 0) + gap);
  }
  const capOf = (day: string) =>
    (typeof dailyCapMinutes === 'number' ? dailyCapMinutes : dailyCapMinutes(day)) * MINUTE_MS;
  const days = [...raw]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, ms]) => ({ day, ms: Math.min(ms, capOf(day)), overCap: ms > capOf(day) }));
  return { days };
}

export function activeMsInRange(days: readonly StudyDay[], range: DateRange): number {
  return days.filter((d) => inRange(d.day, range)).reduce((total, d) => total + d.ms, 0);
}

export function quietSessions(
  sessions: readonly StudySession[],
  isQuiet: (at: number) => boolean,
): number {
  return sessions.filter((s) => isQuiet(s.start)).length;
}

/** Finished days (before `today`) in the range with no study at all. */
export function restDays(activeDays: ReadonlySet<string>, range: DateRange, today: string): number {
  let count = 0;
  for (let day = range.start; day < range.end && day < today; day = addDays(day, 1)) {
    if (!activeDays.has(day)) count++;
  }
  return count;
}

// ---------------------------------------------------------------------------------------------
// Mastery
// ---------------------------------------------------------------------------------------------

const markedUpTo = (answers: readonly StatsAnswer[], topicId: string, at: number) =>
  answers
    .filter((a) => a.topicId === topicId && a.score !== null && a.at <= at)
    .map((a): MasteryAttempt => ({ score: a.helped ? helpedMasteryScore() : a.score!, at: a.at }));

/** Topic mastery (0 to 100) as it stood at `at`, replayed from the marked answers. */
export function masteryAt(
  answers: readonly StatsAnswer[],
  topicIds: readonly string[],
  at: number,
): Record<string, number> {
  return Object.fromEntries(
    topicIds.map((id) => [id, topicMastery(markedUpTo(answers, id, at), at)]),
  );
}

/** Practised topics by subject, in the order they were first answered. */
function practisedTopics(answers: readonly StatsAnswer[]): Map<string, string[]> {
  const bySubject = new Map<string, string[]>();
  for (const a of [...answers].sort((x, y) => x.at - y.at)) {
    if (a.score === null) continue;
    const list = bySubject.get(a.subjectId) ?? [];
    if (!list.includes(a.topicId)) list.push(a.topicId);
    bySubject.set(a.subjectId, list);
  }
  return bySubject;
}

const average = (values: readonly number[]) =>
  Math.round(values.reduce((t, v) => t + v, 0) / values.length);

export interface SubjectMastery {
  subjectId: string;
  /** Average of the subject's practised topic mastery scores, 0 to 100. */
  mastery: number;
  /** Change in that average since `since` (topics not yet practised then count as 0). */
  change: number;
}

export function subjectMastery(
  answers: readonly StatsAnswer[],
  now: number,
  since: number,
): SubjectMastery[] {
  return [...practisedTopics(answers)]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([subjectId, topicIds]) => {
      const current = average(Object.values(masteryAt(answers, topicIds, now)));
      const before = average(Object.values(masteryAt(answers, topicIds, since)));
      return { subjectId, mastery: current, change: current - before };
    });
}

export interface WeakSpotTrend {
  topicId: string;
  subjectId: string;
  then: number;
  now: number;
}

/** The weakest practised topics now (lowest first), with their mastery at `then`. */
export function weakSpotTrend(
  answers: readonly StatsAnswer[],
  now: number,
  then: number,
  count = 3,
): WeakSpotTrend[] {
  const topics = [...practisedTopics(answers)].flatMap(([subjectId, ids]) =>
    ids.map((topicId) => ({ topicId, subjectId })),
  );
  const ids = topics.map((t) => t.topicId);
  const current = masteryAt(answers, ids, now);
  const before = masteryAt(answers, ids, then);
  return topics
    .map((t) => ({ ...t, then: before[t.topicId]!, now: current[t.topicId]! }))
    .sort((a, b) => a.now - b.now || a.topicId.localeCompare(b.topicId))
    .slice(0, count);
}

// ---------------------------------------------------------------------------------------------
// Framing and activity
// ---------------------------------------------------------------------------------------------

export type KindChange = { trend: 'up'; by: number } | { trend: 'same' } | { trend: 'none' };

/** The student view shows gains and "same", never a drop. */
export function kindChange(current: number | null, previous: number | null): KindChange {
  if (current === null || previous === null || current < previous) return { trend: 'none' };
  if (current === previous) return { trend: 'same' };
  return { trend: 'up', by: current - previous };
}

export type ActivityKind = 'lesson' | 'test' | 'starting_test' | 'flashcards';

export interface ActivityEvent {
  kind: ActivityKind;
  at: number;
  subjectId: string | null;
}

export interface ActivityEntry extends ActivityEvent {
  /** How many answers or reviews the entry groups. */
  count: number;
}

/** Groups back-to-back events (same kind and subject, gaps up to 5 minutes), newest first. */
export function groupActivity(events: readonly ActivityEvent[], limit = 10): ActivityEntry[] {
  const groups: ActivityEntry[] = [];
  for (const e of [...events].sort((a, b) => a.at - b.at)) {
    const last = groups.at(-1);
    if (
      last &&
      last.kind === e.kind &&
      last.subjectId === e.subjectId &&
      e.at - last.at <= ACTIVE_GAP_MS
    ) {
      last.at = e.at;
      last.count++;
    } else {
      groups.push({ ...e, count: 1 });
    }
  }
  return groups.reverse().slice(0, limit);
}
