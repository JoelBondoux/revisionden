/**
 * The weekly friends league for one student (docs/FRIENDS_LEAGUE.md "League rules").
 *
 * League XP is reward XP from answers and completed flashcard sessions this UK week (core
 * `leagueXp`), never Bug Hunter or gift XP. A student sees their own XP live and everyone else's
 * up to the end of yesterday, so the league never shows when someone is revising.
 */
import { and, eq, gte } from 'drizzle-orm';
import { leagueWeek, leagueXp, localDate, rankLeague } from '@revisionden/core';
import { attempts, students, type Database } from '@revisionden/db';
import { flashcardSessionStats } from '../learning/flashcard-sessions';
import { card, friendsOf } from './friends';

type StudentRow = typeof students.$inferSelect;

const DAY_MS = 24 * 60 * 60 * 1000;

/** XP events since a time: answers and completed flashcard sessions. */
async function xpEventsSince(db: Database, studentId: string, since: Date) {
  const answers = await db
    .select({ at: attempts.createdAt, xp: attempts.xpEarned })
    .from(attempts)
    .where(and(eq(attempts.studentId, studentId), gte(attempts.createdAt, since)));
  const sessions = await flashcardSessionStats(db, studentId);
  return [...answers, ...sessions.xpEvents.filter((e) => e.at >= since)];
}

export async function leagueFor(db: Database, me: StudentRow, now: Date) {
  const week = leagueWeek(now);
  if (!me.friendsAllowed || me.leagueHidden) {
    return { week, hidden: me.leagueHidden, entries: [] };
  }
  const { friends, siblings } = await friendsOf(db, me);
  const members = [me, ...siblings, ...friends].filter((s) => s.id === me.id || !s.leagueHidden);
  // A little before Monday in UTC, so every UK day of the week is loaded; leagueXp filters.
  const since = new Date(new Date(`${week.start}T00:00:00Z`).getTime() - DAY_MS);
  const today = localDate(now);
  const totals = [];
  for (const s of members) {
    const events = await xpEventsSince(db, s.id, since);
    totals.push({
      id: s.id,
      xp: leagueXp(events, week, s.id === me.id ? {} : { before: today }),
    });
  }
  const byId = new Map(members.map((s) => [s.id, s]));
  return {
    week,
    hidden: false,
    entries: rankLeague(totals).map((r) => ({
      ...card(byId.get(r.id)!),
      xp: r.xp,
      place: r.place,
      winning: r.winning,
      you: r.id === me.id,
    })),
  };
}
