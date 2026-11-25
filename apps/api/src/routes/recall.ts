/**
 * Recall checks for a signed-in student device (workstream Q), GET /v1/student/recall?topicId=…
 *
 * Up to 2 questions the student has answered before, for the start of a lesson on a topic they
 * have practised (`selectRecallItems` in core). Answers go through the normal attempts route, so
 * there is no extra penalty: normal XP when right, a flashcard when wrong. Empty when the topic
 * has never been practised.
 */
import { Hono } from 'hono';
import { and, eq, inArray, ne } from 'drizzle-orm';
import { z } from 'zod';
import { createRng, selectRecallItems, type Candidate } from '@revisionden/core';
import { attempts, enrolments, items, mastery, topics } from '@revisionden/db';
import type { AppEnv } from '../context';
import { servableItem, toLearnItem } from '../learning/items';
import { topicAndDescendants } from '../learning/topic-tree';
import type { LearnDeps } from './learn';

const RecallQuerySchema = z.object({ topicId: z.string().min(1) });

export function studentRecallRoutes({ db, clock, config }: LearnDeps) {
  const app = new Hono<AppEnv>();
  const servable = servableItem(config.serveDraftContent);

  app.get('/recall', async (c) => {
    const { topicId } = RecallQuerySchema.parse(c.req.query());
    const studentId = c.var.student.studentId;
    const lessonTopicIds = await topicAndDescendants(db, topicId);

    const enrolled = await db
      .select({ subjectId: enrolments.subjectId })
      .from(enrolments)
      .where(eq(enrolments.studentId, studentId));
    const subjectIds = enrolled.map((e) => e.subjectId);
    // Questions answered before, in enrolled subjects (no flashcards, no unmarked long answers).
    const seen =
      subjectIds.length === 0
        ? []
        : await db
            .selectDistinct({ item: items, topicTitle: topics.title, subjectId: topics.subjectId })
            .from(attempts)
            .innerJoin(items, eq(items.id, attempts.itemId))
            .innerJoin(topics, eq(topics.id, items.topicId))
            .where(
              and(
                eq(attempts.studentId, studentId),
                servable,
                ne(items.type, 'flashcard'),
                ne(items.type, 'extended_answer'),
                inArray(topics.subjectId, subjectIds),
              ),
            );
    const levels = await db.select().from(mastery).where(eq(mastery.studentId, studentId));
    const level = new Map(levels.map((m) => [m.topicId, Math.round(m.value * 100)]));
    const practised = new Map(seen.map((s) => [s.item.topicId, s.subjectId]));
    const candidates: Candidate[] = seen.map((s) => ({
      itemId: s.item.id,
      topicId: s.item.topicId,
      kind: 'question',
    }));
    const picked = selectRecallItems({
      lessonTopicIds,
      topics: [...practised].map(([id, subjectId]) => ({
        topicId: id,
        subjectId,
        mastery: level.get(id) ?? 0,
        practised: true,
      })),
      seenItems: candidates,
      rng: createRng(clock.now().getTime()),
    });
    const byId = new Map(seen.map((s) => [s.item.id, s]));
    const list = picked.map((p) =>
      toLearnItem(byId.get(p.itemId)!.item, byId.get(p.itemId)!.topicTitle),
    );
    return c.json({ items: list, draftContent: list.some((i) => i.draft) });
  });

  return app;
}
