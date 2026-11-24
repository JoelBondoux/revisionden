/**
 * Rewards routes (docs/REWARDS.md). Rules live in packages/core; this file loads records, saves
 * newly earned rewards and parent-set rewards.
 *
 * - Student: GET /v1/student/rewards (level, chapter track, next milestones, collections, live
 *   seasonal drops, parent rewards). Newly earned rewards are saved here, once each, and the gift
 *   days that come with them are added to the student's streak record.
 * - Parent: GET /v1/students/:id/rewards (the same view), and POST, PATCH, DELETE and "given"
 *   for parent-set real-world rewards under /v1/students/:id/parent-rewards. Once given, a
 *   reward is kept as history: it can no longer be changed or deleted (409).
 */
import { Hono } from 'hono';
import { and, asc, eq, gte, isNotNull, sql } from 'drizzle-orm';
import {
  CreateParentRewardRequestSchema,
  DEFAULT_DAILY_GOAL_XP,
  ParentRewardTargetSchema,
  REWARDS,
  UpdateParentRewardRequestSchema,
  type ParentRewardTarget,
  bestRun,
  evaluateRewards,
  giftDaysFor,
  localDate,
  masteryStats,
  parentRewardProgress,
  parentTargetLabel,
  progressionStats,
  rewardableXp,
  rewardsOverview,
  seasonProgressFor,
  type ParentReward,
  type RewardCardResponse,
  type RewardStats,
  type StudentRewardsResponse,
} from '@revisionden/core';
import {
  attempts,
  dailyXp,
  mastery,
  parentRewards,
  rewards,
  startingTests,
  streaks,
  students,
  topics,
  type Database,
} from '@revisionden/db';
import type { AppEnv } from '../context';
import { ApiError, notFound } from '../errors';
import { requireFamilyStudent } from '../families';
import { readJson } from '../http';
import type { Clock } from '../rate-limit';
import { isId } from '../validation';

type ParentRewardRow = typeof parentRewards.$inferSelect;

interface Deps {
  db: Database;
  clock: Clock;
}

async function loadStats(db: Database, studentId: string, yearGroup: number, now: Date) {
  const answerRows = await db
    .select({ at: attempts.createdAt, xp: attempts.xpEarned, correct: attempts.correct })
    .from(attempts)
    .where(eq(attempts.studentId, studentId))
    .orderBy(asc(attempts.createdAt));
  const [streak] = await db
    .select({ best: streaks.best })
    .from(streaks)
    .where(eq(streaks.studentId, studentId));
  const masteryRows = await db
    .select({ subjectId: topics.subjectId, value: mastery.value })
    .from(mastery)
    .innerJoin(topics, eq(topics.id, mastery.topicId))
    .where(eq(mastery.studentId, studentId));
  const [tests] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(startingTests)
    .where(and(eq(startingTests.studentId, studentId), isNotNull(startingTests.finishedAt)));
  const goalDays = await db
    .select({ day: dailyXp.day })
    .from(dailyXp)
    .where(and(eq(dailyXp.studentId, studentId), gte(dailyXp.xp, DEFAULT_DAILY_GOAL_XP)));

  const xpEvents = answerRows.map((a) => ({ at: a.at, xp: a.xp }));
  const correct = answerRows.filter((a) => a.correct);
  const stats: Partial<RewardStats> = {
    ...progressionStats({ xpEvents, yearGroup, today: localDate(now) }),
    ...masteryStats(
      masteryRows.map((m) => ({ subjectId: m.subjectId, masteryPercent: m.value * 100 })),
    ),
    bestStreak: streak?.best ?? 0,
    correctAnswers: correct.length,
    bestCorrectRun: bestRun(answerRows.map((a) => a.correct)),
    startingTestsCompleted: tests?.n ?? 0,
  };
  const seasonProgress = seasonProgressFor({
    now,
    correctAnswersAt: correct.map((a) => a.at),
    goalDays: goalDays.map((g) => g.day),
  });
  return { stats, seasonProgress, totalRewardXp: rewardableXp(xpEvents) };
}

