import { Hono } from 'hono';
import { and, desc, eq, gt, inArray, isNotNull, isNull } from 'drizzle-orm';
import { bugReward } from '@revisionden/core';
import { z } from 'zod';
import {
  FEEDBACK_KINDS,
  FEEDBACK_MAX_TEXT,
  FEEDBACK_STATUSES,
  POLICIES_TO_ACCEPT,
  feedback,
  policyAcceptances,
  students,
  type Database,
} from '@revisionden/db';
import type { AppEnv } from '../context';
import type { AppConfig } from '../env';
import { ApiError, notFound } from '../errors';
import { readJson } from '../http';
import type { Clock } from '../rate-limit';
import { isId } from '../validation';
import { findPersonalData, type StudentProfile } from '../ai/privacy';
import { requireFamilyStudent } from '../families';
import { bugHunterSummary, bugRewardsThisWeek } from './bugHunter';

export interface FeedbackDeps {
  db: Database;
  config: AppConfig;
  clock: Clock;
}

/** Feedback each account may send in any 24 hours (docs/PRODUCT_RULES.md). */
export const FEEDBACK_PER_DAY = 5;
const DAY_MS = 24 * 60 * 60 * 1000;
const CLOSED_STATUSES = new Set(['fixed', 'will_not_fix']);

// TODO(workstream C): move these request schemas into packages/core.
const deviceSchema = z
  .object({
    appVersion: z.string().max(20),
    route: z.string().max(200),
    browserFamily: z.string().max(40),
    screenSize: z.string().max(20),
    online: z.boolean(),
  })
  .partial()
  .strict();
const sendSchema = z
  .object({
    kind: z.enum(FEEDBACK_KINDS),
    text: z.string().max(FEEDBACK_MAX_TEXT).optional(),
    device: deviceSchema.optional(),
  })
  .strict();
const statusSchema = z.object({ status: z.enum(FEEDBACK_STATUSES) }).strict();
const confirmSchema = z.object({ duplicateOf: z.string().optional() }).strict();
const seenSchema = z.object({ ids: z.array(z.string()).max(50) }).strict();
const acceptSchema = z
  .object({
    acceptances: z
      .array(
        z
          .object({
            policy: z.enum(POLICIES_TO_ACCEPT),
            version: z.string().regex(/^\d+\.\d+$/, 'Use a version like 1.0'),
          })
          .strict(),
      )
      .min(1)
      .max(POLICIES_TO_ACCEPT.length),
  })
  .strict();

export const personalDetails = () =>
  new ApiError(
    400,
    'personal_details',
    'Please leave out personal details like names, email addresses and phone numbers.',
  );
const limitReached = () =>
  new ApiError(429, 'feedback_limit', 'You can send 5 messages a day. Try again tomorrow.');

/** A profile with nothing in it, so the email and phone checks still run. */
const NO_PROFILE: StudentProfile = {
  id: '\u0000',
  familyId: '\u0000',
  nickname: '\u0000',
  avatarCode: '\u0000',
  yearGroup: -1,
};

/** The same checks as the AI privacy filter, against every given student profile. */
export function containsPersonalData(text: string, profiles: StudentProfile[]): boolean {
  const list = profiles.length > 0 ? profiles : [NO_PROFILE];
  return list.some((profile) => findPersonalData(text, profile).length > 0);
}

export async function familyProfiles(db: Database, familyId: string): Promise<StudentProfile[]> {
  return db
    .select({
      id: students.id,
      familyId: students.familyId,
      nickname: students.nickname,
      avatarCode: students.avatarCode,
      yearGroup: students.yearGroup,
    })
    .from(students)
    .where(eq(students.familyId, familyId));
}

function toFeedback(row: typeof feedback.$inferSelect) {
  return {
    id: row.id,
    kind: row.kind,
    text: row.text,
    status: row.status,
    senderRole: row.senderRole,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    outcome: row.outcome ?? null,
    rewardXp: row.rewardXp,
  };
}

const toAdminFeedback = (row: typeof feedback.$inferSelect) => ({
  ...toFeedback(row),
  device: row.device,
  duplicateOf: row.duplicateOf ?? null,
});

/** The thank-you the sender sees for a confirmed report (packages/core bugReward). */
function rewardMessage(row: typeof feedback.$inferSelect): string {
  if (row.senderRole === 'parent') return 'Thank you for reporting this bug.';
  if (row.rewardXp === 0) return 'Your bug report helped! Thank you.';
  return row.outcome === 'duplicate'
    ? `Thanks for confirming that bug! +${row.rewardXp} XP`
    : `Your bug report helped! +${row.rewardXp} XP`;
}

