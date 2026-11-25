/**
 * XP, the daily goal and the streak, stored per student. Rules live in packages/core
 * (`xp.ts`, `streaks.ts`, `learning.ts`); this file only loads and saves.
 */
import { and, eq, gte, lt, sql } from 'drizzle-orm';
import {
  DEFAULT_DAILY_GOAL_XP,
  localDate,
  newStreak,
  recordGoalMet,
  streakAsOf,
  weekStartOf,
  type Progress,
  type StreakState,
} from '@revisionden/core';
import { dailyXp, streaks, type Database } from '@revisionden/db';
import { dailyLimitToday } from '../daily-limit/state';

const DAY_MS = 86_400_000;
const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

type StreakRow = typeof streaks.$inferSelect;

function toState(row: StreakRow | undefined): StreakState {
  if (!row) return newStreak();
  return {
    current: row.current,
    best: row.best,
    skipDays: row.skipDays,
    giftDays: row.giftDays,
    skipsInARow: row.skipsInARow,
    lastDate: row.lastDate,
    lastSettledWeek: row.lastSettledWeek,
  };
}

async function loadStreak(db: Database, studentId: string): Promise<StreakState> {
  const [row] = await db.select().from(streaks).where(eq(streaks.studentId, studentId));
  return toState(row);
}

async function xpOn(db: Database, studentId: string, day: string): Promise<number> {
  const [row] = await db
    .select({ xp: dailyXp.xp })
    .from(dailyXp)
    .where(and(eq(dailyXp.studentId, studentId), eq(dailyXp.day, day)));
  return row?.xp ?? 0;
}

async function goalDaysInWeek(db: Database, studentId: string, weekStart: string) {
  const [row] = await db
    .select({ days: sql<number>`count(*)::int` })
    .from(dailyXp)
    .where(
      and(
        eq(dailyXp.studentId, studentId),
        gte(dailyXp.day, weekStart),
        lt(dailyXp.day, addDays(weekStart, 7)),
        gte(dailyXp.xp, DEFAULT_DAILY_GOAL_XP),
      ),
    );
  return row?.days ?? 0;
}

/** Progress as the student sees it today (a lapsed streak shows as lapsed). */
export async function getProgress(db: Database, studentId: string, now: Date): Promise<Progress> {
  const today = localDate(now);
  const [total] = await db
    .select({ xp: sql<number>`coalesce(sum(${dailyXp.xp}), 0)::int` })
    .from(dailyXp)
    .where(eq(dailyXp.studentId, studentId));
  const xpToday = await xpOn(db, studentId, today);
  const streak = streakAsOf(await loadStreak(db, studentId), today);
  return {
    xpToday,
    totalXp: total?.xp ?? 0,
    dailyGoalXp: DEFAULT_DAILY_GOAL_XP,
    goalMet: xpToday >= DEFAULT_DAILY_GOAL_XP,
    streak: { current: streak.current, best: streak.best, skipDays: streak.skipDays },
    dailyLimit: await dailyLimitToday(db, studentId, now),
  };
}

/**
 * Adds XP to today. The first time today's total reaches the daily goal, the day is recorded
 * on the streak (settling last week's skip day on the first goal day of a new week).
 */
export async function awardXp(
  db: Database,
  studentId: string,
  xp: number,
  now: Date,
): Promise<Progress> {
  const today = localDate(now);
  const [row] = await db
    .insert(dailyXp)
    .values({ studentId, day: today, xp })
    .onConflictDoUpdate({
      target: [dailyXp.studentId, dailyXp.day],
      set: { xp: sql`${dailyXp.xp} + ${xp}` },
    })
    .returning({ xp: dailyXp.xp });
  const after = row!.xp;
  if (xp > 0 && after >= DEFAULT_DAILY_GOAL_XP && after - xp < DEFAULT_DAILY_GOAL_XP) {
    const state = await loadStreak(db, studentId);
    const lastWeek = addDays(weekStartOf(today), -7);
    const newWeek = state.lastSettledWeek === null || state.lastSettledWeek < lastWeek;
    const next = recordGoalMet(
      state,
      today,
      newWeek && state.lastDate !== null
        ? { daysGoalMetLastWeek: await goalDaysInWeek(db, studentId, lastWeek) }
        : {},
    );
    const values = {
      current: next.current,
      best: next.best,
      skipDays: next.skipDays,
      giftDays: next.giftDays,
      skipsInARow: next.skipsInARow,
      lastDate: next.lastDate,
      lastSettledWeek: next.lastSettledWeek,
    };
    await db
      .insert(streaks)
      .values({ studentId, ...values })
      .onConflictDoUpdate({ target: streaks.studentId, set: values });
  }
  return getProgress(db, studentId, now);
}