/** Saves rewards not stored yet; returns the ids actually added (so gift days come once). */
async function saveEarned(db: Database, studentId: string, ids: string[], now: Date) {
  if (ids.length === 0) return [];
  const added = await db
    .insert(rewards)
    .values(ids.map((rewardId) => ({ studentId, rewardId, earnedAt: now })))
    .onConflictDoNothing()
    .returning({ rewardId: rewards.rewardId });
  const addedIds = added.map((r) => r.rewardId);
  const gifts = giftDaysFor(REWARDS.filter((r) => addedIds.includes(r.id)));
  if (gifts > 0) {
    await db
      .insert(streaks)
      .values({ studentId, giftDays: gifts })
      .onConflictDoUpdate({
        target: streaks.studentId,
        set: { giftDays: sql`${streaks.giftDays} + ${gifts}` },
      });
  }
  return addedIds;
}

const targetOf = (row: ParentRewardRow): ParentRewardTarget =>
  ParentRewardTargetSchema.parse(
    row.targetKind === 'reward'
      ? { kind: 'reward', rewardId: row.rewardId }
      : row.targetKind === 'date'
        ? { kind: 'date', on: row.targetDate }
        : { kind: 'stat', stat: row.stat, atLeast: row.atLeast },
  );

/** Target columns for a row: every target column is set, unused ones to null. */
const targetColumns = (target: ParentRewardTarget) => ({
  targetKind: target.kind,
  rewardId: target.kind === 'reward' ? target.rewardId : null,
  stat: target.kind === 'stat' ? target.stat : null,
  atLeast: target.kind === 'stat' ? target.atLeast : null,
  targetDate: target.kind === 'date' ? target.on : null,
});

function toParentReward(
  row: ParentRewardRow,
  stats: Partial<RewardStats>,
  earnedIds: readonly string[],
  today: string,
): ParentReward {
  const target = targetOf(row);
  const progress = parentRewardProgress(target, stats, earnedIds, today);
  return {
    id: row.id,
    title: row.title,
    note: row.note,
    target,
    targetLabel: parentTargetLabel(target),
    reached: progress.reached,
    current: progress.current,
    goal: progress.target,
    givenAt: row.givenAt?.toISOString() ?? null,
  };
}

/** Loads progress, saves anything newly earned and builds the rewards view. */
async function rewardsView(
  db: Database,
  student: { id: string; yearGroup: number },
  now: Date,
): Promise<StudentRewardsResponse> {
  const { stats, seasonProgress, totalRewardXp } = await loadStats(
    db,
    student.id,
    student.yearGroup,
    now,
  );
  const stored = await db
    .select({ rewardId: rewards.rewardId })
    .from(rewards)
    .where(eq(rewards.studentId, student.id));
  const before = stored.map((r) => r.rewardId);
  const fresh = evaluateRewards(stats, before, REWARDS, { now, seasonProgress });
  const added = await saveEarned(
    db,
    student.id,
    fresh.map((r) => r.id),
    now,
  );
  const earnedIds = [...before, ...added];
  const overview = rewardsOverview({
    stats,
    earnedIds,
    totalRewardXp,
    yearGroup: student.yearGroup,
    now,
    seasonProgress,
  });
  const newlyEarned: RewardCardResponse[] = fresh
    .filter((r) => added.includes(r.id))
    .map((r) => ({
      id: r.id,
      name: r.name,
      rarity: r.rarity,
      items: [...r.items],
      earned: true,
      current: 1,
      target: 1,
    }));
  const parentRows = await db
    .select()
    .from(parentRewards)
    .where(eq(parentRewards.studentId, student.id))
    .orderBy(asc(parentRewards.createdAt), asc(parentRewards.id));
  return {
    overview,
    newlyEarned,
    parentRewards: parentRows.map((row) => toParentReward(row, stats, earnedIds, localDate(now))),
  };
}

