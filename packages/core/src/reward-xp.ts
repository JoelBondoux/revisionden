/**
 * Which XP counts towards levels and year chapters (see docs/REWARDS.md "Healthy limits").
 *
 * Rewards follow learning, never screen time: only XP from answers counts (never minutes), XP
 * earned late at night (22:00 to 05:59 UK time) does not count, and at most DAILY_REWARD_XP_CAP
 * counts per UK day. The XP itself is still shown and still counts for the daily goal.
 */
import { DEFAULT_TIME_ZONE, localDate } from './learning';

export const LATE_NIGHT_START_HOUR = 22;
export const LATE_NIGHT_END_HOUR = 6;
/** Five times the daily goal: a long, focused day is never capped. */
export const DAILY_REWARD_XP_CAP = 300;

export interface XpEvent {
  at: Date;
  xp: number;
}

export interface DayXp {
  day: string;
  xp: number;
}

function ukHour(at: Date): number {
  const hour = new Intl.DateTimeFormat('en-GB', {
    timeZone: DEFAULT_TIME_ZONE,
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(at);
  return Number(hour);
}

export function isLateNight(at: Date): boolean {
  const hour = ukHour(at);
  return hour >= LATE_NIGHT_START_HOUR || hour < LATE_NIGHT_END_HOUR;
}

/** Reward XP per UK day, oldest first: late night dropped, each day capped. */
export function rewardableXpByDay(events: readonly XpEvent[]): DayXp[] {
  const byDay = new Map<string, number>();
  for (const { at, xp } of events) {
    if (xp <= 0 || isLateNight(at)) continue;
    const day = localDate(at);
    byDay.set(day, Math.min(DAILY_REWARD_XP_CAP, (byDay.get(day) ?? 0) + xp));
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, xp]) => ({ day, xp }));
}

export function rewardableXp(events: readonly XpEvent[]): number {
  return rewardableXpByDay(events).reduce((sum, d) => sum + d.xp, 0);
}