async function sentInLastDay(db: Database, now: Date, sender: ReturnType<typeof eq>) {
  const rows = await db
    .select({ id: feedback.id })
    .from(feedback)
    .where(and(sender, gt(feedback.createdAt, new Date(now.getTime() - DAY_MS))));
  return rows.length;
}

/** Student device routes under /v1/student (the student session is checked by the caller). */
export function studentFeedbackRoutes({ db, clock }: FeedbackDeps) {
  const app = new Hono<AppEnv>();

  app.post('/feedback', async (c) => {
    const body = await readJson(c, sendSchema);
    const { studentId, familyId } = c.var.student;
    const profiles = (await familyProfiles(db, familyId)).filter((p) => p.id === studentId);
    if (body.text && containsPersonalData(body.text, profiles)) throw personalDetails();
    const now = clock.now();
    if ((await sentInLastDay(db, now, eq(feedback.studentId, studentId))) >= FEEDBACK_PER_DAY) {
      throw limitReached();
    }
    const [row] = await db
      .insert(feedback)
      .values({
        familyId,
        senderRole: 'student',
        studentId,
        kind: body.kind,
        text: body.text || null,
        device: body.device ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return c.json(toFeedback(row!), 201);
  });

  app.get('/feedback', async (c) => {
    const rows = await db
      .select()
      .from(feedback)
      .where(eq(feedback.studentId, c.var.student.studentId))
      .orderBy(desc(feedback.createdAt));
    return c.json({ feedback: rows.map(toFeedback) });
  });

  // Thank-yous for confirmed bug reports the student has not seen yet.
  app.get('/feedback/rewards', async (c) => {
    const rows = await db
      .select()
      .from(feedback)
      .where(
        and(
          eq(feedback.studentId, c.var.student.studentId),
          isNotNull(feedback.outcome),
          isNull(feedback.rewardSeenAt),
        ),
      )
      .orderBy(feedback.confirmedAt);
    return c.json({
      rewards: rows.map((r) => ({
        id: r.id,
        outcome: r.outcome,
        rewardXp: r.rewardXp,
        message: rewardMessage(r),
        confirmedAt: r.confirmedAt?.toISOString() ?? null,
      })),
    });
  });

  app.post('/feedback/rewards/seen', async (c) => {
    const { ids } = await readJson(c, seenSchema);
    const valid = ids.filter(isId);
    if (valid.length > 0) {
      await db
        .update(feedback)
        .set({ rewardSeenAt: clock.now() })
        .where(and(eq(feedback.studentId, c.var.student.studentId), inArray(feedback.id, valid)));
    }
    return c.body(null, 204);
  });

  app.get('/bug-hunter', async (c) => c.json(await bugHunterSummary(db, c.var.student.studentId)));

  return app;
}

/** Parent route under /v1/students: one child's Bug Hunter count (own family only). */
export function parentBugHunterRoutes({ db }: FeedbackDeps) {
  const app = new Hono<AppEnv>();
  app.get('/:id/bug-hunter', async (c) => {
    const student = await requireFamilyStudent(db, c.var.parent.familyId, c.req.param('id'));
    return c.json(await bugHunterSummary(db, student.id));
  });
  return app;
}

/** Parent routes under /v1 (the parent session is checked by the caller). */
export function parentFeedbackRoutes({ db, clock }: FeedbackDeps) {
  const app = new Hono<AppEnv>();

  app.post('/feedback', async (c) => {
    const body = await readJson(c, sendSchema);
    const { familyId, authUserId } = c.var.parent;
    if (body.text && containsPersonalData(body.text, await familyProfiles(db, familyId))) {
      throw personalDetails();
    }
    const now = clock.now();
    const sent = await sentInLastDay(db, now, eq(feedback.senderAuthUserId, authUserId));
    if (sent >= FEEDBACK_PER_DAY) throw limitReached();
    const [row] = await db
      .insert(feedback)
      .values({
        familyId,
        senderRole: 'parent',
        senderAuthUserId: authUserId,
        kind: body.kind,
        text: body.text || null,
        device: body.device ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return c.json({ ...toFeedback(row!), studentNickname: null }, 201);
  });

  app.get('/feedback', async (c) => {
    const rows = await db
      .select({ row: feedback, nickname: students.nickname })
      .from(feedback)
      .leftJoin(students, eq(students.id, feedback.studentId))
      .where(eq(feedback.familyId, c.var.parent.familyId))
      .orderBy(desc(feedback.createdAt));
    return c.json({
      feedback: rows.map(({ row, nickname }) => ({
        ...toFeedback(row),
        studentNickname: nickname ?? null,
      })),
    });
  });

  app.get('/policy-acceptances', async (c) => {
    return c.json({ acceptances: await listAcceptances(db, c.var.parent.authUserId) });
  });

  app.put('/policy-acceptances', async (c) => {
    const { acceptances } = await readJson(c, acceptSchema);
    const authUserId = c.var.parent.authUserId;
    const now = clock.now();
    for (const { policy, version } of acceptances) {
      await db
        .insert(policyAcceptances)
        .values({ authUserId, policy, version, acceptedAt: now })
        .onConflictDoUpdate({
          target: [policyAcceptances.authUserId, policyAcceptances.policy],
          set: { version, acceptedAt: now },
        });
    }
    return c.json({ acceptances: await listAcceptances(db, authUserId) });
  });

  return app;
}

async function listAcceptances(db: Database, authUserId: string) {
  const rows = await db
    .select()
    .from(policyAcceptances)
    .where(eq(policyAcceptances.authUserId, authUserId))
    .orderBy(policyAcceptances.policy);
  return rows.map((r) => ({
    policy: r.policy,
    version: r.version,
    acceptedAt: r.acceptedAt.toISOString(),
  }));
}

/**
 * Operator triage under /v1/admin (the parent session is checked by the caller). Only sign-in
 * emails listed in OPERATOR_EMAILS get in; anyone else gets a 404, so the route stays hidden.
 * Rows never carry the family id, the parent's email or the student's nickname.
 */
export function adminFeedbackRoutes({ db, config, clock }: FeedbackDeps) {
  const app = new Hono<AppEnv>();

  app.use('*', async (c, next) => {
    if (!config.operatorEmails.includes(c.var.parentEmail.toLowerCase())) throw notFound();
    await next();
  });

  app.get('/feedback', async (c) => {
    const rows = await db.select().from(feedback).orderBy(desc(feedback.createdAt));
    return c.json({ feedback: rows.map(toAdminFeedback) });
  });

  // Confirm a bug report, or mark it a duplicate of an earlier confirmed one, and reward the
  // student who sent it (packages/core bugReward; docs/REWARDS.md, Bug Hunter track).
  app.post('/feedback/:id/confirm', async (c) => {
    const id = c.req.param('id');
    const { duplicateOf } = await readJson(c, confirmSchema);
    if (!isId(id)) throw notFound('Feedback not found');
    const [row] = await db.select().from(feedback).where(eq(feedback.id, id));
    if (!row) throw notFound('Feedback not found');
    if (row.kind !== 'bug')
      throw new ApiError(400, 'not_a_bug', 'Only bug reports can be confirmed.');
    if (row.outcome)
      throw new ApiError(409, 'already_confirmed', 'This report is already confirmed.');
    if (duplicateOf !== undefined) {
      const [original] = isId(duplicateOf)
        ? await db.select().from(feedback).where(eq(feedback.id, duplicateOf))
        : [];
      if (!original || original.outcome !== 'confirmed' || original.createdAt > row.createdAt) {
        throw new ApiError(400, 'invalid_duplicate', 'Pick an earlier confirmed bug report.');
      }
    }
    const now = clock.now();
    const reward = bugReward({
      senderRole: row.senderRole,
      duplicate: duplicateOf !== undefined,
      rewardsThisWeek: row.studentId ? await bugRewardsThisWeek(db, row.studentId, now) : 0,
    });
    const [updated] = await db
      .update(feedback)
      .set({
        outcome: duplicateOf !== undefined ? 'duplicate' : 'confirmed',
        duplicateOf: duplicateOf ?? null,
        rewardXp: reward.xp,
        trackStep: reward.trackStep,
        confirmedAt: now,
        updatedAt: now,
        ...(row.status === 'new' ? { status: 'looking_into_it' as const } : {}),
      })
      .where(and(eq(feedback.id, id), isNull(feedback.outcome)))
      .returning();
    if (!updated) throw new ApiError(409, 'already_confirmed', 'This report is already confirmed.');
    return c.json({ item: toAdminFeedback(updated), message: reward.message });
  });

  app.patch('/feedback/:id', async (c) => {
    const id = c.req.param('id');
    const { status } = await readJson(c, statusSchema);
    if (!isId(id)) throw notFound('Feedback not found');
    const now = clock.now();
    const [row] = await db
      .update(feedback)
      .set({ status, updatedAt: now, closedAt: CLOSED_STATUSES.has(status) ? now : null })
      .where(eq(feedback.id, id))
      .returning();
    if (!row) throw notFound('Feedback not found');
    return c.json(toAdminFeedback(row));
  });

  return app;
}
