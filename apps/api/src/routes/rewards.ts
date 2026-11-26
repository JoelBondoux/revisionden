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
import { flashcardSessionStats } from '../learning/flashcard-sessions';
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
  secretStats,
  foundingTesterStat,
  chooseTitle,
  formatTitle,
  titleWordsFor,
  TitleChoiceSchema,
  TITLE_MESSAGES,
  type StudentTitleResponse,
  EFFECT_STYLE_UNLOCKS,
  effectStylesFor,
  type EffectStylesResponse,
  practiceKindsTried,
  weakSpotsTurnedStrong,
  type ItemType,
  type ParentReward,
  type RewardCardResponse,
  type RewardStats,
  type StudentRewardsResponse,
} from '@revisionden/core';
import {
  attempts,
  dailyXp,
  enrolments,
  flashcardSessions,
  items,
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
import { bugRewardXp, confirmedBugCount } from '../feedback/bugHunter';
import { isId } from '../validation';

type ParentRewardRow = typeof parentRewards.$inferSelect;

interface Deps {
  db: Database;
  clock: Clock;
  config?: { styleTester?: boolean; betaEndsAt?: Date };
}

/** Options for reward evaluation that come from configuration. */
export interface RewardOptions {
  /** 1.0 cut-off for Founding Tester (R5); unset means nobody gets it. */
  betaEndsAt?: Date;
}

async function loadStats(
  db: Database,
  studentId: string,
  yearGroup: number,
  now: Date,
  options: RewardOptions = {},
) {
  const answerRows = await db
    .select({
      at: attempts.createdAt,
      xp: attempts.xpEarned,
      correct: attempts.correct,
      score: attempts.score,
      type: items.type,
      topicId: items.topicId,
      subjectId: topics.subjectId,
      mode: attempts.mode,
    })
    .from(attempts)
    .innerJoin(items, eq(items.id, attempts.itemId))
    .innerJoin(topics, eq(topics.id, items.topicId))
    .where(eq(attempts.studentId, studentId))
    .orderBy(asc(attempts.createdAt));
  const enrolled = await db
    .select({ subjectId: enrolments.subjectId })
    .from(enrolments)
    .where(eq(enrolments.studentId, studentId));
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

  // Flashcard deck XP is paid per completed session, timestamped (F3), so it counts too.
  const sessions = await flashcardSessionStats(db, studentId);
  const xpEvents = [...answerRows.map((a) => ({ at: a.at, xp: a.xp })), ...sessions.xpEvents];
  const correct = answerRows.filter((a) => a.correct);
  // Bug Hunter XP (workstream L) is given by the operator, so it counts for levels as it stands;
  // it is not an answer, so it does not fill year chapters.
  const totalRewardXp = rewardableXp(xpEvents) + (await bugRewardXp(db, studentId));
  const stats: Partial<RewardStats> = {
    ...progressionStats({ xpEvents, yearGroup, today: localDate(now), totalRewardXp }),
    ...masteryStats(
      masteryRows.map((m) => ({ subjectId: m.subjectId, masteryPercent: m.value * 100 })),
    ),
    bestStreak: streak?.best ?? 0,
    correctAnswers: correct.length,
    bestCorrectRun: bestRun(answerRows.map((a) => a.correct)),
    startingTestsCompleted: tests?.n ?? 0,
    confirmedBugs: await confirmedBugCount(db, studentId),
    ...secretStats({
      answers: answerRows.map((a) => ({ ...a, type: a.type as ItemType })),
      goalDays: goalDays.map((g) => g.day),
      enrolledSubjects: enrolled.map((e) => e.subjectId),
    }),
    flashcardsReviewed: sessions.cardsReviewed,
    // Hidden tracks (R7b). Comeback Kid and part of Explorer come from answers; the rest have
    // no data source yet and stay at 0 (see project_memory/operations/contradictions.md).
    // Flashcards are self-ratings and never change mastery (learn.ts), so they are left out.
    weakSpotsTurnedStrong: weakSpotsTurnedStrong(
      answerRows
        .filter((a) => a.type !== 'flashcard')
        .map((a) => ({
          topicId: a.topicId,
          at: a.at.getTime(),
          score: a.score ?? (a.correct ? 1 : 0),
        })),
    ),
    practiceKindsTried: practiceKindsTried({
      lesson: answerRows.some((a) => a.mode === 'learn'),
      flashcardSession: sessions.cardsReviewed > 0,
      startingTest: (tests?.n ?? 0) > 0,
      workedMaths: answerRows.some((a) => a.type === 'worked_maths'),
      // Timed papers (X), homework marking and plan edits (P) have no records yet.
    }),
    factChecks: 0, // item_reports has no student id yet (workstream V)
    plannedWeeks: 0, // no planned sessions yet (workstream P)
    perfectSetsLevel2: 0, // practice sets are not stored yet
    // R5: answers and completed flashcard sessions before the 1.0 cut-off. Existing rows only.
    foundingTester: options.betaEndsAt
      ? foundingTesterStat({
          betaEndsAt: options.betaEndsAt,
          now,
          activityAt: [
            ...answerRows.map((a) => a.at),
            ...(await completedSessionTimes(db, studentId)),
          ],
        })
      : 0,
  };
  const seasonProgress = seasonProgressFor({
    now,
    correctAnswersAt: correct.map((a) => a.at),
    goalDays: goalDays.map((g) => g.day),
  });
  return { stats, seasonProgress, totalRewardXp };
}

/** When the student's completed flashcard sessions finished (Founding Tester, R5). */
async function completedSessionTimes(db: Database, studentId: string): Promise<Date[]> {
  const rows = await db
    .select({ at: flashcardSessions.finishedAt })
    .from(flashcardSessions)
    .where(
      and(
        eq(flashcardSessions.studentId, studentId),
        eq(flashcardSessions.completed, true),
        isNotNull(flashcardSessions.finishedAt),
      ),
    );
  return rows.flatMap((r) => (r.at ? [r.at] : []));
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

type RewardStudent = { id: string; yearGroup: number };

/** Works out rewards earned since last time, saves them once each and returns them as cards. */
async function earnRewards(
  db: Database,
  student: RewardStudent,
  now: Date,
  options: RewardOptions = {},
) {
  const loaded = await loadStats(db, student.id, student.yearGroup, now, options);
  const stored = await db
    .select({ rewardId: rewards.rewardId })
    .from(rewards)
    .where(eq(rewards.studentId, student.id));
  const before = stored.map((r) => r.rewardId);
  const fresh = evaluateRewards(loaded.stats, before, REWARDS, {
    now,
    seasonProgress: loaded.seasonProgress,
  });
  const added = await saveEarned(
    db,
    student.id,
    fresh.map((r) => r.id),
    now,
  );
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
  return { ...loaded, earnedIds: [...before, ...added], newlyEarned };
}

/**
 * Saves rewards the student has just earned and returns them, for the screens where they are
 * earned (an answer, a finished flashcard session), so the reward sound plays there (F4).
 */
export async function saveNewRewards(
  db: Database,
  studentId: string,
  now: Date,
  options: RewardOptions = {},
): Promise<RewardCardResponse[]> {
  const [student] = await db
    .select({ id: students.id, yearGroup: students.yearGroup })
    .from(students)
    .where(eq(students.id, studentId));
  if (!student) throw notFound('Student not found');
  return (await earnRewards(db, student, now, options)).newlyEarned;
}

/** Loads progress, saves anything newly earned and builds the rewards view. */
async function rewardsView(
  db: Database,
  student: RewardStudent,
  now: Date,
  options: RewardOptions = {},
): Promise<StudentRewardsResponse> {
  const { stats, seasonProgress, totalRewardXp, earnedIds, newlyEarned } = await earnRewards(
    db,
    student,
    now,
    options,
  );
  const overview = rewardsOverview({
    stats,
    earnedIds,
    totalRewardXp,
    yearGroup: student.yearGroup,
    now,
    seasonProgress,
  });
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

/**
 * Rewards progress without saving anything: the overview and parent-set rewards as they stand,
 * counting rewards earned but not yet seen as earned. For read-only screens (the stats
 * dashboards, workstream K), so the student's own Rewards page still gets its "New!" rewards.
 */
export async function rewardsProgress(
  db: Database,
  student: { id: string; yearGroup: number },
  now: Date,
): Promise<Pick<StudentRewardsResponse, 'overview' | 'parentRewards'>> {
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
  const earnedIds = [...before, ...fresh.map((r) => r.id)];
  const overview = rewardsOverview({
    stats,
    earnedIds,
    totalRewardXp,
    yearGroup: student.yearGroup,
    now,
    seasonProgress,
  });
  const parentRows = await db
    .select()
    .from(parentRewards)
    .where(eq(parentRewards.studentId, student.id))
    .orderBy(asc(parentRewards.createdAt), asc(parentRewards.id));
  return {
    overview,
    parentRewards: parentRows.map((row) => toParentReward(row, stats, earnedIds, localDate(now))),
  };
}

/** Student routes under /v1/student/rewards (the session check runs before these). */
export function studentRewardRoutes({ db, clock, config }: Deps) {
  const app = new Hono<AppEnv>();
  app.get('/', async (c) => {
    const [student] = await db
      .select({ id: students.id, yearGroup: students.yearGroup })
      .from(students)
      .where(eq(students.id, c.var.student.studentId));
    if (!student) throw notFound('Student not found');
    return c.json(await rewardsView(db, student, clock.now(), { betaEndsAt: config?.betaEndsAt }));
  });

  /** Two-part title (R8): the words this student has unlocked and the pair they picked. */
  async function titleView(studentId: string): Promise<StudentTitleResponse> {
    const [student] = await db
      .select({ nickname: students.nickname, first: students.titleFirst, last: students.titleLast })
      .from(students)
      .where(eq(students.id, studentId));
    if (!student) throw notFound('Student not found');
    const earned = await db
      .select({ rewardId: rewards.rewardId })
      .from(rewards)
      .where(eq(rewards.studentId, studentId));
    const choice = { first: student.first, last: student.last };
    return {
      nickname: student.nickname,
      ...choice,
      title: formatTitle(choice),
      words: titleWordsFor(earned.map((r) => r.rewardId)),
    };
  }

  /**
   * Effect styles this student has unlocked (J10b), from their earned rewards. On the dev
   * environment only (J12c), also every style a tester may try; nothing is unlocked for real.
   */
  app.get('/effect-styles', async (c) => {
    const earned = await db
      .select({ rewardId: rewards.rewardId })
      .from(rewards)
      .where(eq(rewards.studentId, c.var.student.studentId));
    const body: EffectStylesResponse = {
      unlocked: effectStylesFor(earned.map((r) => r.rewardId)),
      ...(config?.styleTester ? { testerStyles: EFFECT_STYLE_UNLOCKS.map((u) => u.style) } : {}),
    };
    return c.json(body);
  });

  app.get('/title', async (c) => c.json(await titleView(c.var.student.studentId)));

  /** Changing a title is free and allowed any time; only unlocked, curated words are accepted. */
  app.put('/title', async (c) => {
    const parsed = TitleChoiceSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, 'invalid_title', 'Pick words from your list');
    const studentId = c.var.student.studentId;
    const earned = await db
      .select({ rewardId: rewards.rewardId })
      .from(rewards)
      .where(eq(rewards.studentId, studentId));
    const result = chooseTitle(
      parsed.data,
      earned.map((r) => r.rewardId),
    );
    if (!result.ok) {
      throw new ApiError(400, `title_${result.reason}`, TITLE_MESSAGES[result.reason]);
    }
    await db
      .update(students)
      .set({ titleFirst: parsed.data.first, titleLast: parsed.data.last })
      .where(eq(students.id, studentId));
    return c.json(await titleView(studentId));
  });
  return app;
}

/** Parent routes under /v1/students/:id/rewards and /v1/students/:id/parent-rewards. */
export function parentRewardRoutes({ db, clock, config }: Deps) {
  const app = new Hono<AppEnv>();
  const family = (c: { var: AppEnv['Variables'] }) => c.var.parent.familyId;

  app.get('/:id/rewards', async (c) => {
    const student = await requireFamilyStudent(db, family(c), c.req.param('id'));
    return c.json(await rewardsView(db, student, clock.now(), { betaEndsAt: config?.betaEndsAt }));
  });

  /** Parent-set rewards with progress only (read by the parent dashboard, workstream K). */
  app.get('/:id/parent-rewards', async (c) => {
    const student = await requireFamilyStudent(db, family(c), c.req.param('id'));
    // Read-only, so a parent looking does not use up the child's "New!" rewards.
    const { parentRewards: list } = await rewardsProgress(db, student, clock.now());
    return c.json({ parentRewards: list });
  });

  app.post('/:id/parent-rewards', async (c) => {
    const student = await requireFamilyStudent(db, family(c), c.req.param('id'));
    const { title, note, target } = await readJson(c, CreateParentRewardRequestSchema);
    const [row] = await db
      .insert(parentRewards)
      .values({ studentId: student.id, title, note: note || null, ...targetColumns(target) })
      .returning();
    const view = await rewardsView(db, student, clock.now(), { betaEndsAt: config?.betaEndsAt });
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
    const view = await rewardsView(db, student, clock.now(), { betaEndsAt: config?.betaEndsAt });
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
    const view = await rewardsView(db, student, clock.now(), { betaEndsAt: config?.betaEndsAt });
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
