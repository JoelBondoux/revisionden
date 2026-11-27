import { Hono } from 'hono';
import { and, desc, eq, gt, inArray, isNotNull, isNull, notInArray, sql } from 'drizzle-orm';
import { bugButtonState, bugReward, type BugButtonState } from '@revisionden/core';
import { z } from 'zod';
import {
  FEEDBACK_KINDS,
  FEEDBACK_MAX_TEXT,
  FEEDBACK_STATUSES,
  LESSON_FEEDBACK_KINDS,
  POLICIES_TO_ACCEPT,
  feedback,
  items,
  feedbackReplies,
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
/** A display setting name such as "doodle-diary" or "dark" (F16). */
const setting = z.string().regex(/^[a-z0-9-]{1,40}$/);
const deviceSchema = z
  .object({
    appVersion: z.string().max(20),
    route: z.string().max(200),
    browserFamily: z.string().max(40),
    screenSize: z.string().max(20),
    online: z.boolean(),
    /** E8: the last problem the screen showed, a short code only (no free text). */
    lastProblem: z.string().regex(/^[A-Za-z0-9_:-]{1,80}$/),
    /** F16: the content id of the question or deck card on screen; an id only, never text. */
    contentId: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),
    // F16: how the screen looked (settings and sizes only, never free text). Never the reading
    // tint, the dyslexia-friendly font or the colour-blind colours, which could hint at a health
    // condition (L ruling in #392): the strict schema refuses them.
    look: setting,
    theme: setting,
    pattern: setting,
    pixelRatio: z.number().min(0.1).max(10),
    zoom: z.number().min(0.1).max(10),
    textScale: z.number().min(0.1).max(10),
  })
  .partial()
  .strict();
const isLessonKind = (kind: string) => (LESSON_FEEDBACK_KINDS as readonly string[]).includes(kind);

/**
 * A lesson tap ("Did this help?" after an interactive lesson, W8) names the item and never has
 * text; other feedback never names an item.
 */
const sendSchema = z
  .object({
    kind: z.enum(FEEDBACK_KINDS),
    text: z.string().max(FEEDBACK_MAX_TEXT).optional(),
    device: deviceSchema.optional(),
    itemId: z.string().uuid().optional(),
  })
  .strict()
  .refine((b) => (isLessonKind(b.kind) ? !!b.itemId && b.text === undefined : !b.itemId), {
    message: 'Lesson feedback names an item and has no text; other feedback has no item',
  });
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
    itemId: row.itemId ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    outcome: row.outcome ?? null,
    rewardXp: row.rewardXp,
  };
}

const toAdminFeedback = (row: typeof feedback.$inferSelect, tester = false) => ({
  ...toFeedback(row),
  device: row.device,
  duplicateOf: row.duplicateOf ?? null,
  // L13: sent from a tester account (operator console), so it earns nothing and never rests.
  tester,
});

/** L13: whether a student is a tester account (set only in the operator console). */
async function isTester(db: Database, studentId: string | null): Promise<boolean> {
  if (!studentId) return false;
  const [row] = await db
    .select({ tester: students.tester })
    .from(students)
    .where(eq(students.id, studentId));
  return row?.tester ?? false;
}

/** The thank-you the sender sees for a confirmed report (packages/core bugReward). */
function rewardMessage(row: typeof feedback.$inferSelect): string {
  if (row.senderRole === 'parent') return 'Thank you for reporting this bug.';
  if (row.rewardXp === 0) return 'Your bug report helped! Thank you.';
  return row.outcome === 'duplicate'
    ? `Thanks for confirming that bug! +${row.rewardXp} XP`
    : `Your bug report helped! +${row.rewardXp} XP`;
}

/** The bug button as the app shows it: on, resting until a time, or removed (L13). */
export function toBugButton(state: BugButtonState) {
  return state.state === 'paused'
    ? { state: state.state, until: state.until.toISOString() }
    : { state: state.state };
}

/** A student's bug button (packages/core bugButtonState), from their Not-a-bug reports. */
export async function studentBugButton(
  db: Database,
  studentId: string,
  now: Date,
): Promise<BugButtonState> {
  const [student] = await db
    .select({ resetAt: students.bugButtonResetAt, tester: students.tester })
    .from(students)
    .where(eq(students.id, studentId));
  const rows = await db
    .select({ at: feedback.notABugAt })
    .from(feedback)
    .where(
      and(
        eq(feedback.studentId, studentId),
        eq(feedback.kind, 'bug'),
        eq(feedback.outcome, 'not_a_bug'),
        isNotNull(feedback.notABugAt),
      ),
    );
  return bugButtonState({
    notABugAt: rows.flatMap((r) => (r.at ? [r.at] : [])),
    resetAt: student?.resetAt ?? null,
    tester: student?.tester ?? false,
    now,
  });
}

/** Switches a student's bug button back on (a parent or the operator): older outcomes stop counting. */
export async function switchBugButtonOn(db: Database, studentId: string, now: Date) {
  await db
    .update(students)
    .set({ bugButtonResetAt: now, updatedAt: now })
    .where(eq(students.id, studentId));
  return studentBugButton(db, studentId, now);
}

