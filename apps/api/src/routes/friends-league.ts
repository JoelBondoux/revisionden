/**
 * The weekly friends league for one student (docs/FRIENDS_LEAGUE.md "League rules").
 *
 * League XP is reward XP from answers and completed flashcard sessions this UK week (core
 * `leagueXp`), never Bug Hunter or gift XP. A student sees their own XP live and everyone else's
 * up to the end of yesterday, so the league never shows when someone is revising.
 *
 * Finished weeks are settled lazily (there is no cron in dev, where friends runs for now): the
 * first time a student opens the league or their rewards, each of the last 8 weeks without a
 * result is worked out from the friends they had by the end of that week. A win adds one to
 * `students.league_wins`, which the league rewards count (weeksTopOfLeague).
 */
import { and, eq, gte, inArray, or, sql } from 'drizzle-orm';
import {
  LEAGUE_WEEKS_KEPT,
  leagueWeek,
  leagueWeekEndsAt,
  leagueXp,
  localDate,
  previousLeagueWeeks,
  rankLeague,
  type XpEvent,
} from '@revisionden/core';
import { attempts, friendships, leagueWeeks, students, type Database } from '@revisionden/db';
import { flashcardSessionStats } from '../learning/flashcard-sessions';
import { card, friendsOf, siblings } from './friends';

type StudentRow = typeof students.$inferSelect;

const DAY_MS = 24 * 60 * 60 * 1000;

/** XP events since a time: answers and completed flashcard sessions. */
async function xpEventsSince(db: Database, studentId: string, since: Date): Promise<XpEvent[]> {
  const answers = await db
    .select({ at: attempts.createdAt, xp: attempts.xpEarned })
    .from(attempts)
    .where(and(eq(attempts.studentId, studentId), gte(attempts.createdAt, since)));
  const sessions = await flashcardSessionStats(db, studentId);
  return [...answers, ...sessions.xpEvents.filter((e) => e.at >= since)];
}

/** A little before a Monday in UTC, so every UK day of the week is loaded; leagueXp filters. */
const loadFrom = (weekStart: string) =>
  new Date(new Date(`${weekStart}T00:00:00Z`).getTime() - DAY_MS);

/** Works out and saves each of the last 8 finished weeks that has no result yet. */
export async function settleLeagueWeeks(db: Database, me: StudentRow, now: Date) {
  if (!me.friendsAllowed) return;
  const weeks = previousLeagueWeeks(now, LEAGUE_WEEKS_KEPT);
  const settled = await db
    .select({ weekStart: leagueWeeks.weekStart })
    .from(leagueWeeks)
    .where(and(eq(leagueWeeks.studentId, me.id), gte(leagueWeeks.weekStart, weeks.at(-1)!.start)));
  const done = new Set(settled.map((r) => r.weekStart));
  const todo = weeks.filter((w) => !done.has(w.start) && me.createdAt < leagueWeekEndsAt(w));
  if (todo.length === 0) return;

  const links = await db
    .select()
    .from(friendships)
    .where(or(eq(friendships.studentA, me.id), eq(friendships.studentB, me.id)));
  const friendSince = new Map(
    links.map((l) => [l.studentA === me.id ? l.studentB : l.studentA, l.createdAt]),
  );
  const others = [
    ...(await siblings(db, me)),
    ...(friendSince.size === 0
      ? []
      : await db
          .select()
          .from(students)
          .where(
            and(inArray(students.id, [...friendSince.keys()]), eq(students.friendsAllowed, true)),
          )),
  ].filter((s) => !s.leagueHidden);
  // Each child's XP is loaded once, from the oldest week to settle.
  const from = loadFrom(todo.at(-1)!.start);
  const events = new Map<string, XpEvent[]>();
  for (const s of [me, ...others]) events.set(s.id, await xpEventsSince(db, s.id, from));

  for (const week of todo) {
    const ends = leagueWeekEndsAt(week);
    const members = others.filter(
      (s) => s.createdAt < ends && (friendSince.get(s.id) ?? s.createdAt) < ends,
    );
    const ranked = rankLeague(
      [me, ...members].map((s) => ({ id: s.id, xp: leagueXp(events.get(s.id)!, week) })),
    );
    const mine = ranked.find((r) => r.id === me.id)!;
    // A child hidden from the league is not in it, so cannot win.
    const result = me.leagueHidden
      ? { xp: mine.xp, place: null, won: false }
      : { xp: mine.xp, place: members.length > 0 ? mine.place : null, won: mine.winning };
    const saved = await db
      .insert(leagueWeeks)
      .values({ studentId: me.id, weekStart: week.start, ...result, createdAt: now })
      .onConflictDoNothing()
      .returning({ won: leagueWeeks.won });
    if (saved[0]?.won) {
      await db
        .update(students)
        .set({ leagueWins: sql`${students.leagueWins} + 1` })
        .where(eq(students.id, me.id));
    }
  }
}

export async function leagueFor(db: Database, me: StudentRow, now: Date) {
  const week = leagueWeek(now);
  await settleLeagueWeeks(db, me, now);
  const [previous] = previousLeagueWeeks(now, 1);
  const [last] = await db
    .select({ xp: leagueWeeks.xp, place: leagueWeeks.place, won: leagueWeeks.won })
    .from(leagueWeeks)
    .where(and(eq(leagueWeeks.studentId, me.id), eq(leagueWeeks.weekStart, previous!.start)));
  const lastWeek = last ?? null;
  if (!me.friendsAllowed || me.leagueHidden) {
    return { week, hidden: me.leagueHidden, lastWeek, entries: [] };
  }
  const { friends, siblings: sibs } = await friendsOf(db, me);
  const members = [me, ...sibs, ...friends].filter((s) => s.id === me.id || !s.leagueHidden);
  const since = loadFrom(week.start);
  const today = localDate(now);
  const totals = [];
  for (const s of members) {
    const xp = await xpEventsSince(db, s.id, since);
    totals.push({ id: s.id, xp: leagueXp(xp, week, s.id === me.id ? {} : { before: today }) });
  }
  const byId = new Map(members.map((s) => [s.id, s]));
  return {
    week,
    hidden: false,
    lastWeek,
    entries: rankLeague(totals).map((r) => ({
      ...card(byId.get(r.id)!),
      xp: r.xp,
      place: r.place,
      winning: r.winning,
      you: r.id === me.id,
    })),
  };
}