/** Student routes under /v1/student/rewards (the session check runs before these). */
export function studentRewardRoutes({ db, clock }: Deps) {
  const app = new Hono<AppEnv>();
  app.get('/', async (c) => {
    const [student] = await db
      .select({ id: students.id, yearGroup: students.yearGroup })
      .from(students)
      .where(eq(students.id, c.var.student.studentId));
    if (!student) throw notFound('Student not found');
    return c.json(await rewardsView(db, student, clock.now()));
  });
  return app;
}

/** Parent routes under /v1/students/:id/rewards and /v1/students/:id/parent-rewards. */
export function parentRewardRoutes({ db, clock }: Deps) {
  const app = new Hono<AppEnv>();
  const family = (c: { var: AppEnv['Variables'] }) => c.var.parent.familyId;

  app.get('/:id/rewards', async (c) => {
    const student = await requireFamilyStudent(db, family(c), c.req.param('id'));
    return c.json(await rewardsView(db, student, clock.now()));
  });

  app.post('/:id/parent-rewards', async (c) => {
    const student = await requireFamilyStudent(db, family(c), c.req.param('id'));
    const { title, note, target } = await readJson(c, CreateParentRewardRequestSchema);
    const [row] = await db
      .insert(parentRewards)
      .values({ studentId: student.id, title, note: note || null, ...targetColumns(target) })
      .returning();
    const view = await rewardsView(db, student, clock.now());
    return c.json(
      view.parentRewards.find((r) => r.id === row!.id)!,
      201,
    );
  });

  async function requireParentReward(studentId: string, rewardId: string) {
    if (!isId(rewardId)) throw notFound('Reward not found');
    const [row] = await db
      .select()
      .from(parentRewards)
      .where(and(eq(parentRewards.id, rewardId), eq(parentRewards.studentId, studentId)));
    if (!row) throw notFound('Reward not found');
    return row;
  }

  app.post('/:id/parent-rewards/:rewardId/given', async (c) => {
    const student = await requireFamilyStudent(db, family(c), c.req.param('id'));
    const row = await requireParentReward(student.id, c.req.param('rewardId'));
    await db
      .update(parentRewards)
      .set({ givenAt: row.givenAt ?? clock.now() })
      .where(eq(parentRewards.id, row.id));
    const view = await rewardsView(db, student, clock.now());
    return c.json(view.parentRewards.find((r) => r.id === row.id)!);
  });

  const alreadyGiven = () =>
    new ApiError(409, 'already_given', 'This reward has been given, so it is kept as history');

  app.patch('/:id/parent-rewards/:rewardId', async (c) => {
    const student = await requireFamilyStudent(db, family(c), c.req.param('id'));
    const row = await requireParentReward(student.id, c.req.param('rewardId'));
    const change = await readJson(c, UpdateParentRewardRequestSchema);
    if (row.givenAt) throw alreadyGiven();
    await db
      .update(parentRewards)
      .set({
        ...(change.title !== undefined && { title: change.title }),
        ...(change.note !== undefined && { note: change.note || null }),
        ...(change.target && targetColumns(change.target)),
      })
      .where(eq(parentRewards.id, row.id));
    const view = await rewardsView(db, student, clock.now());
    return c.json(view.parentRewards.find((r) => r.id === row.id)!);
  });

  app.delete('/:id/parent-rewards/:rewardId', async (c) => {
    const student = await requireFamilyStudent(db, family(c), c.req.param('id'));
    const row = await requireParentReward(student.id, c.req.param('rewardId'));
    if (row.givenAt) throw alreadyGiven();
    await db.delete(parentRewards).where(eq(parentRewards.id, row.id));
    return c.body(null, 204);
  });

  return app;
}
