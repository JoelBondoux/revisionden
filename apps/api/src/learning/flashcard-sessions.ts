/**
 * Flashcard sessions (workstream F3): deck XP is paid per completed session, not per card.
 * The rules live in packages/core (`flashcard-session.ts`); this file loads and saves.
 */
import { and, eq, gt, isNotNull } from 'drizzle-orm';
import { localDate, MAX_REWARDED_SESSIONS_PER_DAY, type XpEvent } from '@revisionden/core';
import { flashcardSessions, type Database } from '@revisionden/db';

/** Rewarded sessions still possible on the UK day of `now`. */
export async function rewardedLeftToday(db: Database, studentId: string, now: Date) {
  const rows = await db
    .select({ at: flashcardSessions.finishedAt })
    .from(flashcardSessions)
    .where(and(eq(flashcardSessions.studentId, studentId), gt(flashcardSessions.xpEarned, 0)));
  const today = localDate(now);
  const used = rows.filter((r) => r.at && localDate(r.at) === today).length;
  return Math.max(0, MAX_REWARDED_SESSIONS_PER_DAY - used);
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
