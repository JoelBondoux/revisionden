/**
 * Daily 5-a-day for a signed-in student device (workstream Q), GET /v1/student/daily.
 *
 * The first request of the student's local day picks the set (`selectDailySet` in core, seeded
 * by student and day) and stores it in `daily_sets`, so every later request that day shows the
 * same set. It is done once every item in it has an attempt after the set was made. Answers go
 * through the normal attempts route, so XP, combos, the daily goal and the streak apply as usual.
 */
import { Hono } from 'hono';
import { and, asc, eq, gt, inArray, isNotNull, max, ne } from 'drizzle-orm';
import {
  DAILY_SET_SIZE,
  createRng,
  learningPointOf,
  dailySeed,
  dailySetProgress,
  localDate,
  selectDailySet,
  type Candidate,
  type DailySetResponse,
} from '@revisionden/core';
import {
  attempts,
  dailySets,
  enrolments,
  flashcards,
  items,
  mastery,
  topics,
} from '@revisionden/db';
import type { AppEnv } from '../context';
import { selectableItem, toLearnItem } from '../learning/items';
import { dueLearningPoints, warmUps } from '../learning/mistakes';
import type { LearnDeps } from './learn';

export function studentDailyRoutes({ db, clock, config, mathsEngine }: LearnDeps) {
  const app = new Hono<AppEnv>();
  // Picked for students: without the maths engine, no typed working (F12).
  const servable = selectableItem(config.serveDraftContent, mathsEngine !== undefined);

  /** Picks today's item ids from the student's practised topics in their enrolled subjects. */
  async function pickSet(studentId: string, day: string, now: Date): Promise<string[]> {
    const enrolled = await db
      .select({ subjectId: enrolments.subjectId })
      .from(enrolments)
      .where(eq(enrolments.studentId, studentId));
    const subjectIds = enrolled.map((e) => e.subjectId);
    if (subjectIds.length === 0) return [];

    const practised = await db
      .select({
        topicId: items.topicId,
        subjectId: topics.subjectId,
        last: max(attempts.createdAt),
      })
      .from(attempts)
      .innerJoin(items, eq(items.id, attempts.itemId))
      .innerJoin(topics, eq(topics.id, items.topicId))
      .where(and(eq(attempts.studentId, studentId), inArray(topics.subjectId, subjectIds)))
      .groupBy(items.topicId, topics.subjectId);
    if (practised.length === 0) return [];

    const levels = await db.select().from(mastery).where(eq(mastery.studentId, studentId));
    const level = new Map(levels.map((m) => [m.topicId, Math.round(m.value * 100)]));
    // Extended answers are not marked in the lesson player, so they never finish a set.
    const rows = await db
      .select({ id: items.id, topicId: items.topicId, type: items.type })
      .from(items)
      .where(
        and(
          servable,
          ne(items.type, 'extended_answer'),
          inArray(
            items.topicId,
            practised.map((p) => p.topicId),
          ),
        ),
      )
      .orderBy(asc(items.difficulty), asc(items.contentId));
    const cards = await db
      .select({ itemId: flashcards.itemId, dueAt: flashcards.dueAt })
      .from(flashcards)
      .where(and(eq(flashcards.studentId, studentId), isNotNull(flashcards.itemId)));
    const dueAt = new Map(cards.map((c) => [c.itemId, c.dueAt.getTime()]));
    const nowMs = now.getTime();
    // Learning points due on the review ladder come first (F5), then the usual picks.
    const warm = (await warmUps(db, servable, studentId, subjectIds, now)).map((i) => i.id);
    const candidates: Candidate[] = rows.map((r) =>
      r.type === 'flashcard'
        ? {
            itemId: r.id,
            topicId: r.topicId,
            kind: 'flashcard',
            due: (dueAt.get(r.id) ?? nowMs) <= nowMs,
          }
        : { itemId: r.id, topicId: r.topicId, kind: 'question' },
    );
    const picked = selectDailySet({
      topics: practised.map((p) => ({
        topicId: p.topicId,
        subjectId: p.subjectId,
        mastery: level.get(p.topicId) ?? 0,
        lastPractisedAt: p.last ? p.last.getTime() : null,
      })),
      candidates,
      now: nowMs,
      rng: createRng(dailySeed(studentId, day)),
    }).map((c) => c.itemId);
    return [...warm, ...picked.filter((id) => !warm.includes(id))].slice(0, DAILY_SET_SIZE);
  }

  /** Today's stored set, made on the first request of the day. */
  async function todaysSet(studentId: string, day: string, now: Date) {
    const [existing] = await db
      .select()
      .from(dailySets)
      .where(and(eq(dailySets.studentId, studentId), eq(dailySets.day, day)));
    if (existing) return existing;
    const itemIds = await pickSet(studentId, day, now);
    if (itemIds.length === 0) return null;
    const [made] = await db
      .insert(dailySets)
      .values({ studentId, day, itemIds, createdAt: now })
      .onConflictDoNothing()
      .returning();
    if (made) return made;
    // Another request made it first.
    const [raced] = await db
      .select()
      .from(dailySets)
      .where(and(eq(dailySets.studentId, studentId), eq(dailySets.day, day)));
    return raced ?? null;
  }

  app.get('/daily', async (c) => {
    const studentId = c.var.student.studentId;
    const now = clock.now();
    const day = localDate(now);
    const set = await todaysSet(studentId, day, now);
    if (!set) {
      const empty: DailySetResponse = {
        day,
        items: [],
        draftContent: false,
        answeredItemIds: [],
        answered: 0,
        total: 0,
        done: false,
      };
      return c.json(empty);
    }
    const rows =
      set.itemIds.length === 0
        ? []
        : await db
            .select({ item: items, topicTitle: topics.title })
            .from(items)
            .innerJoin(topics, eq(topics.id, items.topicId))
            .where(and(servable, inArray(items.id, set.itemIds)));
    const byId = new Map(rows.map((r) => [r.item.id, r]));
    // Items withdrawn since the set was made (quarantined, say) drop out of it.
    const live = set.itemIds.filter((id) => byId.has(id));
    const answered =
      live.length === 0
        ? []
        : await db
            .selectDistinct({ itemId: attempts.itemId })
            .from(attempts)
            .where(
              and(
                eq(attempts.studentId, studentId),
                inArray(attempts.itemId, live),
                gt(attempts.createdAt, set.createdAt),
              ),
            );
    const due = await dueLearningPoints(db, studentId, now);
    const list = live.map((id) => {
      const { item, topicTitle } = byId.get(id)!;
      const learnItem = toLearnItem(item, topicTitle);
      return due.has(learningPointOf(item)) ? { ...learnItem, warmUp: true as const } : learnItem;
    });
    const body: DailySetResponse = {
      day,
      items: list,
      draftContent: list.some((i) => i.draft),
      ...dailySetProgress(
        live,
        answered.map((a) => a.itemId),
      ),
    };
    return c.json(body);
  });

  return app;
}
