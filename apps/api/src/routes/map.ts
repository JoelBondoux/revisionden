/**
 * The Map tab's data for a signed-in student device (workstream F2), under /v1/student:
 * GET /map?subjectId=… (default: the first enrolled subject with questions, else the first
 * enrolled subject) and GET /cards/due. A subject with no questions yet answers with
 * `status: "coming_soon"`, never an error; 404 only when the student has no subject at all.
 * Topics count only items a lesson would serve (verified, plus drafts with the dev flag on; typed
 * working only with the maths engine; never interactive pilot steps alone), so an open topic
 * never opens an empty lesson (UX-3).
 */
import { Hono } from 'hono';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { buildTopicMap, type CardsDue, type TopicMap } from '@revisionden/core';
import { enrolments, items, mastery, topics } from '@revisionden/db';
import type { AppEnv } from '../context';
import { ApiError } from '../errors';
import { todaysCards } from '../learning/card-limit';
import { flashcardStore } from '../learning/flashcard-store';
import { lessonReadyItem, servableItem } from '../learning/items';
import { getProgress } from '../learning/progress';
import type { LearnDeps } from './learn';

const noSubject = () =>
  new ApiError(404, 'no_subject', 'Choose a subject first: the student has none yet');

export function studentMapRoutes({ db, clock, config, mathsEngine }: LearnDeps) {
  const app = new Hono<AppEnv>();
  const servable = servableItem(config.serveDraftContent);
  // UX-3: a topic is open on the map only when a lesson on it would find a question.
  const ready = lessonReadyItem(config.serveDraftContent, mathsEngine !== undefined);
  const cards = flashcardStore(db, servable);

  app.get('/map', async (c) => {
    const studentId = c.var.student.studentId;
    const enrolled = await db
      .select()
      .from(enrolments)
      .where(eq(enrolments.studentId, studentId))
      .orderBy(asc(enrolments.createdAt), asc(enrolments.subjectId));
    // Servable items per enrolled subject: the map opens on the first subject with questions,
    // and the subject switcher marks the others "coming soon" (owner bug RD-MBXKTC).
    const counts =
      enrolled.length === 0
        ? []
        : await db
            .select({ subjectId: topics.subjectId, n: sql<number>`count(${items.id})::int` })
            .from(topics)
            .innerJoin(items, and(eq(items.topicId, topics.id), ready))
            .where(
              inArray(
                topics.subjectId,
                enrolled.map((e) => e.subjectId),
              ),
            )
            .groupBy(topics.subjectId);
    const withContent = new Set(counts.filter((r) => r.n > 0).map((r) => r.subjectId));
    const subjects = enrolled.map((e) => ({
      subjectId: e.subjectId,
      hasContent: withContent.has(e.subjectId),
    }));
    const subjectId =
      c.req.query('subjectId') ??
      subjects.find((s) => s.hasContent)?.subjectId ??
      enrolled[0]?.subjectId;
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
      .leftJoin(items, and(eq(items.topicId, topics.id), ready))
      .where(eq(topics.subjectId, subjectId))
      .groupBy(topics.id);
    // An unknown subject (no topics and not one the student takes) is still "choose a subject".
    if (treeTopics.length === 0 && !subjects.some((s) => s.subjectId === subjectId)) {
      throw noSubject();
    }

    const levels = await db.select().from(mastery).where(eq(mastery.studentId, studentId));
    const progress = await getProgress(db, studentId, clock.now());
    const body: TopicMap = buildTopicMap({
      subjectId,
      tier: enrolled.find((e) => e.subjectId === subjectId)?.tier ?? 'none',
      topics: treeTopics,
      subjects,
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
    // The badge shows today's remaining cards under the daily limit (F11), never the backlog.
    const body: CardsDue = { due: (await todaysCards(db, studentId, loaded, now)).due.length };
    return c.json(body);
  });

  return app;
}
