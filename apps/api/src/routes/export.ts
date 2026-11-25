/**
 * GET /v1/export (parent session checked by the caller): everything we hold about the parent
 * and the family's students, as a JSON file to download (UK GDPR access and portability).
 *
 * Only the signed-in parent's own sign-in records are included, and only students in their own
 * family. Secrets are left out because they are not information about the family and could be
 * misused if the file is shared: session and link-code hashes, passkey public keys and
 * credential ids, and push service keys.
 */
import { Hono } from 'hono';
import { and, eq, inArray, or, type SQL } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import {
  aiUsage,
  attempts,
  authAccounts,
  authUsers,
  dailySets,
  dailyXp,
  devices,
  enrolments,
  exams,
  families,
  feedback,
  feedbackReplies,
  operatorNotes,
  flashcardSessions,
  flashcards,
  reviewPoints,
  itemReports,
  mastery,
  parentPushSubscriptions,
  parentRewards,
  plans,
  policyAcceptances,
  pushSubscriptions,
  reminderLog,
  reminderSettings,
  rewards,
  schoolReports,
  startingTests,
  streaks,
  students,
  type Database,
} from '@revisionden/db';
import type { AppEnv } from '../context';
import type { Clock } from '../rate-limit';
import { listFamilyEvents, recordFamilyEvent } from '../family-events';

type StudentTable = PgTable & { studentId: PgColumn };

/** Per-student records: name in the file, table, and columns to leave out. */
const STUDENT_RECORDS: [string, StudentTable, string[]][] = [
  ['courses', enrolments, []],
  ['devices', devices, ['credentialId', 'publicKey', 'counter', 'transports']],
  ['answers', attempts, []],
  ['mastery', mastery, []],
  ['exams', exams, []],
  ['schoolReports', schoolReports, []],
  ['plans', plans, []],
  ['rewards', rewards, []],
  ['streak', streaks, []],
  ['dailyXp', dailyXp, []],
  ['dailySets', dailySets, []],
  ['startingTests', startingTests, []],
  ['flashcards', flashcards, []],
  ['reviewPoints', reviewPoints, []],
  ['flashcardSessions', flashcardSessions, []],
  ['reminderDevices', pushSubscriptions, ['endpoint', 'p256dh', 'auth']],
  ['reminderSettings', reminderSettings, []],
  ['reminderLog', reminderLog, []],
  ['aiUsage', aiUsage, []],
  ['parentRewards', parentRewards, []],
];

function without(row: Record<string, unknown>, omit: string[]) {
  return Object.fromEntries(Object.entries(row).filter(([key]) => !omit.includes(key)));
}

async function studentRecords(db: Database, studentIds: string[]) {
  const byStudent = new Map<string, Record<string, unknown[]>>(studentIds.map((id) => [id, {}]));
  for (const [name, table, omit] of STUDENT_RECORDS) {
    const rows = (await db
      .select()
      .from(table)
      .where(inArray(table.studentId, studentIds))) as Record<string, unknown>[];
    for (const id of studentIds) byStudent.get(id)![name] = [];
    for (const row of rows) {
      byStudent.get(row.studentId as string)![name]!.push(without(row, [...omit, 'studentId']));
    }
  }
  return byStudent;
}

