/**
 * Learning from mistakes on the server (workstream F5). The rules live in packages/core
 * (`mistakes.ts`); this file finds similar questions and keeps the review ladder.
 *
 * - Similar question: another servable question on the same learning point (the item's own
 *   learning_point, or its topic when it has none), not a flashcard or long answer, that the
 *   student has not answered in the last 7 days, closest in difficulty first.
 * - Review ladder: one row per student and learning point in `review_points`, updated after
 *   every Learn mode answer that is marked (not flashcards or long answers).
 * - Warm-ups: lessons and the 5-a-day start with up to 2 questions on due learning points.
 */
import { and, asc, eq, inArray, isNull, lte, notInArray, sql, type SQL } from 'drizzle-orm';
import {
  DAY_MS,
  learningPointOf,
  localDate,
  reviewAfterAnswer,
  type LearnItem,
  type ReviewOutcome,
} from '@revisionden/core';
import { attempts, items, reviewPoints, topics, type Database } from '@revisionden/db';
import { toLearnItem, type ItemRow } from './items';

/** A similar question is one the student has not seen for this long. */
export const SIMILAR_UNSEEN_DAYS = 7;
/** At most this many warm-up questions open a lesson or the 5-a-day. */
export const WARM_UP_LIMIT = 2;

const UNTIMED = ['flashcard', 'extended_answer'];

/** Items on a learning point: its tag, or the topic's items without a tag of their own. */
function onPoint(learningPoint: string, topicId: string): SQL {
  return learningPoint === topicId
    ? and(eq(items.topicId, topicId), isNull(items.learningPoint))!
    : eq(items.learningPoint, learningPoint);
}

/** Item ids the student answered on or after `since`. */
async function answeredSince(db: Database, studentId: string, since: Date) {
  const rows = await db
    .selectDistinct({ itemId: attempts.itemId })
    .from(attempts)
    .where(and(eq(attempts.studentId, studentId), sql`${attempts.createdAt} >= ${since}`));
  return rows.map((r) => r.itemId);
}

/** Questions on a learning point the student has not answered recently, closest difficulty first. */
async function freshOnPoint(
  db: Database,
  servable: SQL,
  studentId: string,
  point: { learningPoint: string; topicId: string; difficulty?: number | null },
  now: Date,
  exclude: string[],
) {
  const seen = await answeredSince(
    db,
    studentId,
    new Date(now.getTime() - SIMILAR_UNSEEN_DAYS * DAY_MS),
  );
  const skip = [...new Set([...seen, ...exclude])];
  return db
    .select({ item: items, topicTitle: topics.title })
    .from(items)
    .innerJoin(topics, eq(topics.id, items.topicId))
    .where(
      and(
        servable,
        onPoint(point.learningPoint, point.topicId),
        notInArray(items.type, UNTIMED),
        skip.length > 0 ? notInArray(items.id, skip) : undefined,
      ),
    )
    .orderBy(
      sql`abs(coalesce(${items.difficulty}, 0) - ${point.difficulty ?? 0})`,
      asc(items.contentId),
    );
}

/** Another question on the same learning point as a missed one, or null. */
export async function findSimilar(
  db: Database,
  servable: SQL,
  studentId: string,
  row: ItemRow,
  now: Date,
): Promise<LearnItem | null> {
  const [found] = await freshOnPoint(
    db,
    servable,
    studentId,
    { learningPoint: learningPointOf(row), topicId: row.topicId, difficulty: row.difficulty },
    now,
    [row.id],
  );
  return found ? toLearnItem(found.item, found.topicTitle) : null;
}

/** Moves the item's learning point on the review ladder after an answer. */
export async function recordReview(
  db: Database,
  studentId: string,
  row: ItemRow,
  outcome: ReviewOutcome,
  now: Date,
) {
  const learningPoint = learningPointOf(row);
  const key = and(
    eq(reviewPoints.studentId, studentId),
    eq(reviewPoints.learningPoint, learningPoint),
  );
  const [current] = await db.select().from(reviewPoints).where(key);
  const next = reviewAfterAnswer(current ?? null, outcome, localDate(now));
  if (next === null) {
    if (current) await db.delete(reviewPoints).where(key);
    return;
  }
  if (current && next.rung === current.rung && next.dueDay === current.dueDay) return;
  await db
    .insert(reviewPoints)
    .values({ studentId, learningPoint, topicId: row.topicId, ...next, updatedAt: now })
    .onConflictDoUpdate({
      target: [reviewPoints.studentId, reviewPoints.learningPoint],
      set: { rung: next.rung, dueDay: next.dueDay, updatedAt: now },
    });
}

/** Learning points due today in the given subjects, the most overdue first. */
async function duePoints(db: Database, studentId: string, subjectIds: string[], now: Date) {
  if (subjectIds.length === 0) return [];
  return db
    .select({
      learningPoint: reviewPoints.learningPoint,
      topicId: reviewPoints.topicId,
      dueDay: reviewPoints.dueDay,
    })
    .from(reviewPoints)
    .innerJoin(topics, eq(topics.id, reviewPoints.topicId))
    .where(
      and(
        eq(reviewPoints.studentId, studentId),
        lte(reviewPoints.dueDay, localDate(now)),
        inArray(topics.subjectId, subjectIds),
      ),
    )
    .orderBy(asc(reviewPoints.dueDay), asc(reviewPoints.learningPoint));
}

/**
 * Up to WARM_UP_LIMIT warm-up questions on learning points due today, one per point, marked
 * `warmUp`. Prefers a question not seen in the last 7 days, else any question on the point.
 */
export async function warmUps(
  db: Database,
  servable: SQL,
  studentId: string,
  subjectIds: string[],
  now: Date,
  exclude: string[] = [],
): Promise<LearnItem[]> {
  const due = await duePoints(db, studentId, subjectIds, now);
  const picked: LearnItem[] = [];
  const taken = [...exclude];
  for (const point of due) {
    if (picked.length >= WARM_UP_LIMIT) break;
    const [fresh] = await freshOnPoint(db, servable, studentId, point, now, taken);
    const choice =
      fresh ??
      (
        await db
          .select({ item: items, topicTitle: topics.title })
          .from(items)
          .innerJoin(topics, eq(topics.id, items.topicId))
          .where(
            and(
              servable,
              onPoint(point.learningPoint, point.topicId),
              notInArray(items.type, UNTIMED),
              taken.length > 0 ? notInArray(items.id, taken) : undefined,
            ),
          )
          .orderBy(asc(items.contentId))
          .limit(1)
      )[0];
    if (!choice) continue;
    taken.push(choice.item.id);
    picked.push({ ...toLearnItem(choice.item, choice.topicTitle), warmUp: true });
  }
  return picked;
}

/** The learning points currently due for a student (to mark warm-ups in a stored set). */
export async function dueLearningPoints(db: Database, studentId: string, now: Date) {
  const rows = await db
    .select({ learningPoint: reviewPoints.learningPoint })
    .from(reviewPoints)
    .where(and(eq(reviewPoints.studentId, studentId), lte(reviewPoints.dueDay, localDate(now))));
  return new Set(rows.map((r) => r.learningPoint));
}