const bugButtonResting = () =>
  new ApiError(
    403,
    'bug_button_resting',
    'The bug button is taking a rest. You can still send us an idea, or ask a parent for help.',
  );

async function sentInLastDay(db: Database, now: Date, sender: ReturnType<typeof eq>) {
  const rows = await db
    .select({ id: feedback.id })
    .from(feedback)
    .where(
      and(
        sender,
        gt(feedback.createdAt, new Date(now.getTime() - DAY_MS)),
        // Lesson taps (W8) do not use up the daily limit.
        notInArray(feedback.kind, [...LESSON_FEEDBACK_KINDS]),
      ),
    );
  return rows.length;
}

/** Student device routes under /v1/student (the student session is checked by the caller). */
export function studentFeedbackRoutes({ db, clock }: FeedbackDeps) {
  const app = new Hono<AppEnv>();

  /** One answer per student and item: a second tap replaces the first. No text is ever kept. */
  async function saveLessonTap(
    kind: (typeof FEEDBACK_KINDS)[number],
    itemId: string,
    { studentId, familyId }: { studentId: string; familyId: string },
  ) {
    return db.transaction(async (tx) => {
      const [item] = await tx.select({ id: items.id }).from(items).where(eq(items.id, itemId));
      if (!item) throw notFound('That question no longer exists');
      const now = clock.now();
      // One answer per student and item, enforced by the feedback_lesson_tap_unique partial
      // index; the WHERE here repeats its predicate so Postgres can use it (W8b).
      const [row] = await tx
        .insert(feedback)
        .values({
          familyId,
          senderRole: 'student',
          studentId,
          kind,
          itemId,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [feedback.studentId, feedback.itemId],
          targetWhere: sql`${feedback.kind} in ('lesson_helped', 'lesson_not_helped')`,
          set: { kind, updatedAt: now },
        })
        .returning();
      return row!;
    });
  }

  app.post('/feedback', async (c) => {
    const body = await readJson(c, sendSchema);
    const { studentId, familyId } = c.var.student;
    if (body.itemId) {
      const row = await saveLessonTap(body.kind, body.itemId, { studentId, familyId });
      return c.json(toFeedback(row), 201);
    }
    const now = clock.now();
    // L13: while the bug button rests or is removed, bug reports are refused (other kinds are not).
    if (body.kind === 'bug' && (await studentBugButton(db, studentId, now)).state !== 'on') {
      throw bugButtonResting();
    }
    const profiles = (await familyProfiles(db, familyId)).filter((p) => p.id === studentId);
    if (body.text && containsPersonalData(body.text, profiles)) throw personalDetails();
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
    const replies = await repliesFor(
      db,
      rows.map((r) => r.id),
    );
    return c.json({
      feedback: rows.map((r) => ({ ...toFeedback(r), replies: replies.get(r.id) ?? [] })),
    });
  });

  // Thank-yous for confirmed bug reports the student has not seen yet.
  app.get('/feedback/rewards', async (c) => {
    const rows = await db
      .select()
      .from(feedback)
      .where(
        and(
          eq(feedback.studentId, c.var.student.studentId),
          inArray(feedback.outcome, ['confirmed', 'duplicate']),
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

  // L13: whether the bug button is on, resting until a time, or removed.
  app.get('/bug-button', async (c) =>
    c.json(toBugButton(await studentBugButton(db, c.var.student.studentId, clock.now()))),
  );

  return app;
}

/** Parent route under /v1/students: one child's Bug Hunter count (own family only). */
export function parentBugHunterRoutes({ db, clock }: FeedbackDeps) {
  const app = new Hono<AppEnv>();
  app.get('/:id/bug-hunter', async (c) => {
    const student = await requireFamilyStudent(db, c.var.parent.familyId, c.req.param('id'));
    return c.json(await bugHunterSummary(db, student.id));
  });
  // L13: a parent sees whether the child's bug button is resting or removed, and can switch it on.
  app.get('/:id/bug-button', async (c) => {
    const student = await requireFamilyStudent(db, c.var.parent.familyId, c.req.param('id'));
    return c.json(toBugButton(await studentBugButton(db, student.id, clock.now())));
  });
  app.post('/:id/bug-button/on', async (c) => {
    const student = await requireFamilyStudent(db, c.var.parent.familyId, c.req.param('id'));
    return c.json(toBugButton(await switchBugButtonOn(db, student.id, clock.now())));
  });
  return app;
}

/** Parent routes under /v1 (the parent session is checked by the caller). */
export function parentFeedbackRoutes({ db, clock }: FeedbackDeps) {
  const app = new Hono<AppEnv>();

  app.post('/feedback', async (c) => {
    const body = await readJson(c, sendSchema);
    if (body.itemId)
      throw new ApiError(400, 'invalid_request', 'Lesson feedback comes from students');
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
    const replies = await repliesFor(
      db,
      rows.map(({ row }) => row.id),
    );
    return c.json({
      feedback: rows.map(({ row, nickname }) => ({
        ...toFeedback(row),
        studentNickname: nickname ?? null,
        replies: replies.get(row.id) ?? [],
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
    const rows = await db
      .select({ row: feedback, tester: students.tester })
      .from(feedback)
      .leftJoin(students, eq(students.id, feedback.studentId))
      .orderBy(desc(feedback.createdAt));
    return c.json({ feedback: rows.map((r) => toAdminFeedback(r.row, r.tester ?? false)) });
  });

  // Confirm a bug report, or mark it a duplicate of an earlier confirmed one, and reward the
  // student who sent it (packages/core bugReward; docs/REWARDS.md, Bug Hunter track).
  app.post('/feedback/:id/confirm', async (c) => {
    const { duplicateOf } = await readJson(c, confirmSchema);
    const { item, message } = await confirmFeedback(
      db,
      clock.now(),
      c.req.param('id'),
      duplicateOf,
    );
    return c.json({ item: toAdminFeedback(item, await isTester(db, item.studentId)), message });
  });

  // L13: a bug report that is not a bug. Closes it; three in 14 days rest the bug button.
  app.post('/feedback/:id/not-a-bug', async (c) => {
    const item = await markNotABug(db, clock.now(), c.req.param('id'));
    return c.json({ item: toAdminFeedback(item, await isTester(db, item.studentId)) });
  });

  app.patch('/feedback/:id', async (c) => {
    const { status } = await readJson(c, statusSchema);
    const row = await setFeedbackStatus(db, clock.now(), c.req.param('id'), status);
    return c.json(toAdminFeedback(row, await isTester(db, row.studentId)));
  });

  return app;
}

/**
 * Confirms a bug report, or marks it a duplicate of an earlier confirmed one, and rewards the
 * student who sent it (packages/core bugReward; docs/REWARDS.md, Bug Hunter track). Shared by
 * the operator page (`/v1/admin`) and the AppDeck bridge (`/operator/appdeck`).
 */
export async function confirmFeedback(
  db: Database,
  now: Date,
  id: string,
  duplicateOf?: string,
): Promise<{ item: typeof feedback.$inferSelect; message: string }> {
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
  const reward = bugReward({
    senderRole: row.senderRole,
    duplicate: duplicateOf !== undefined,
    rewardsThisWeek: row.studentId ? await bugRewardsThisWeek(db, row.studentId, now) : 0,
    tester: await isTester(db, row.studentId),
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
  return { item: updated, message: reward.message };
}

/**
 * Marks a bug report Not a bug (L13): no reward, closed as will not fix. Only a report sent as a
 * bug, with no outcome yet. A student's Not-a-bug reports rest their bug button
 * (packages/core bugButtonState). Shared by the operator page and the AppDeck bridge.
 */
export async function markNotABug(
  db: Database,
  now: Date,
  id: string,
): Promise<typeof feedback.$inferSelect> {
  if (!isId(id)) throw notFound('Feedback not found');
  const [row] = await db.select().from(feedback).where(eq(feedback.id, id));
  if (!row) throw notFound('Feedback not found');
  if (row.kind !== 'bug')
    throw new ApiError(400, 'not_a_bug', 'Only bug reports can be marked Not a bug.');
  if (row.outcome) throw new ApiError(409, 'already_reviewed', 'This report is already reviewed.');
  const [updated] = await db
    .update(feedback)
    .set({
      outcome: 'not_a_bug',
      notABugAt: now,
      status: 'will_not_fix',
      closedAt: now,
      updatedAt: now,
    })
    .where(and(eq(feedback.id, id), isNull(feedback.outcome)))
    .returning();
  if (!updated) throw new ApiError(409, 'already_reviewed', 'This report is already reviewed.');
  return updated;
}

/** Sets a ticket's status; fixed and will-not-fix close it (deleted 12 months later). */
export async function setFeedbackStatus(
  db: Database,
  now: Date,
  id: string,
  status: (typeof FEEDBACK_STATUSES)[number],
): Promise<typeof feedback.$inferSelect> {
  if (!isId(id)) throw notFound('Feedback not found');
  const [row] = await db
    .update(feedback)
    .set({ status, updatedAt: now, closedAt: CLOSED_STATUSES.has(status) ? now : null })
    .where(eq(feedback.id, id))
    .returning();
  if (!row) throw notFound('Feedback not found');
  return row;
}

/** Support replies per ticket, oldest first: text and time only (never who wrote them). */
async function repliesFor(db: Database, ids: string[]) {
  const map = new Map<string, { body: string; createdAt: string }[]>();
  if (ids.length === 0) return map;
  const rows = await db
    .select()
    .from(feedbackReplies)
    .where(inArray(feedbackReplies.feedbackId, ids))
    .orderBy(feedbackReplies.createdAt);
  for (const r of rows) {
    map.set(r.feedbackId, [
      ...(map.get(r.feedbackId) ?? []),
      { body: r.body, createdAt: r.createdAt.toISOString() },
    ]);
  }
  return map;
}
