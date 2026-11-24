/**
 * Turns a student's loaded data into the two dashboard responses, using the pure rules in
 * packages/core (`stats.ts`). Time is passed in.
 */
import {
  activeMsInRange,
  activeStudy,
  addDays,
  answerTotals,
  bestWeekXp,
  DEFAULT_DAILY_CAP_MINUTES,
  DEFAULT_DAILY_GOAL_XP,
  DEFAULT_WEEKLY_GOAL_DAYS,
  findSubject,
  groupActivity,
  localDate,
  longestCorrectRun,
  periodRange,
  previousPeriod,
  quietSessions,
  restDays,
  studySessions,
  subjectMastery,
  totalXp,
  weakSpotTrend,
  xpByBucket,
  zonedDayStart,
  type ParentDashboard,
  type StatsPeriod,
  type StudentStats,
} from '@revisionden/core';
import { isQuietTime, localClock } from '../notifications/schedule';
import type { StatsAdapters } from './adapters';
import type { StudentStatsData } from './load';

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
const WEEKS_SHOWN = 8;
const TREND_DAYS = 28;

const subjectName = (id: string) => findSubject(id)?.name ?? id;
const minutes = (ms: number) => Math.round(ms / MINUTE_MS);

const goalFor = (period: StatsPeriod) =>
  period === 'week'
    ? DEFAULT_DAILY_GOAL_XP
    : period === 'term'
      ? DEFAULT_DAILY_GOAL_XP * DEFAULT_WEEKLY_GOAL_DAYS
      : null;

export async function buildStudentStats(
  studentId: string,
  data: StudentStatsData,
  period: StatsPeriod,
  now: Date,
  adapters: StatsAdapters,
): Promise<StudentStats> {
  const tz = data.settings.timeZone;
  const range = periodRange(period, localDate(now, tz));
  const before = previousPeriod(range);
  const current = answerTotals(data.answers, range, tz);
  const previous = answerTotals(data.answers, before, tz);
  const since = zonedDayStart(range.start, tz);
  const allXp = data.days.reduce((total, d) => total + d.xp, 0);

  return {
    period,
    range: { start: range.start, end: range.end, label: range.label },
    tiles: {
      xp: { value: totalXp(data.days, range), previous: totalXp(data.days, before) },
      answered: { value: current.answered, correct: current.correct, previous: previous.answered },
      accuracy: { value: current.accuracy, previous: previous.accuracy },
      streak: { current: data.streak.current },
    },
    chart: { buckets: xpByBucket(data.days, range), goal: goalFor(period) },
    mastery: subjectMastery(data.answers, now.getTime(), since).map((m) => ({
      ...m,
      name: subjectName(m.subjectId),
    })),
    personalBests: {
      longestStreak: data.streak.best,
      longestCorrectRun: longestCorrectRun(data.answers),
      bestWeek: bestWeekXp(data.days),
    },
    level: await adapters.level(studentId, allXp),
  };
}

export async function buildDashboard(
  student: { id: string; nickname: string },
  data: StudentStatsData,
  now: Date,
  aiSpend: ParentDashboard['aiSpend'],
  adapters: StatsAdapters,
): Promise<ParentDashboard> {
  const tz = data.settings.timeZone;
  const today = localDate(now, tz);
  const week = periodRange('week', today);
  const lastWeek = previousPeriod(week);
  const times = data.answers.map((a) => a.at);
  const study = activeStudy(times, tz, DEFAULT_DAILY_CAP_MINUTES).days;
  const thisWeek = answerTotals(data.answers, week, tz);
  const priorWeek = answerTotals(data.answers, lastWeek, tz);
  const plan = await adapters.plan(student.id, week.start);

  const weeks = Array.from({ length: WEEKS_SHOWN }, (_, i) => {
    const start = addDays(week.start, -7 * (WEEKS_SHOWN - 1 - i));
    const range = periodRange('week', start);
    return { start, label: range.label.replace('Week of ', ''), value: 0, range };
  }).map(({ range, ...w }) => ({ ...w, value: minutes(activeMsInRange(study, range)) }));

  const sessions = studySessions(times).filter((s) => {
    const day = localDate(new Date(s.start), tz);
    return day >= week.start && day < week.end;
  });
  const isQuiet = (at: number) => isQuietTime(localClock(new Date(at), tz), data.settings);
  const activeDays = new Set(data.answers.map((a) => localDate(new Date(a.at), tz)));

  const trendSince = now.getTime() - TREND_DAYS * DAY_MS;
  const subjects = await Promise.all(
    subjectMastery(data.answers, now.getTime(), trendSince).map(async (m) => ({
      ...m,
      name: subjectName(m.subjectId),
      ...(await adapters.grades(student.id, m.subjectId)),
    })),
  );

  return {
    student,
    week: { start: week.start, end: week.end, label: week.label },
    timeZone: tz,
    tiles: {
      activeMinutes: {
        value: minutes(activeMsInRange(study, week)),
        previous: minutes(activeMsInRange(study, lastWeek)),
      },
      planKept: plan?.kept ?? null,
      accuracy: { value: thisWeek.accuracy, previous: priorWeek.accuracy },
      streak: data.streak,
    },
    studyTime: { weeks, planMinutes: plan?.minutes ?? null },
    subjects,
    weakSpots: weakSpotTrend(data.answers, now.getTime(), trendSince).map((w) => ({
      ...w,
      title: data.topicTitles.get(w.topicId) ?? w.topicId,
    })),
    effortScores: await adapters.effortScores(student.id),
    rewards: await adapters.rewards(student.id),
    healthyHabits: {
      quietHourSessions: quietSessions(sessions, isQuiet),
      daysOverCap: study.filter((d) => d.overCap && d.day >= week.start && d.day < week.end).length,
      restDays: restDays(activeDays, week, today),
      dailyCapMinutes: DEFAULT_DAILY_CAP_MINUTES,
    },
    aiSpend,
    recentActivity: groupActivity(data.activity).map((e) => ({
      ...e,
      at: new Date(e.at).toISOString(),
    })),
  };
}
