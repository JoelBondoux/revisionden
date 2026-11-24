import { Hono } from 'hono';
import { asc, count, eq, inArray } from 'drizzle-orm';
import {
  examSeasonFor,
  levelForYear,
  OnboardChildRequestSchema,
  REWARDS,
  toCheckLaterCount,
  UpdateAvatarRequestSchema,
  validateAvatar,
  validateSubjectChoices,
  type Enrolment,
  type OnboardedChild,
  type SubjectProblem,
} from '@revisionden/core';
import { devices, enrolments, rewards, students, type Database } from '@revisionden/db';
import type { AppEnv } from '../context';
import { ApiError } from '../errors';
import { requireFamilyStudent } from '../families';
import { isUniqueViolation, readJson } from '../http';
import type { Clock } from '../rate-limit';
import { toStudent } from './students';

type StudentRow = typeof students.$inferSelect;
type EnrolmentRow = typeof enrolments.$inferSelect;

const SUBJECT_PROBLEMS: Record<SubjectProblem, string> = {
  unknown_subject: 'not a subject we offer yet',
  wrong_level: 'not a subject for this school year',
  board_not_offered: 'that exam board does not offer this subject',
  tier_needed: 'pick Foundation, Higher or Not sure',
  not_tiered: 'this subject has no tiers',
  duplicate: 'chosen twice',
};

const rewardName = (id: string) => REWARDS.find((r) => r.id === id)?.name ?? id;

/** Rejects locked items the student has not earned. */
function checkAvatar(code: string, earned: readonly string[]) {
  const result = validateAvatar(code, earned);
  if (result.ok) return;
  const details = result.problems.map((p) =>
    p.reason === 'locked'
      ? `${p.layer}: needs the ${rewardName(p.requires)} reward`
      : `${p.layer}: not a known item`,
  );
  throw new ApiError(400, 'avatar_locked', 'That avatar uses items not unlocked yet', details);
}

const toEnrolment = (e: EnrolmentRow): Enrolment => ({
  studentId: e.studentId,
  subjectId: e.subjectId,
  board: e.board as Enrolment['board'],
  tier: e.tier as Enrolment['tier'],
});

function toOnboardedChild(
  s: StudentRow,
  rows: EnrolmentRow[],
  linkedDevices: number,
  today: Date,
): OnboardedChild {
  const list = rows.map(toEnrolment);
  return {
    student: toStudent(s),
    enrolments: list,
    // Onboarding only creates Years 9 to 13; older profiles fall back to GCSE timing.
    level: levelForYear(s.yearGroup) ?? 'gcse',
    examSeason: examSeasonFor(s.yearGroup, today) ?? examSeasonFor(11, today)!,
    toCheckLater: toCheckLaterCount(list),
    linkedDevices,
  };
}

/** Parent routes under /v1/onboarding: add a child in one step, and the family overview. */
export function onboardingRoutes({ db, clock }: { db: Database; clock: Clock }) {
  const app = new Hono<AppEnv>();

  app.post('/children', async (c) => {
    const input = await readJson(c, OnboardChildRequestSchema);
    checkAvatar(input.avatarCode, []);
    const problems = validateSubjectChoices(input.yearGroup, input.subjects);
    if (problems.length > 0) {
      throw new ApiError(
        400,
        'invalid_subjects',
        'Some subjects do not fit this school year',
        problems.map((p) => `${p.subjectId}: ${SUBJECT_PROBLEMS[p.problem]}`),
      );
    }

    let student: StudentRow;
    try {
      [student] = (await db
        .insert(students)
        .values({
          familyId: c.var.parent.familyId,
          nickname: input.nickname,
          avatarCode: input.avatarCode,
          yearGroup: input.yearGroup,
        })
        .returning()) as [StudentRow];
    } catch (err) {
      if (isUniqueViolation(err, 'students_family_nickname_unique')) {
        throw new ApiError(
          409,
          'nickname_taken',
          'Another student in the family has that nickname',
        );
      }
      throw err;
    }

    let rows: EnrolmentRow[] = [];
    if (input.subjects.length > 0) {
      try {
        rows = await db
          .insert(enrolments)
          .values(input.subjects.map((s) => ({ ...s, studentId: student.id })))
          .returning();
      } catch (err) {
        // No transactions on the Neon HTTP driver: undo the student so nothing is half-saved.
        await db.delete(students).where(eq(students.id, student.id));
        throw err;
      }
    }
    return c.json(toOnboardedChild(student, rows, 0, clock.now()), 201);
  });

  app.get('/family', async (c) => {
    const kids = await db
      .select()
      .from(students)
      .where(eq(students.familyId, c.var.parent.familyId))
      .orderBy(asc(students.createdAt), asc(students.nickname));
    const ids = kids.map((k) => k.id);
    const allEnrolments = ids.length
      ? await db
          .select()
          .from(enrolments)
          .where(inArray(enrolments.studentId, ids))
          .orderBy(asc(enrolments.subjectId))
      : [];
    const deviceCounts = ids.length
      ? await db
          .select({ studentId: devices.studentId, n: count() })
          .from(devices)
          .where(inArray(devices.studentId, ids))
          .groupBy(devices.studentId)
      : [];
    const today = clock.now();
    return c.json({
      children: kids.map((k) =>
        toOnboardedChild(
          k,
          allEnrolments.filter((e) => e.studentId === k.id),
          deviceCounts.find((d) => d.studentId === k.id)?.n ?? 0,
          today,
        ),
      ),
    });
  });

  return app;
}

/** Parent routes under /v1/students/:id/avatar: read and change the avatar code. */
export function avatarRoutes({ db }: { db: Database }) {
  const app = new Hono<AppEnv>();

  async function earnedRewards(studentId: string) {
    const rows = await db
      .select({ rewardId: rewards.rewardId })
      .from(rewards)
      .where(eq(rewards.studentId, studentId))
      .orderBy(asc(rewards.rewardId));
    return rows.map((r) => r.rewardId);
  }

  app.get('/:id/avatar', async (c) => {
    const student = await requireFamilyStudent(db, c.var.parent.familyId, c.req.param('id'));
    return c.json({
      avatarCode: student.avatarCode,
      earnedRewardIds: await earnedRewards(student.id),
    });
  });

  app.put('/:id/avatar', async (c) => {
    const student = await requireFamilyStudent(db, c.var.parent.familyId, c.req.param('id'));
    const { avatarCode } = await readJson(c, UpdateAvatarRequestSchema);
    checkAvatar(avatarCode, await earnedRewards(student.id));
    const [row] = await db
      .update(students)
      .set({ avatarCode, updatedAt: new Date() })
      .where(eq(students.id, student.id))
      .returning();
    return c.json(toStudent(row!));
  });

  return app;
}
