/**
 * Friends league rules (docs/FRIENDS_LEAGUE.md). Pure: time and randomness are passed in.
 *
 * - The week runs Monday to Sunday in UK time.
 * - League XP is reward XP (reward-xp.ts: no late-night XP, at most 300 a UK day) earned that
 *   week from answers and completed flashcard sessions only; Bug Hunter and gift XP never count.
 * - Places: equal XP share a place; no XP means no place. A win needs at least one daily goal of
 *   XP and someone else in the league with XP; a tie for first shares the win.
 */
import { DEFAULT_TIME_ZONE, localDate, weekStartOf } from './learning';
import { rewardableXpByDay, type XpEvent } from './reward-xp';
import { DEFAULT_DAILY_GOAL_XP } from './xp';

export const MAX_FRIENDS = 10;
/** One daily goal. */
export const WIN_MIN_XP = DEFAULT_DAILY_GOAL_XP;
export const FRIEND_CODE_LENGTH = 8;
export const FRIEND_CODE_TTL_MS = 48 * 60 * 60 * 1000;
export const FRIEND_REQUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const FRIEND_CODES_PER_DAY = 3;
export const MAX_WAITING_REQUESTS = 3;
export const WRONG_CODE_TRIES_PER_HOUR = 5;
export const FAMILY_CODE_TRIES_PER_DAY = 20;
export const FRIEND_LABEL_MAX = 30;

export const REPORT_REASONS = ['upsetting_name', 'do_not_know', 'pressured', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  upsetting_name: 'Their nickname or picture upsets me',
  do_not_know: "I don't know this person",
  pressured: "I'm being pressured",
  other: 'Something else',
};

export interface LeagueWeek {
  /** Monday, as YYYY-MM-DD (UK). */
  start: string;
  /** Sunday, as YYYY-MM-DD (UK). */
  end: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const addDays = (date: string, days: number) =>
  new Date(new Date(`${date}T00:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);

export function leagueWeek(now: Date, timeZone = DEFAULT_TIME_ZONE): LeagueWeek {
  const start = weekStartOf(localDate(now, timeZone));
  return { start, end: addDays(start, 6) };
}

/**
 * Reward XP earned in the week. With `before` (a UK date), only days before it count: friends
 * see totals up to the end of yesterday, so XP never shows when someone is revising.
 */
export function leagueXp(
  events: readonly XpEvent[],
  week: LeagueWeek,
  { before }: { before?: string } = {},
): number {
  return rewardableXpByDay(events)
    .filter((d) => d.day >= week.start && d.day <= week.end && (!before || d.day < before))
    .reduce((sum, d) => sum + d.xp, 0);
}

export interface LeagueMember {
  id: string;
  xp: number;
}

export interface RankedEntry extends LeagueMember {
  /** 1 for first; equal XP share a place; null when no XP yet ("Not started yet"). */
  place: number | null;
  /** Top of the league with a winning total (shared on a tie). */
  winning: boolean;
}

export function rankLeague(entries: readonly LeagueMember[]): RankedEntry[] {
  const sorted = [...entries].sort((a, b) => b.xp - a.xp);
  const withXp = sorted.filter((e) => e.xp > 0);
  const top = withXp[0]?.xp ?? 0;
  // Someone else must have XP too, so a league of one cannot be won.
  const contested = withXp.length >= 2;
  return sorted.map((e) => {
    if (e.xp <= 0) return { ...e, place: null, winning: false };
    const place = withXp.findIndex((w) => w.xp === e.xp) + 1;
    return { ...e, place, winning: contested && e.xp === top && top >= WIN_MIN_XP };
  });
}

// No 0/O, 1/I/L, so a code read aloud or typed is hard to get wrong (as for parent invites).
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function newFriendCode(
  randomBytes: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n)),
): string {
  return Array.from(
    randomBytes(FRIEND_CODE_LENGTH),
    (b) => CODE_ALPHABET[b % CODE_ALPHABET.length],
  ).join('');
}

export const normaliseFriendCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '');

export const formatFriendCode = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;

/** A parent's private label for a friend: one line of 1 to 30 characters. */
export function validFriendLabel(label: string): boolean {
  const trimmed = label.trim();
  return trimmed.length >= 1 && trimmed.length <= FRIEND_LABEL_MAX && !/[\r\n\t]/.test(trimmed);
}
