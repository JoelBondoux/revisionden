/**
 * Flashcard sessions (workstream F3): deck XP is paid per completed session, not per card.
 * The rules live in packages/core (`flashcard-session.ts`); this file loads and saves.
 */
import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import {
  FLASHCARD_SESSION_XP,
  localDate,
  MAX_REWARDED_SESSIONS_PER_DAY,
  type XpEvent,
} from '@revisionden/core';
import { flashcardSessions, type Database } from '@revisionden/db';
import { isUniqueViolation } from '../http';

const SLOT_KEY = 'flashcard_sessions_reward_slot';

async function slotsTaken(db: Database, studentId: string, day: string) {
  const rows = await db
    .select({ slot: flashcardSessions.rewardSlot })
    .from(flashcardSessions)
    .where(and(eq(flashcardSessions.studentId, studentId), eq(flashcardSessions.rewardedDay, day)));
  return rows.map((r) => r.slot);
}

/** Rewarded sessions still possible on the UK day of `now`. */
export async function rewardedLeftToday(db: Database, studentId: string, now: Date) {
  const used = (await slotsTaken(db, studentId, localDate(now))).length;
  return Math.max(0, MAX_REWARDED_SESSIONS_PER_DAY - used);
}

/**
 * Marks an open session finished, once: a single conditional update, so when two finishes race
 * only one of them gets the row back (the other gets undefined and must not pay anything).
 */
export async function claimFinish(db: Database, sessionId: string, completed: boolean, now: Date) {
  const [row] = await db
    .update(flashcardSessions)
    .set({ finishedAt: now, completed })
    .where(and(eq(flashcardSessions.id, sessionId), isNull(flashcardSessions.finishedAt)))
    .returning({ id: flashcardSessions.id });
  return row;
}

/**
 * Takes a free daily reward slot for a finished session and records its XP. The unique key on
 * (student, day, slot) settles a race between sessions finishing together: the loser tries the
 * next slot, and gets nothing once both are taken. Returns the XP paid (20 or 0).
 */
export async function takeRewardSlot(
  db: Database,
  studentId: string,
  sessionId: string,
  now: Date,
): Promise<number> {
  const day = localDate(now);
  const taken = await slotsTaken(db, studentId, day);
  for (let slot = 1; slot <= MAX_REWARDED_SESSIONS_PER_DAY; slot++) {
    if (taken.includes(slot)) continue;
    try {
      await db
        .update(flashcardSessions)
        .set({ rewardedDay: day, rewardSlot: slot, xpEarned: FLASHCARD_SESSION_XP })
        .where(eq(flashcardSessions.id, sessionId));
      return FLASHCARD_SESSION_XP;
    } catch (err) {
      if (!isUniqueViolation(err, SLOT_KEY)) throw err;
    }
  }
  return 0;
}

/**
 * What rewards need from flashcard sessions: timestamped session XP (so the late-night and
 * daily caps apply) and the cards counted in completed sessions ("flashcards reviewed").
 */
export async function flashcardSessionStats(
  db: Database,
  studentId: string,
): Promise<{ cardsReviewed: number; xpEvents: XpEvent[] }> {
  const rows = await db
    .select({
      at: flashcardSessions.finishedAt,
      xp: flashcardSessions.xpEarned,
      cardIds: flashcardSessions.cardIds,
    })
    .from(flashcardSessions)
    .where(
      and(
        eq(flashcardSessions.studentId, studentId),
        eq(flashcardSessions.completed, true),
        isNotNull(flashcardSessions.finishedAt),
      ),
    );
  return {
    cardsReviewed: rows.reduce((sum, r) => sum + r.cardIds.length, 0),
    xpEvents: rows.filter((r) => r.xp > 0).map((r) => ({ at: r.at!, xp: r.xp })),
  };
}
