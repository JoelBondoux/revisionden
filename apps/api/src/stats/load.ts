/**
 * Loads what the statistics dashboards need for one student. Read-only: no new data is
 * collected. The rules for the numbers live in packages/core (`stats.ts`).
 */
import { asc, eq, isNotNull, and } from 'drizzle-orm';
import type { ActivityEvent, DayXp, StatsAnswer } from '@revisionden/core';
import { attempts, dailyXp, flashcards, items, topics, type Database } from '@revisionden/db';
import { getProgress } from '../learning/progress';
import { loadReminderSettings } from '../notifications/runner';
import { limitOn, loadLimitContext } from '../daily-limit/state';
import type { ReminderSettings } from '../notifications/schedule';

export interface StudentStatsData {
  answers: StatsAnswer[];
  activity: ActivityEvent[];
  days: DayXp[];
  streak: { current: number; best: number };
  topicTitles: Map<string, string>;
  settings: ReminderSettings;
  /** The student's daily limit in minutes on a local date (workstream K7). */
  limitOn?: (day: string) => number;
}

export async function loadStatsData(
  db: Database,
  studentId: string,
  now: Date,
): Promise<StudentStatsData> {
  const rows = await db
    .select({
      at: attempts.createdAt,
      score: attempts.score,
      mode: attempts.mode,
      startingTestId: attempts.startingTestId,
      topicId: topics.id,
      subjectId: topics.subjectId,
      title: topics.title,
    })
    .from(attempts)
    .innerJoin(items, eq(items.id, attempts.itemId))
    .innerJoin(topics, eq(topics.id, items.topicId))
    .where(eq(attempts.studentId, studentId))
    .orderBy(asc(attempts.createdAt));

  const reviews = await db
    .select({ at: flashcards.lastReviewedAt, subjectId: topics.subjectId })
    .from(flashcards)
    .innerJoin(topics, eq(topics.id, flashcards.topicId))
    .where(and(eq(flashcards.studentId, studentId), isNotNull(flashcards.lastReviewedAt)));

  const days = await db
    .select({ day: dailyXp.day, xp: dailyXp.xp })
    .from(dailyXp)
    .where(eq(dailyXp.studentId, studentId));
  // As the student sees it today: a lapsed streak shows as lapsed.
  const { streak } = await getProgress(db, studentId, now);

  const topicTitles = new Map(rows.map((r) => [r.topicId, r.title]));
  const answers = rows.map((r) => ({
    at: r.at.getTime(),
    score: r.score,
    topicId: r.topicId,
    subjectId: r.subjectId,
  }));
  const activity: ActivityEvent[] = [
    ...rows.map((r) => ({
      kind: r.startingTestId
        ? ('starting_test' as const)
        : r.mode === 'test'
          ? ('test' as const)
          : ('lesson' as const),
      at: r.at.getTime(),
      subjectId: r.subjectId,
    })),
    // Only the latest review of each card is stored; reviews show as flashcard practice.
    ...reviews.map((r) => ({
      kind: 'flashcards' as const,
      at: r.at!.getTime(),
      subjectId: r.subjectId,
    })),
  ];

  return {
    answers,
    activity,
    days,
    streak: { current: streak.current, best: streak.best },
    topicTitles,
    settings: await loadReminderSettings(db, studentId),
    limitOn: await loadLimitContext(db, studentId).then(
      (ctx) => (day) => limitOn(ctx, day).minutes,
    ),
  };
}
