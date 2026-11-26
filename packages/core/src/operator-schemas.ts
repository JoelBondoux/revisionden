/**
 * Answers of the operator bridge's read routes (`docs/OPERATOR_CONSOLE.md`, O2). Strict, so a
 * field nobody agreed to (an answer, an avatar, a child's own words) fails the API's tests
 * instead of reaching AppDeck. `null` where a figure belongs to a workstream not built yet.
 */
import { z } from 'zod';

const isoDate = z.string().datetime();
const uuid = z.string().uuid();

export const OperatorOverviewSchema = z
  .object({
    families: z.number().int().nonnegative(),
    students: z.number().int().nonnegative(),
    /** Students who answered at least one question in the last 7 and 30 days. */
    activeStudents7d: z.number().int().nonnegative(),
    activeStudents30d: z.number().int().nonnegative(),
    openTickets: z.number().int().nonnegative(),
    openContentReports: z.number().int().nonnegative(),
    errorReports24h: z.number().int().nonnegative(),
    /** Payments (workstream $) are not built yet. */
    premiumFamilies: z.null(),
    trials: z.null(),
    freePlaces: z.null(),
    /** Complaints not yet resolved (O4). */
    openComplaints: z.number().int().nonnegative(),
  })
  .strict();
export type OperatorOverview = z.infer<typeof OperatorOverviewSchema>;

/** `POST families/search` body: exactly one of an exact parent sign-in email or a family id. */
export const OperatorFamilySearchSchema = z
  .object({
    email: z.string().trim().toLowerCase().pipe(z.string().email().max(254)).optional(),
    familyId: uuid.optional(),
  })
  .strict()
  .refine((q) => (q.email === undefined) !== (q.familyId === undefined), {
    message: 'Search by email or by family id, not both',
  });

/** A tag as shown on a family (O6). */
export const OperatorTagRefSchema = z
  .object({ id: uuid, name: z.string(), colour: z.string() })
  .strict();

export const OperatorFamilySummarySchema = z
  .object({
    id: uuid,
    createdAt: isoDate,
    lastActiveAt: isoDate,
    parentCount: z.number().int().nonnegative(),
    childCount: z.number().int().nonnegative(),
    /** Live (not retired) tags on the family (O6). */
    tags: z.array(OperatorTagRefSchema),
  })
  .strict();

export const OperatorFamilySearchResultSchema = z
  .object({ families: z.array(OperatorFamilySummarySchema).max(1) })
  .strict();

/** AppDeck gets only a child's nickname and year group. */
export const OperatorChildSchema = z
  .object({ nickname: z.string(), yearGroup: z.number().int() })
  .strict();

