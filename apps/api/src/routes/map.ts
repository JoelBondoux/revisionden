/**
 * The Map tab's data for a signed-in student device (workstream F2), under /v1/student:
 * GET /map?subjectId=… (default: the student's first enrolled subject) and GET /cards/due.
 * Topics count only items that may be served (verified, plus drafts with the dev flag on).
 */
import { Hono } from 'hono';
import { and, asc, eq, sql } from 'drizzle-orm';
import { buildTopicMap, dueCards, type CardsDue, type TopicMap } from '@revisionden/core';
import { enrolments, items, mastery, topics } from '@revisionden/db';
import type { AppEnv } from '../context';
import { ApiError } from '../errors';
import { flashcardStore, toCard } from '../learning/flashcard-store';
import { servableItem } from '../learning/items';
import { getProgress } from '../learning/progress';
import type { LearnDeps } from './learn';

const noSubject = () =>
  new ApiError(404, 'no_subject', 'Choose a subject first: the student has none yet');

export function studentMapRoutes({ db, clock, config }: LearnDeps) {
  const app = new Hono<AppEnv>();
  const servable = servableItem(config.serveDraftContent);
  const cards = flashcardStore(db, servable);

  app.get('/map', async (c) => {
    const studentId = c.var.student.studentId;
    const enrolled = await db
      .select()
      .from(enrolments)
      .where(eq(enrolments.studentId, studentId))
      .orderBy(asc(enrolments.createdAt), asc(enrolments.subjectId));
    const subjectId = c.req.query('subjectId') ?? enrolled[0]?.subjectId;
    if (!subjectId) throw noSubject();

    const treeTopics = await db
      .select({
        id: topics.id,
        title: topics.title,
        parentTopicId: topics.parentTopicId,
        position: topics.position,
        servableItems: sql<number>`count(${items.id})::int`,
      })
      .from(topics)
      .leftJoin(items, and(eq(items.topicId, topics.id), servable))
      .where(eq(topics.subjectId, subjectId))
      .groupBy(topics.id);
    if (treeTopics.length === 0) throw noSubject();

    const levels = await db.select().from(mastery).where(eq(mastery.studentId, studentId));
    const progress = await getProgress(db, studentId, clock.now());
    const body: TopicMap = buildTopicMap({
      subjectId,
      tier: enrolled.find((e) => e.subjectId === subjectId)?.tier ?? 'none',
      topics: treeTopics,
      mastery: new Map(levels.map((m) => [m.topicId, Math.round(m.value * 100)])),
      progress: {
        xpToday: progress.xpToday,
        dailyGoalXp: progress.dailyGoalXp,
        streakDays: progress.streak.current,
      },
    });
    return c.json(body);
  });

  app.get('/cards/due', async (c) => {
    const studentId = c.var.student.studentId;
    const now = clock.now();
    await cards.addNewDeckCards(studentId, now);
    const loaded = await cards.loadCards(studentId);
    const body: CardsDue = {
      due: dueCards(
        loaded.map((l) => toCard(l.card)),
        now.getTime(),
      ).length,
    };
    return c.json(body);
  });

  return app;
}
