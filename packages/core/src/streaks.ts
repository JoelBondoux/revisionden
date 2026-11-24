/**
 * Streaks, skip days and gift days (see docs/PRODUCT_RULES.md).
 *
 * - A streak day counts when the daily goal is met.
 * - A missed day uses a skip day if one is available, which keeps the streak (without adding
 *   to it). No more than 2 skip days in a row: the third missed day breaks the streak.
 * - Skip days are earned by hitting the weekly goal (default: daily goal met on 5 days).
 * - Gift days come with some rewards. They are never used on the student's own streak; they can
 *   only be given to a friend, who receives them as a skip day. Gifting earns the giver 20 XP.
 * Dates are calendar dates (YYYY-MM-DD) in the student's own time zone, worked out by the caller.
 */
import { GIFT_XP } from './xp';

export const MAX_SKIPS_IN_A_ROW = 2;
export const DEFAULT_WEEKLY_GOAL_DAYS = 5;

export interface StreakState {
  current: number;
  best: number;
  skipDays: number;
  giftDays: number;
  /** Skip days used back to back up to the last recorded day. */
  skipsInARow: number;
  lastDate: string | null;
  lastSettledWeek: string | null;
}

export type DayEvent =
  | { date: string; outcome: 'goal_met' }
  | { date: string; outcome: 'skip_used' }
  | { date: string; outcome: 'streak_broken'; reason: 'no_skip_days' | 'skip_limit' };

export function newStreak(): StreakState {
  return {
    current: 0,
    best: 0,
    skipDays: 0,
    giftDays: 0,
    skipsInARow: 0,
    lastDate: null,
    lastSettledWeek: null,
  };
}

const DAY_MS = 86_400_000;

function dayNumber(date: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const time = match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : NaN;
  if (Number.isNaN(time) || new Date(time).toISOString().slice(0, 10) !== date) {
    throw new Error(`Not a valid date (use YYYY-MM-DD): ${date}`);
  }
  return time / DAY_MS;
}

const dateOf = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);

function applyDay(state: StreakState, date: string, goalMet: boolean): [StreakState, DayEvent] {
  if (goalMet) {
    const current = state.current + 1;
    const next = { ...state, current, best: Math.max(state.best, current), skipsInARow: 0 };
    return [
      { ...next, lastDate: date },
      { date, outcome: 'goal_met' },
    ];
  }
  if (state.skipDays > 0 && state.skipsInARow < MAX_SKIPS_IN_A_ROW) {
    const next = { ...state, skipDays: state.skipDays - 1, skipsInARow: state.skipsInARow + 1 };
    return [
      { ...next, lastDate: date },
      { date, outcome: 'skip_used' },
    ];
  }
  const reason = state.skipDays > 0 ? 'skip_limit' : 'no_skip_days';
  return [
    { ...state, current: 0, skipsInARow: 0, lastDate: date },
    { date, outcome: 'streak_broken', reason },
  ];
}

/**
 * Records a finished day. Any days between the last recorded day and this one count as missed.
 */
export function recordDay(
  state: StreakState,
  day: { date: string; goalMet: boolean },
): { state: StreakState; events: DayEvent[] } {
  const target = dayNumber(day.date);
  const start = state.lastDate === null ? target : dayNumber(state.lastDate) + 1;
  if (target < start) throw new Error(`Day ${day.date} must be after ${state.lastDate}`);
  const events: DayEvent[] = [];
  let next = state;
  for (let d = start; d <= target; d++) {
    const [updated, event] = applyDay(next, dateOf(d), d === target && day.goalMet);
    next = updated;
    events.push(event);
  }
  return { state: next, events };
}

/** Pays out one skip day if the weekly goal was hit. Each week pays out at most once. */
export function settleWeek(
  state: StreakState,
  week: { weekStart: string; daysGoalMet: number; targetDays?: number },
): StreakState {
  dayNumber(week.weekStart);
  if (state.lastSettledWeek !== null && week.weekStart <= state.lastSettledWeek) return state;
  const earned = week.daysGoalMet >= (week.targetDays ?? DEFAULT_WEEKLY_GOAL_DAYS) ? 1 : 0;
  return { ...state, skipDays: state.skipDays + earned, lastSettledWeek: week.weekStart };
}

export function earnGiftDays(state: StreakState, count: number): StreakState {
  return { ...state, giftDays: state.giftDays + count };
}

export type GiftResult =
  | { ok: true; giver: StreakState; receiver: StreakState; xpEarned: number }
  | { ok: false; reason: 'own_streak' | 'not_friends' | 'no_gift_days' };

export function giftDay(input: {
  giverId: string;
  receiverId: string;
  areFriends: boolean;
  giver: StreakState;
  receiver: StreakState;
}): GiftResult {
  const { giverId, receiverId, areFriends, giver, receiver } = input;
  if (giverId === receiverId) return { ok: false, reason: 'own_streak' };
  if (!areFriends) return { ok: false, reason: 'not_friends' };
  if (giver.giftDays < 1) return { ok: false, reason: 'no_gift_days' };
  return {
    ok: true,
    giver: { ...giver, giftDays: giver.giftDays - 1 },
    receiver: { ...receiver, skipDays: receiver.skipDays + 1 },
    xpEarned: GIFT_XP,
  };
}
