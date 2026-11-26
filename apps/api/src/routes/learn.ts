/**
 * Learning loop routes for a signed-in student device, under /v1/student/learn. The student
 * session check runs first (see `studentSessionRoutes`). Every item served or accepted passes
 * the content gate: verified only, unless the development flag also serves drafts.
 */
import { Hono } from 'hono';
import { and, asc, desc, eq, inArray, isNotNull, ne, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import {
  LearnAttemptRequestSchema,
  RECALL_MODE,
  STARTING_TEST_SECONDS,
  StartingTestRequestSchema,
  comboBefore,
  comboBonusForSequence,
  comboBonusXp,
  INTERACTIVE_PILOT_TAG,
  arrangeInteractivePilot,
  createRng,
  RETRY_WEIGHT,
  showsInteractivePilot,
  isShaky,
  pickStartingTest,
  selectNextItems,
  topicMastery,
  xpForAnswer,
  type Candidate,
  type ItemType,
  type LearnAttemptResponse,
  type LearnItem,
  type TopicMastery,
} from '@revisionden/core';
import {
  attempts,
  flashcards,
  items,
  mastery,
  startingTests,
  topics,
  type Database,
} from '@revisionden/db';
import type { AppConfig } from '../env';
import { saveNewRewards } from './rewards';
import type { AppEnv } from '../context';
import { ApiError, notFound } from '../errors';
import { readJson } from '../http';
import type { Clock } from '../rate-limit';
import { isId } from '../validation';
import {
  correctAnswerText,
  explanationOf,
  markItem,
  servableItem,
  toLearnItem,
  type ItemRow,
} from '../learning/items';
import type { MathsEngine } from '../learning/maths-engine';
import { awardXp, getProgress } from '../learning/progress';
import { creditableXp } from '../daily-limit/state';
import { topicAndDescendants } from '../learning/topic-tree';
import {
  findConfidence,
  findEasier,
  findSimilar,
  recordReview,
  warmUps,
} from '../learning/mistakes';

/** How many recent answers to look back through for a combo (more is never needed in practice). */
const COMBO_HISTORY = 100;

export interface LearnDeps {
  db: Database;
  clock: Clock;
  config: AppConfig;
  mathsEngine?: MathsEngine;
}

export const COMMAND_WORD_TAG = 'command-word';
const MASTERY_WINDOW = 30;

const LessonQuerySchema = z
  .object({
    subjectId: z.string().min(1).optional(),
    topicId: z.string().min(1).optional(),
    count: z.coerce.number().int().min(1).max(20).default(10),
  })
  .refine((q) => q.subjectId || q.topicId, 'Give a subjectId or a topicId');

const noContent = () =>
  new ApiError(404, 'no_content', 'No questions are ready for this subject yet');

function lessonResponse(list: LearnItem[]) {
  return { items: list, draftContent: list.some((i) => i.draft) };
}

/** Mastery (0–100) recomputed from the student's latest attempts in a topic. */
async function updateMastery(db: Database, studentId: string, topicId: string, now: Date) {
  const recent = await db
    .select({
      score: attempts.score,
      correct: attempts.correct,
      at: attempts.createdAt,
      retry: attempts.retry,
    })
    .from(attempts)
    .innerJoin(items, eq(items.id, attempts.itemId))
    .where(
      and(
        eq(attempts.studentId, studentId),
        eq(items.topicId, topicId),
        ne(items.type, 'flashcard'),
      ),
    )
    .orderBy(desc(attempts.createdAt))
    .limit(MASTERY_WINDOW);
  const value = topicMastery(
    recent.map((r) => ({
      score: r.score ?? (r.correct ? 1 : 0),
      at: r.at.getTime(),
      // A retry in the lesson counts at half weight (F5): it comes just after seeing the answer.
      ...(r.retry ? { weight: RETRY_WEIGHT } : {}),
    })),
    now.getTime(),
  );
  await db
    .insert(mastery)
    .values({ studentId, topicId, value: value / 100, updatedAt: now })
    .onConflictDoUpdate({
      target: [mastery.studentId, mastery.topicId],
      set: { value: value / 100, updatedAt: now },
    });
}

export function learnRoutes({ db, clock, config, mathsEngine }: LearnDeps) {
  const app = new Hono<AppEnv>();
  const servable = servableItem(config.serveDraftContent);

  /** Servable items with their topic titles, in a stable order. */
  async function loadItems(where: SQL, limit?: number) {
    const query = db
      .select({ item: items, topicTitle: topics.title, subjectId: topics.subjectId })
      .from(items)
      .innerJoin(topics, eq(topics.id, items.topicId))
      .where(and(servable, where))
      .orderBy(asc(items.difficulty), asc(items.contentId));
    return limit === undefined ? query : query.limit(limit);
  }

  /** An interactive pilot step (W8): only shown in a one-topic lesson for a weak spot. */
  const isPilotStep = (r: { item: { tags: string[] | null } }) =>
    (r.item.tags ?? []).includes(INTERACTIVE_PILOT_TAG);

  async function masteryByTopic(studentId: string): Promise<Map<string, number>> {
    const rows = await db.select().from(mastery).where(eq(mastery.studentId, studentId));
    return new Map(rows.map((r) => [r.topicId, Math.round(r.value * 100)]));
  }

  async function subjectLesson(studentId: string, subjectId: string, count: number) {
    const rows = (await loadItems(eq(topics.subjectId, subjectId))).filter((r) => !isPilotStep(r));
    const levels = await masteryByTopic(studentId);
    const dueCards = await db
      .select({ itemId: flashcards.itemId, dueAt: flashcards.dueAt })
      .from(flashcards)
      .where(and(eq(flashcards.studentId, studentId), isNotNull(flashcards.itemId)));
    const dueAt = new Map(dueCards.map((c) => [c.itemId, c.dueAt.getTime()]));
    const now = clock.now().getTime();
    const candidates: Candidate[] = rows.map(({ item }) =>
      item.type === 'flashcard'
        ? {
            itemId: item.id,
            topicId: item.topicId,
            kind: 'flashcard',
            due: (dueAt.get(item.id) ?? now) <= now,
          }
        : { itemId: item.id, topicId: item.topicId, kind: 'question' },
    );
    const topicIds = [...new Set(rows.map((r) => r.item.topicId))];
    const picked = selectNextItems({
      topics: topicIds.map((topicId) => ({
        topicId,
        subjectId,
        mastery: levels.get(topicId) ?? 0,
      })),
      candidates,
      count,
      rng: createRng(now),
    });
    const byId = new Map(rows.map((r) => [r.item.id, r]));
    return picked.map((c) => byId.get(c.itemId)!).map((r) => toLearnItem(r.item, r.topicTitle));
  }

  /** The lesson with up to 2 warm-ups first: due learning points from the same subject (F5). */
  async function withWarmUps(studentId: string, subjectId: string | undefined, list: LearnItem[]) {
    if (!subjectId) return list;
    // A warm-up already in the lesson moves to the front instead of showing twice.
    const warm = await warmUps(db, servable, studentId, [subjectId], clock.now());
    const warmIds = new Set(warm.map((i) => i.id));
    return [...warm, ...list.filter((i) => !warmIds.has(i.id))];
  }

  app.get('/lesson', async (c) => {
    const query = LessonQuerySchema.parse(c.req.query());
    const studentId = c.var.student.studentId;
    if (query.topicId) {
      // A unit's id gives its challenge: items from every topic in the unit.
      const topicIds = await topicAndDescendants(db, query.topicId);
      const loaded = await loadItems(inArray(items.topicId, topicIds));
      // The interactive pilot (W8) leads a weak-spot topic's lesson and is otherwise left out.
      const show =
        loaded.some(isPilotStep) &&
        showsInteractivePilot({
          mastery: (await masteryByTopic(studentId)).get(query.topicId),
          topicCount: topicIds.length,
        });
      const rows = arrangeInteractivePilot(loaded, isPilotStep, show).slice(0, query.count);
      const list = rows.map((r) => toLearnItem(r.item, r.topicTitle));
      return c.json(lessonResponse(await withWarmUps(studentId, rows[0]?.subjectId, list)));
    }
    const list = await subjectLesson(studentId, query.subjectId!, query.count);
    return c.json(lessonResponse(await withWarmUps(studentId, query.subjectId, list)));
  });

  app.get('/command-words', async (c) => {
    const rows = await loadItems(
      sql`${items.tags} @> ${JSON.stringify([COMMAND_WORD_TAG])}::jsonb`,
    );
    return c.json(lessonResponse(rows.map((r) => toLearnItem(r.item, r.topicTitle))));
  });

  app.get('/progress', async (c) => {
    return c.json(await getProgress(db, c.var.student.studentId, clock.now()));
  });

  app.get('/subjects/:subjectId/topics', async (c) => {
    const subjectId = c.req.param('subjectId');
    const studentId = c.var.student.studentId;
    const counts = await db
      .select({ topicId: topics.id, title: topics.title, items: sql<number>`count(*)::int` })
      .from(items)
      .innerJoin(topics, eq(topics.id, items.topicId))
      .where(and(servable, eq(topics.subjectId, subjectId)))
      .groupBy(topics.id, topics.title)
      .orderBy(asc(topics.id));
    const levels = await masteryByTopic(studentId);
    const [done] = await db
      .select({ id: startingTests.id })
      .from(startingTests)
      .where(
        and(
          eq(startingTests.studentId, studentId),
          eq(startingTests.subjectId, subjectId),
          isNotNull(startingTests.finishedAt),
        ),
      )
      .limit(1);
    return c.json({
      subjectId,
      startingTestDone: done !== undefined,
      topics: counts.map((t) => ({ ...t, mastery: levels.get(t.topicId) ?? 0 })),
    });
  });

  // Starting test --------------------------------------------------------------------------

  app.post('/starting-tests', async (c) => {
    const { subjectId } = await readJson(c, StartingTestRequestSchema);
    const rows = await loadItems(eq(topics.subjectId, subjectId));
    const now = clock.now();
    const picked = pickStartingTest(
      rows.map(({ item }) => ({
        itemId: item.id,
        topicId: item.topicId,
        difficulty: item.difficulty ?? 3,
        type: item.type as ItemType,
      })),
      { rng: createRng(now.getTime()) },
    );
    if (picked.length === 0) throw noContent();
    const [test] = await db
      .insert(startingTests)
      .values({ studentId: c.var.student.studentId, subjectId, itemIds: picked, startedAt: now })
      .returning({ id: startingTests.id });
    const byId = new Map(rows.map((r) => [r.item.id, r]));
    const list = picked.map((id) => toLearnItem(byId.get(id)!.item, byId.get(id)!.topicTitle));
    return c.json(
      { id: test!.id, subjectId, timeLimitSeconds: STARTING_TEST_SECONDS, ...lessonResponse(list) },
      201,
    );
  });

  async function ownTest(studentId: string, id: string) {
    if (!isId(id)) throw notFound();
    const [test] = await db
      .select()
      .from(startingTests)
      .where(and(eq(startingTests.id, id), eq(startingTests.studentId, studentId)));
    if (!test) throw notFound();
    return test;
  }

  /**
   * Test mode combos (docs/GAME_FEEL.md): at the reveal, each answer's combo bonus is added to
   * that answer's XP, so levels and rewards count it like any XP from answers.
   */
  async function awardTestCombo(
    studentId: string,
    answered: { id: string; xpEarned: number }[],
    bonuses: number[],
    now: Date,
  ) {
    let total = 0;
    for (const [i, row] of answered.entries()) {
      const bonus = bonuses[i] ?? 0;
      if (bonus === 0) continue;
      total += bonus;
      await db
        .update(attempts)
        .set({ xpEarned: row.xpEarned + bonus })
        .where(eq(attempts.id, row.id));
    }
    await awardXp(db, studentId, total, now);
  }

  app.post('/starting-tests/:id/finish', async (c) => {
    const studentId = c.var.student.studentId;
    const test = await ownTest(studentId, c.req.param('id'));
    const now = clock.now();
    const firstFinish = test.finishedAt === null;
    await db.update(startingTests).set({ finishedAt: now }).where(eq(startingTests.id, test.id));
    const answered = await db
      .select({ id: attempts.id, correct: attempts.correct, xpEarned: attempts.xpEarned })
      .from(attempts)
      .where(eq(attempts.startingTestId, test.id))
      .orderBy(asc(attempts.createdAt));
    const combo = comboBonusForSequence(answered.map((a) => a.correct));
    const comboAllowed = (await creditableXp(db, studentId, combo.bonusXp, now)) > 0;
    if (firstFinish && combo.bonusXp > 0 && comboAllowed) {
      await awardTestCombo(studentId, answered, combo.bonuses, now);
    }
    const testTopics = await db
      .selectDistinct({ topicId: topics.id, title: topics.title })
      .from(items)
      .innerJoin(topics, eq(topics.id, items.topicId))
      .where(inArray(items.id, test.itemIds))
      .orderBy(asc(topics.id));
    const levels = await masteryByTopic(studentId);
    const result: TopicMastery[] = testTopics.map((t) => ({
      ...t,
      mastery: levels.get(t.topicId) ?? 0,
    }));
    return c.json({
      id: test.id,
      correct: answered.filter((a) => a.correct).length,
      answered: answered.length,
      total: test.itemIds.length,
      topics: result,
      bestCombo: combo.bestCombo,
      comboBonusXp: combo.bonusXp,
    });
  });

  // Attempts -------------------------------------------------------------------------------

  /** Right Learn mode answers in a row just before now (see `comboBefore`). */
  async function recentCombo(studentId: string, now: Date): Promise<number> {
    const history = await db
      .select({ correct: attempts.correct, mode: attempts.mode, at: attempts.createdAt })
      .from(attempts)
      .where(eq(attempts.studentId, studentId))
      .orderBy(desc(attempts.createdAt))
      .limit(COMBO_HISTORY);
    return comboBefore(history, now);
  }

  app.post('/attempts', async (c) => {
    const input = await readJson(c, LearnAttemptRequestSchema);
    const studentId = c.var.student.studentId;
    const now = clock.now();
    const [row] = await db
      .select()
      .from(items)
      .where(and(servable, eq(items.id, input.itemId)));
    if (!row) throw notFound();

    if (input.recall && input.mode !== 'learn') {
      throw new ApiError(400, 'invalid_request', 'Recall checks use learn mode');
    }
    if (input.startingTestId) {
      if (input.mode !== 'test') {
        throw new ApiError(400, 'invalid_request', 'Starting test answers use test mode');
      }
      const test = await ownTest(studentId, input.startingTestId);
      if (!test.itemIds.includes(row.id)) {
        throw new ApiError(400, 'invalid_request', 'That question is not in this test');
      }
    }

    const marked = await markItem(row, input.answer, mathsEngine);
    const learning = input.mode === 'learn';
    // Learn mode combos come from the student's own recent answers (never from the device).
    const combo = learning && marked.correct ? (await recentCombo(studentId, now)) + 1 : 0;
    const comboBonus = comboBonusXp(combo);
    // No XP, rewards or streak credit past the daily limit (workstream K7).
    const xpEarned = await creditableXp(
      db,
      studentId,
      xpForAnswer({ type: row.type as ItemType, score: marked.score }) + comboBonus,
      now,
    );
    const [saved] = await db
      .insert(attempts)
      .values({
        studentId,
        itemId: row.id,
        correct: marked.correct,
        score: marked.score,
        timeMs: input.timeMs,
        itemVersion: row.version,
        // A recall check is saved as 'recall' so it never breaks a combo (see comboBefore).
        mode: input.recall ? RECALL_MODE : input.mode,
        xpEarned,
        startingTestId: input.startingTestId ?? null,
        retry: learning && input.retry === true,
        createdAt: now,
      })
      .returning({ id: attempts.id, createdAt: attempts.createdAt });
    // A flashcard is a self-rating: it never changes mastery (or the predicted grade).
    if (row.type !== 'flashcard') await updateMastery(db, studentId, row.topicId, now);

    // Learning from mistakes (F5): slow right answers are shaky; wrong and shaky answers put the
    // learning point on the review ladder; a wrong answer offers a similar question.
    const timed = learning && row.type !== 'flashcard' && row.type !== 'extended_answer';
    const shaky =
      timed &&
      isShaky({
        type: row.type as ItemType,
        correct: marked.correct,
        timeMs: input.timeMs,
        expectedSeconds: row.expectedSeconds,
      });
    if (timed) {
      await recordReview(
        db,
        studentId,
        row,
        marked.correct ? (shaky ? 'shaky' : 'right') : 'wrong',
        now,
      );
    }
    // Help after a miss: a similar question (unless this was the retry), an easier one for a
    // step down after a second miss, and a confidence question the student got right before.
    const missed = timed && !marked.correct;
    const help = missed
      ? {
          similar: input.retry ? null : await findSimilar(db, servable, studentId, row, now),
          easier: await findEasier(db, servable, studentId, row, now),
          confidence: await findConfidence(db, servable, studentId, row),
        }
      : { similar: null };

    const flashcardAdded =
      learning && !marked.correct && row.type !== 'flashcard'
        ? await addWrongAnswerCard(db, studentId, row, now)
        : false;
    const progress = await awardXp(db, studentId, xpEarned, now);
    const explanation = explanationOf(row);
    const response: LearnAttemptResponse = {
      id: saved!.id,
      itemId: row.id,
      correct: marked.correct,
      score: marked.score,
      xpEarned,
      createdAt: saved!.createdAt.toISOString(),
      feedback: learning
        ? {
            correctAnswer: correctAnswerText(row),
            ...(explanation ? { explanation } : {}),
            ...(marked.firstWrongLine !== undefined
              ? { firstWrongLine: marked.firstWrongLine }
              : {}),
          }
        : null,
      progress,
      flashcardAdded,
      combo,
      comboBonusXp: comboBonus,
      ...(timed ? { shaky, ...help } : {}),
      newlyEarned: await saveNewRewards(db, studentId, now),
    };
    return c.json(response);
  });

  return app;
}

/** A missed question becomes a flashcard due now. Returns false if it already was one. */
async function addWrongAnswerCard(db: Database, studentId: string, row: ItemRow, now: Date) {
  const inserted = await db
    .insert(flashcards)
    .values({ studentId, itemId: row.id, topicId: row.topicId, origin: 'wrong_answer', dueAt: now })
    .onConflictDoNothing()
    .returning({ id: flashcards.id });
  return inserted.length > 0;
}