export function familyExport({ db, clock }: { db: Database; clock: Clock }) {
  const app = new Hono<AppEnv>();

  app.get('/export', async (c) => {
    const { familyId, authUserId, position } = c.var.parent;
    const now = clock.now();

    const [user] = await db.select().from(authUsers).where(eq(authUsers.id, authUserId));
    const signIns = await db
      .select({
        providerId: authAccounts.providerId,
        accountId: authAccounts.accountId,
        createdAt: authAccounts.createdAt,
      })
      .from(authAccounts)
      .where(eq(authAccounts.userId, authUserId));
    const acceptances = await db
      .select({
        policy: policyAcceptances.policy,
        version: policyAcceptances.version,
        acceptedAt: policyAcceptances.acceptedAt,
      })
      .from(policyAcceptances)
      .where(eq(policyAcceptances.authUserId, authUserId));
    // The parent's own devices with reward news on (H2); push keys and endpoints left out.
    const rewardNewsDevices = await db
      .select({ id: parentPushSubscriptions.id, createdAt: parentPushSubscriptions.createdAt })
      .from(parentPushSubscriptions)
      .where(eq(parentPushSubscriptions.parentId, c.var.parent.parentId));
    const [family] = await db.select().from(families).where(eq(families.id, familyId));
    const kids = await db
      .select()
      .from(students)
      .where(eq(students.familyId, familyId))
      .orderBy(students.createdAt);
    const ids = kids.map((k) => k.id);
    const records = ids.length > 0 ? await studentRecords(db, ids) : new Map();

    // Feedback sent by this parent or by one of their children.
    const sentBy: SQL[] = [eq(feedback.senderAuthUserId, authUserId)];
    if (ids.length > 0) sentBy.push(inArray(feedback.studentId, ids));
    const familyFeedback = await db
      .select()
      .from(feedback)
      .where(and(eq(feedback.familyId, familyId), or(...sentBy)))
      .orderBy(feedback.createdAt);
    // Support replies to that feedback and support notes about the family (workstream O):
    // text and time only, never which member of staff wrote them.
    const replies =
      familyFeedback.length > 0
        ? await db
            .select({
              feedbackId: feedbackReplies.feedbackId,
              body: feedbackReplies.body,
              createdAt: feedbackReplies.createdAt,
            })
            .from(feedbackReplies)
            .where(
              inArray(
                feedbackReplies.feedbackId,
                familyFeedback.map((f) => f.id),
              ),
            )
            .orderBy(feedbackReplies.createdAt)
        : [];
    const supportNotes = await db
      .select({ text: operatorNotes.text, createdAt: operatorNotes.createdAt })
      .from(operatorNotes)
      .where(eq(operatorNotes.familyId, familyId))
      .orderBy(operatorNotes.createdAt);
    const reports = await db
      .select()
      .from(itemReports)
      .where(eq(itemReports.familyId, familyId))
      .orderBy(itemReports.createdAt);

    const log = await listFamilyEvents(db, { familyId, position, since: now });
    const body = {
      about:
        'Everything RevisionDen holds about you and your children. Secrets such as sign-in ' +
        'session codes and device keys are left out.',
      exportedAt: now.toISOString(),
      parent: {
        email: user!.email,
        emailVerified: user!.emailVerified,
        createdAt: user!.createdAt,
        signIns,
        policyAcceptances: acceptances,
        rewardNewsDevices,
      },
      family: {
        id: family!.id,
        createdAt: family!.createdAt,
        lastActiveAt: family!.lastActiveAt,
      },
      students: kids.map((kid) => ({
        profile: {
          id: kid.id,
          nickname: kid.nickname,
          avatarCode: kid.avatarCode,
          yearGroup: kid.yearGroup,
          createdAt: kid.createdAt,
          updatedAt: kid.updatedAt,
        },
        ...records.get(kid.id),
      })),
      feedback: familyFeedback.map((row) => ({
        ...without(row, ['familyId', 'senderAuthUserId']),
        replies: replies
          .filter((r) => r.feedbackId === row.id)
          .map(({ body, createdAt }) => ({ body, createdAt })),
      })),
      supportNotes,
      questionReports: reports.map((row) => without(row, ['familyId'])),
      activityLog: log.events.map(({ by, what, createdAt }) => ({ by, what, at: createdAt })),
    };

    const day = now.toISOString().slice(0, 10);
    // The other parent is told about an export (docs/PRODUCT_RULES.md "Two parents").
    await recordFamilyEvent(db, { familyId, actorPosition: position, kind: 'data_exported', now });
    c.header('content-disposition', `attachment; filename="revisionden-family-data-${day}.json"`);
    c.header('cache-control', 'no-store');
    return c.body(JSON.stringify(body, null, 2), 200, {
      'content-type': 'application/json; charset=utf-8',
    });
  });

  return app;
}
