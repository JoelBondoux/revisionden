/**
 * O2: the operator bridge's read routes for AppDeck (`docs/OPERATOR_CONSOLE.md`), on the paths
 * AppDeck's client uses. Minimal fields only (strict schemas in
 * `packages/core/src/operator-schemas.ts`): never answers, a student's own words, avatars,
 * homework, prompts, tokens or push keys. Every read of a family is audited.
 */
import { Hono } from 'hono';
import {
  and,
  count,
  countDistinct,
  desc,
  eq,
  gte,
  inArray,
  lt,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { z } from 'zod';
import {
  ERROR_REPORT_RETENTION_DAYS,
  OperatorFamilySearchSchema,
  type OperatorFamilyDetail,
  type OperatorOverview,
  type OperatorTicket,
} from '@revisionden/core';
import {
  attempts,
  authUsers,
  errorReports,
  families,
  feedback,
  feedbackReplies,
  itemReports,
  operatorAuditLog,
  operatorNotes,
  parents,
  quarantinedItems,
  students,
  type Database,
} from '@revisionden/db';
import type { AppEnv } from '../context';
import type { AppConfig } from '../env';
import { ApiError, notFound } from '../errors';
import { groupErrorReports } from '../feedback/error-reports';
import {
  INACTIVE_DELETE_AFTER_MONTHS,
  INACTIVE_WARNING_AFTER_MONTHS,
  monthsBefore,
} from '../cleanup';
import type { Clock } from '../rate-limit';
import { audit, ok } from './bridge';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const OPEN_TICKET_STATUSES = ['new', 'looking_into_it'] as const;
const TICKET_LIMIT = 200;
const CONTENT_REPORT_LIMIT = 200;

/** POST routes under the bridge that only read: their request ids are not replayed or stored. */
export const OPERATOR_READ_POSTS = ['/families/search'] as const;

export interface OperatorReadDeps {
  version: string;
  db: Database;
  clock: Clock;
  config: AppConfig;
}

const isUuid = (id: string) => z.string().uuid().safeParse(id).success;

function badRequest(message: string): never {
  throw new ApiError(400, 'invalid_request', message);
}

/** Query parameters as a plain object (first value of each); empty ones are left out. */
function queryOf(url: string): Record<string, string> {
  return Object.fromEntries([...new URL(url).searchParams.entries()].filter(([, v]) => v !== ''));
}

type FeedbackRow = typeof feedback.$inferSelect;

function toTicket(r: FeedbackRow): OperatorTicket {
  return {
    id: r.id,
    familyId: r.familyId,
    kind: r.kind,
    status: r.status,
    senderRole: r.senderRole,
    // A student's own words never leave RevisionDen.
    text: r.senderRole === 'parent' ? r.text : null,
    device: r.device ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    closedAt: r.closedAt?.toISOString() ?? null,
    confirmedBug: r.outcome === 'confirmed',
    duplicateOf: r.duplicateOf ?? null,
  };
}

export function operatorReadRoutes(deps: OperatorReadDeps) {
  const { db, clock, config } = deps;
  const app = new Hono<AppEnv>();
  const now = () => clock.now();
  const countErrorReportsSince = async (ms: number) => {
    const [row] = await db
      .select({ n: count() })
      .from(errorReports)
      .where(gte(errorReports.createdAt, new Date(now().getTime() - ms)));
    return row!.n;
  };

  app.get('/health', async (c) =>
    ok(c, {
      status: 'ok',
      environment: config.environment,
      version: deps.version,
      operator: { email: c.var.operator.email, role: c.var.operator.role },
      errorReportsLastHour: await countErrorReportsSince(HOUR_MS),
      errorReports24h: await countErrorReportsSince(DAY_MS),
    }),
  );

  app.get('/overview', async (c) => {
    const at = now().getTime();
    const activeSince = (days: number) =>
      db
        .select({ n: countDistinct(attempts.studentId) })
        .from(attempts)
        .where(gte(attempts.createdAt, new Date(at - days * DAY_MS)));
    const [[fam], [kids], [active7], [active30], [tickets], [reports], errors24h] =
      await Promise.all([
        db.select({ n: count() }).from(families),
        db.select({ n: count() }).from(students),
        activeSince(7),
        activeSince(30),
        db
          .select({ n: count() })
          .from(feedback)
          .where(inArray(feedback.status, [...OPEN_TICKET_STATUSES])),
        db.select({ n: count() }).from(itemReports).where(eq(itemReports.status, 'open')),
        countErrorReportsSince(DAY_MS),
      ]);
    const overview: OperatorOverview = {
      families: fam!.n,
      students: kids!.n,
      activeStudents7d: active7!.n,
      activeStudents30d: active30!.n,
      openTickets: tickets!.n,
      openContentReports: reports!.n,
      errorReports24h: errors24h,
      premiumFamilies: null,
      trials: null,
      freePlaces: null,
      openComplaints: null,
    };
    return ok(c, overview);
  });

  // A read sent as POST, so the email stays out of URLs and logs (see OPERATOR_READ_POSTS).
  app.post('/families/search', async (c) => {
    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch {
      badRequest('The request body must be JSON');
    }
    const parsed = OperatorFamilySearchSchema.safeParse(raw);
    if (!parsed.success) badRequest('Search by an exact parent sign-in email or a family id');
    const q = parsed.data;
    const [found] = q.familyId
      ? await db.select({ id: families.id }).from(families).where(eq(families.id, q.familyId))
      : await db
          .select({ id: parents.familyId })
          .from(parents)
          .innerJoin(authUsers, eq(authUsers.id, parents.authUserId))
          .where(eq(sql`lower(${authUsers.email})`, q.email!));
    const familyId = found?.id;
    await audit(
      db,
      c.var.operator,
      {
        action: 'family.search',
        ...(familyId ? { targetType: 'family', targetId: familyId } : {}),
      },
      now(),
    );
    if (!familyId) return ok(c, { families: [] });
    const [[row], [parentCount], [childCount]] = await Promise.all([
      db.select().from(families).where(eq(families.id, familyId)),
      db.select({ n: count() }).from(parents).where(eq(parents.familyId, familyId)),
      db.select({ n: count() }).from(students).where(eq(students.familyId, familyId)),
    ]);
    return ok(c, {
      families: [
        {
          id: row!.id,
          createdAt: row!.createdAt.toISOString(),
          lastActiveAt: row!.lastActiveAt.toISOString(),
          parentCount: parentCount!.n,
          childCount: childCount!.n,
        },
      ],
    });
  });

  app.get('/families/:id', async (c) => {
    const id = c.req.param('id');
    if (!isUuid(id)) throw notFound('Family not found');
    const [family] = await db.select().from(families).where(eq(families.id, id));
    if (!family) throw notFound('Family not found');

    const [parentRows, childRows, [tickets], [reports], noteRows] = await Promise.all([
      db
        .select({ email: authUsers.email, joinedAt: parents.createdAt })
        .from(parents)
        .innerJoin(authUsers, eq(authUsers.id, parents.authUserId))
        .where(eq(parents.familyId, id))
        .orderBy(parents.createdAt),
      db
        .select({ nickname: students.nickname, yearGroup: students.yearGroup })
        .from(students)
        .where(eq(students.familyId, id))
        .orderBy(students.createdAt),
      db
        .select({ n: count() })
        .from(feedback)
        .where(and(eq(feedback.familyId, id), inArray(feedback.status, [...OPEN_TICKET_STATUSES]))),
      db
        .select({ n: count() })
        .from(itemReports)
        .where(and(eq(itemReports.familyId, id), eq(itemReports.status, 'open'))),
      db
        .select()
        .from(operatorNotes)
        .where(eq(operatorNotes.familyId, id))
        .orderBy(desc(operatorNotes.createdAt))
        .limit(200),
    ]);

    const detail: OperatorFamilyDetail = {
      id: family.id,
      createdAt: family.createdAt.toISOString(),
      lastActiveAt: family.lastActiveAt.toISOString(),
      deletesAfter: monthsBefore(family.lastActiveAt, -INACTIVE_DELETE_AFTER_MONTHS).toISOString(),
      parents: parentRows.map((p) => ({ email: p.email, joinedAt: p.joinedAt.toISOString() })),
      plan: null,
      // Only a child's nickname and year group reach AppDeck.
      children: childRows,
      notes: noteRows.map((n) => ({
        id: n.id,
        text: n.text,
        author: n.authorEmail,
        createdAt: n.createdAt.toISOString(),
      })),
      flags: {
        inactivityWarning:
          family.lastActiveAt.getTime() <=
          monthsBefore(now(), INACTIVE_WARNING_AFTER_MONTHS).getTime(),
        openTickets: tickets!.n,
        openContentReports: reports!.n,
      },
    };
    await audit(
      db,
      c.var.operator,
      { action: 'family.view', targetType: 'family', targetId: id },
      now(),
    );
    return ok(c, detail);
  });

  const TicketQuery = z
    .object({
      status: z
        .enum(['open', 'all', 'new', 'looking_into_it', 'fixed', 'will_not_fix'])
        .default('all'),
      kind: z.enum(['bug', 'idea', 'confusing', 'other']).optional(),
      familyId: z.string().uuid().optional(),
    })
    .strict();

  app.get('/tickets', async (c) => {
    const parsed = TicketQuery.safeParse(queryOf(c.req.url));
    if (!parsed.success) badRequest('Unknown ticket filter');
    const { status, kind, familyId } = parsed.data;
    const filters: SQL[] = [];
    if (status === 'open') filters.push(inArray(feedback.status, [...OPEN_TICKET_STATUSES]));
    else if (status !== 'all') filters.push(eq(feedback.status, status));
    if (kind) filters.push(eq(feedback.kind, kind));
    if (familyId) filters.push(eq(feedback.familyId, familyId));
    const rows = await db
      .select()
      .from(feedback)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(feedback.createdAt))
      .limit(TICKET_LIMIT);
    await audit(
      db,
      c.var.operator,
      {
        action: 'tickets.list',
        ...(familyId ? { targetType: 'family', targetId: familyId } : {}),
      },
      now(),
    );
    return ok(c, { tickets: rows.map(toTicket) });
  });

  app.get('/tickets/:id', async (c) => {
    const id = c.req.param('id');
    if (!isUuid(id)) throw notFound('Ticket not found');
    const [row] = await db.select().from(feedback).where(eq(feedback.id, id));
    if (!row) throw notFound('Ticket not found');
    await audit(
      db,
      c.var.operator,
      { action: 'ticket.view', targetType: 'family', targetId: row.familyId },
      now(),
    );
    const replies = await db
      .select()
      .from(feedbackReplies)
      .where(eq(feedbackReplies.feedbackId, id))
      .orderBy(feedbackReplies.createdAt);
    const ticket = toTicket(row);
    return ok(c, {
      ...ticket,
      messages: [
        // The family's own words appear only when a parent sent them.
        ...(ticket.text !== null
          ? [
              {
                id: row.id,
                from: 'family' as const,
                body: ticket.text,
                createdAt: ticket.createdAt,
              },
            ]
          : []),
        ...replies.map((m) => ({
          id: m.id,
          from: 'operator' as const,
          body: m.body,
          createdAt: m.createdAt.toISOString(),
        })),
      ],
    });
  });

  app.get('/error-reports', async (c) => {
    const at = now().getTime();
    const raw = c.req.query('since');
    const asked = raw ? new Date(raw) : new Date(at - DAY_MS);
    if (Number.isNaN(asked.getTime())) badRequest('since must be a date and time');
    const since = new Date(Math.max(asked.getTime(), at - ERROR_REPORT_RETENTION_DAYS * DAY_MS));
    const rows = await db
      .select({
        ref: errorReports.ref,
        screen: errorReports.screen,
        apiPath: errorReports.apiPath,
        status: errorReports.status,
        build: errorReports.build,
        createdAt: errorReports.createdAt,
      })
      .from(errorReports)
      .where(gte(errorReports.createdAt, since))
      .orderBy(desc(errorReports.createdAt));
    return ok(c, groupErrorReports(rows, since));
  });

  app.get('/content-reports', async (c) => {
    const status = c.req.query('status') || 'open';
    if (!['open', 'no_error', 'confirmed_error', 'all'].includes(status)) {
      badRequest('Unknown content report filter');
    }
    const rows = await db
      .select({
        id: itemReports.id,
        itemId: itemReports.itemId,
        itemVersion: itemReports.itemVersion,
        reason: itemReports.reason,
        reportedBy: itemReports.reportedBy,
        status: itemReports.status,
        createdAt: itemReports.createdAt,
        decidedAt: itemReports.decidedAt,
        quarantinedSince: quarantinedItems.since,
      })
      .from(itemReports)
      .leftJoin(quarantinedItems, eq(quarantinedItems.itemId, itemReports.itemId))
      .where(
        status === 'all'
          ? undefined
          : eq(itemReports.status, status as 'open' | 'no_error' | 'confirmed_error'),
      )
      .orderBy(desc(itemReports.createdAt))
      .limit(CONTENT_REPORT_LIMIT);
    return ok(c, {
      reviewQueueUrl: `${config.webOrigin}/review`,
      reports: rows.map((r) => ({
        id: r.id,
        itemId: r.itemId,
        itemVersion: r.itemVersion,
        reason: r.reason,
        reportedBy: r.reportedBy,
        status: r.status,
        quarantined: r.quarantinedSince !== null,
        createdAt: r.createdAt.toISOString(),
        decidedAt: r.decidedAt?.toISOString() ?? null,
      })),
    });
  });

  const AuditQuery = z
    .object({
      targetType: z.string().min(1).max(40).optional(),
      targetId: z.string().min(1).max(128).optional(),
      // `nextBefore` from the previous page: `<time>~<id>` (a plain time is accepted too).
      before: z
        .string()
        .regex(/^[^~]+(~[0-9a-f-]{36})?$/)
        .refine((v) => !Number.isNaN(new Date(v.split('~')[0]!).getTime()))
        .optional(),
      limit: z.coerce.number().int().min(1).max(500).default(100),
    })
    .strict();

  app.get('/audit', async (c) => {
    const parsed = AuditQuery.safeParse(queryOf(c.req.url));
    if (!parsed.success) badRequest('Unknown audit log filter');
    const q = parsed.data;
    const filters: SQL[] = [];
    if (q.targetType) filters.push(eq(operatorAuditLog.targetType, q.targetType));
    if (q.targetId) filters.push(eq(operatorAuditLog.targetId, q.targetId));
    if (q.before) {
      const [time, id] = q.before.split('~');
      const at = new Date(time!);
      filters.push(
        id
          ? or(
              lt(operatorAuditLog.createdAt, at),
              and(eq(operatorAuditLog.createdAt, at), lt(operatorAuditLog.id, id)),
            )!
          : lt(operatorAuditLog.createdAt, at),
      );
    }
    const rows = await db
      .select()
      .from(operatorAuditLog)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(operatorAuditLog.createdAt), desc(operatorAuditLog.id))
      .limit(q.limit + 1);
    const page = rows.slice(0, q.limit);
    return ok(c, {
      entries: page.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
      // Time and id together, so entries that share a time are never skipped.
      nextBefore:
        rows.length > q.limit
          ? `${page[page.length - 1]!.createdAt.toISOString()}~${page[page.length - 1]!.id}`
          : null,
    });
  });

  return app;
}