export const OperatorFamilyDetailSchema = z
  .object({
    id: uuid,
    createdAt: isoDate,
    lastActiveAt: isoDate,
    /** When the account is deleted if nobody uses it (12 months after last use). */
    deletesAfter: isoDate,
    parents: z.array(z.object({ email: z.string(), joinedAt: isoDate }).strict()),
    /** Plan and trial come with payments (workstream $). */
    plan: z.null(),
    children: z.array(OperatorChildSchema),
    /** Live (not retired) tags on the family (O6). */
    tags: z.array(OperatorTagRefSchema),
    /** Internal notes by operators, newest first; never shown to the family. */
    notes: z.array(
      z.object({ id: uuid, text: z.string(), author: z.string(), createdAt: isoDate }).strict(),
    ),
    flags: z
      .object({
        /** The family has not been used for 11 months or more. */
        inactivityWarning: z.boolean(),
        openTickets: z.number().int().nonnegative(),
        openContentReports: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();
export type OperatorFamilyDetail = z.infer<typeof OperatorFamilyDetailSchema>;

const ticketDevice = z
  .object({
    appVersion: z.string().optional(),
    route: z.string().optional(),
    browserFamily: z.string().optional(),
    screenSize: z.string().optional(),
    online: z.boolean().optional(),
    lastProblem: z.string().optional(),
  })
  .strict();

const ticketFields = z
  .object({
    id: uuid,
    familyId: uuid,
    kind: z.enum(['bug', 'idea', 'confusing', 'other']),
    status: z.enum(['new', 'looking_into_it', 'fixed', 'will_not_fix']),
    senderRole: z.enum(['student', 'parent']),
    text: z.string().nullable(),
    device: ticketDevice.nullable(),
    createdAt: isoDate,
    updatedAt: isoDate,
    closedAt: isoDate.nullable(),
    /** Confirmed as a bug (Bug Hunter); a duplicate has `duplicateOf` instead. */
    confirmedBug: z.boolean(),
    duplicateOf: uuid.nullable(),
  })
  .strict();

const noStudentText = <T extends { senderRole: string; text: string | null }>(t: T) =>
  t.senderRole === 'parent' || t.text === null;
const noStudentTextMessage = {
  message: "A student's ticket text is never sent to AppDeck",
  path: ['text'],
};

/** Feedback as a ticket. A student's own words are never sent: `text` is null for them. */
export const OperatorTicketSchema = ticketFields.refine(noStudentText, noStudentTextMessage);
export type OperatorTicket = z.infer<typeof OperatorTicketSchema>;

export const OperatorTicketMessageSchema = z
  .object({
    id: uuid,
    /** `family`: a parent's own ticket text (never a student's); `operator`: a support reply. */
    from: z.enum(['family', 'operator']),
    body: z.string(),
    createdAt: isoDate,
  })
  .strict();

/** `GET tickets/{id}`: the ticket and its conversation. */
export const OperatorTicketDetailSchema = ticketFields
  .extend({ messages: z.array(OperatorTicketMessageSchema) })
  .strict()
  .refine(noStudentText, noStudentTextMessage);

export const OperatorTicketListSchema = z
  .object({ tickets: z.array(OperatorTicketSchema) })
  .strict();

export const OperatorContentReportSchema = z
  .object({
    id: uuid,
    itemId: z.string(),
    itemVersion: z.number().int(),
    reason: z.string(),
    reportedBy: z.enum(['student', 'parent']),
    status: z.enum(['open', 'no_error', 'confirmed_error']),
    /** The question is hidden from students until a reviewer decides. */
    quarantined: z.boolean(),
    createdAt: isoDate,
    decidedAt: isoDate.nullable(),
  })
  .strict();

export const OperatorContentReportListSchema = z
  .object({
    /** The review queue in the RevisionDen web app, for the "Open review queue" link. */
    reviewQueueUrl: z.string().url(),
    reports: z.array(OperatorContentReportSchema),
  })
  .strict();

export const OperatorAuditEntrySchema = z
  .object({
    id: uuid,
    operatorEmail: z.string(),
    operatorRole: z.enum(['agent', 'manager']),
    action: z.string(),
    targetType: z.string().nullable(),
    targetId: z.string().nullable(),
    requestId: z.string(),
    outcome: z.enum(['ok', 'denied']),
    createdAt: isoDate,
  })
  .strict();

export const OperatorAuditLogSchema = z
  .object({
    entries: z.array(OperatorAuditEntrySchema),
    /** Pass as `before` for the next (older) page (`<time>~<id>`); null on the last page. */
    nextBefore: z.string().nullable(),
  })
  .strict();

/** `GET health`: connection check, build and error-report rate for the environment. */
export const OperatorHealthSchema = z
  .object({
    status: z.literal('ok'),
    environment: z.enum(['development', 'staging', 'production']),
    version: z.string(),
    operator: z.object({ email: z.string(), role: z.enum(['agent', 'manager']) }).strict(),
    errorReportsLastHour: z.number().int().nonnegative(),
    errorReports24h: z.number().int().nonnegative(),
  })
  .strict();

/** Change bodies (O3). */
export const OperatorNoteBodySchema = z
  .object({ text: z.string().trim().min(1).max(2000) })
  .strict();
export const OperatorReplyBodySchema = z
  .object({ text: z.string().trim().min(1).max(5000) })
  .strict();
export const OperatorTicketStatusBodySchema = z
  .object({ status: z.enum(['new', 'looking_into_it', 'fixed', 'will_not_fix']) })
  .strict();
export const OperatorDuplicateBodySchema = z.object({ duplicateOf: uuid }).strict();

/** O3b: an export or deletion request a family sent by email. */
export const OperatorDataRequestSchema = z
  .object({
    id: uuid,
    familyId: uuid,
    kind: z.enum(['export', 'deletion']),
    receivedAt: isoDate,
    /** One calendar month after it arrived (UK GDPR). */
    dueAt: isoDate,
    status: z.enum(['open', 'handled']),
    handledAt: isoDate.nullable(),
  })
  .strict();

export const OperatorDataRequestListSchema = z
  .object({ requests: z.array(OperatorDataRequestSchema) })
  .strict();

/** `POST data-requests`: log an emailed request; `receivedOn` is the day it arrived. */
export const OperatorDataRequestBodySchema = z
  .object({
    familyId: uuid,
    kind: z.enum(['export', 'deletion']),
    receivedOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((d) => !Number.isNaN(new Date(`${d}T00:00:00Z`).getTime()), 'Not a date'),
  })
  .strict();

/**
 * The statutory deadline for a data request: the same day one calendar month later, or the last
 * day of that month when it is shorter (31 January is due 28 February).
 */
export function dataRequestDueAt(receivedAt: Date): Date {
  const due = new Date(receivedAt);
  const day = due.getUTCDate();
  due.setUTCDate(1);
  due.setUTCMonth(due.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth() + 1, 0)).getUTCDate();
  due.setUTCDate(Math.min(day, lastDay));
  return due;
}

/** O4: a formal complaint as AppDeck sees it. */
export const OperatorComplaintSchema = z
  .object({
    id: uuid,
    familyId: uuid.nullable(),
    status: z.enum(['new', 'acknowledged', 'resolved', 'escalated']),
    channel: z.enum(['app', 'email']),
    summary: z.string(),
    aboutPersonalData: z.boolean(),
    receivedAt: isoDate,
    acknowledgeDueAt: isoDate,
    resolveDueAt: isoDate,
    acknowledgedAt: isoDate.nullable(),
    resolvedAt: isoDate.nullable(),
    /** From when it can be escalated: 5 working days after acknowledgement (null before). */
    escalationFrom: isoDate.nullable(),
    /** Past the date we aim to acknowledge, or to resolve, by and not done yet. */
    acknowledgeOverdue: z.boolean(),
    resolveOverdue: z.boolean(),
    outcome: z.string().nullable(),
    messages: z.array(OperatorTicketMessageSchema),
  })
  .strict();

export const OperatorComplaintListSchema = z
  .object({ complaints: z.array(OperatorComplaintSchema) })
  .strict();

/** `POST complaints`: log a complaint that arrived by email. */
export const OperatorComplaintLogBodySchema = z
  .object({
    familyId: uuid.nullable(),
    summary: z.string().trim().min(3).max(500),
    aboutPersonalData: z.boolean(),
    receivedOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((d) => !Number.isNaN(new Date(`${d}T00:00:00Z`).getTime()), 'Not a date'),
  })
  .strict();

export const OperatorComplaintOutcomeBodySchema = z
  .object({ outcome: z.string().trim().min(3).max(2000) })
  .strict();
