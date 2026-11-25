/**
 * O2: the operator bridge's read routes for AppDeck (`docs/OPERATOR_CONSOLE.md`). Minimal fields
 * only (strict schemas in `packages/core/src/operator-schemas.ts`): never answers, a student's
 * own words, avatars, homework, prompts, tokens or push keys. Every read of a family is audited.
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
  max,
  sql,
  type SQL,
} from 'drizzle-orm';
import { z } from 'zod';
import {
  ERROR_REPORT_RETENTION_DAYS,
  OperatorFamilySearchQuerySchema,
  type OperatorFamilyDetail,
  type OperatorOverview,
  type OperatorTicket,
} from '@revisionden/core';
import {
  attempts,
  authUsers,
  devices,
  enrolments,
  errorReports,
  families,
  feedback,
  itemReports,
  operatorAuditLog,
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
import { audit } from './bridge';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const OPEN_TICKET_STATUSES = ['new', 'looking_into_it'] as const;
const TICKET_LIMIT = 200;
const CONTENT_REPORT_LIMIT = 200;

export interface OperatorReadDeps {
  version: string;
  db: Database;
  clock: Clock;
  config: AppConfig;
}

const isUuid = (id: string) => z.string().uuid().safeParse(id).success;

function badQuery(message: string): never {
  throw new ApiError(400, 'invalid_request', message);
}

/** Query parameters as a plain object (first value of each). */
function queryOf(url: string): Record<string, string> {
  return Object.fromEntries(new URL(url).searchParams.entries());
}

export function operatorReadRoutes(deps: OperatorReadDeps) {
  const { db, clock, config } = deps;
  const app = new Hono<AppEnv>();
  const now = () => clock.now();

  app.get('/overview', async (c) => {
    const at = now().getTime();
    const [[fam], [kids], [active7], [active30], [tickets], [reports], [errors]] =
      await Promise.all([
        db.select({ n: count() }).from(families),
        db.select({ n: count() }).from(students),
        db
          .select({ n: countDistinct(attempts.studentId) })
          .from(attempts)
          .where(gte(attempts.createdAt, new Date(at - 7 * DAY_MS))),
        db
          .select({ n: countDistinct(attempts.studentId) })
          .from(attempts)
          .where(gte(attempts.createdAt, new Date(at - 30 * DAY_MS))),
        db
          .select({ n: count() })
          .from(feedback)
          .where(inArray(feedback.status, [...OPEN_TICKET_STATUSES])),
        db.select({ n: count() }).from(itemReports).where(eq(itemReports.status, 'open')),
        db
          .select({ n: count() })
          .from(errorReports)
          .where(gte(errorReports.createdAt, new Date(at - DAY_MS))),
      ]);
    const overview: OperatorOverview = {
      families: fam!.n,
      students: kids!.n,
      activeStudents7d: active7!.n,
      activeStudents30d: active30!.n,
      openTickets: tickets!.n,
      openContentReports: reports!.n,
      errorReports24h: errors!.n,
      premiumFamilies: null,
      trials: null,
      freePlaces: null,
      openComplaints: null,
    };
    return c.json(overview);
  });

  app.get('/families', async (c) => {
    const parsed = OperatorFamilySearchQuerySchema.safeParse(queryOf(c.req.url));
    if (!parsed.success) badQuery('Search by an exact parent sign-in email or a family id');
    const q = parsed.data;
    let familyId: string | undefined;
    if (q.id) {
      const [row] = await db
        .select({ id: families.id })
        .from(families)
        .where(eq(families.id, q.id));
      familyId = row?.id;
    } else {
      const [row] = await db
        .select({ id: parents.familyId })
        .from(parents)
        .innerJoin(authUsers, eq(authUsers.id, parents.authUserId))
        .where(eq(sql`lower(${authUsers.email})`, q.email!));
      familyId = row?.id;
    }
    await audit(
      db,
      c.var.operator,
      {
        action: 'family.search',
        ...(familyId ? { targetType: 'family', targetId: familyId } : {}),
      },
      now(),
    );
    if (!familyId) return c.json({ families: [] });
    const [[row], [parentCount], [childCount]] = await Promise.all([
      db.select().from(families).where(eq(families.id, familyId)),
      db.select({ n: count() }).from(parents).where(eq(parents.familyId, familyId)),
      db.select({ n: count() }).from(students).where(eq(students.familyId, familyId)),
    ]);
    return c.json({
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

    const [parentRows, childRows, [tickets], [reports]] = await Promise.all([
      db
        .select({ email: authUsers.email, joinedAt: parents.createdAt })
        .from(parents)
        .innerJoin(authUsers, eq(authUsers.id, parents.authUserId))
        .where(eq(parents.familyId, id))
        .orderBy(parents.createdAt),
      db
        .select({ id: students.id, nickname: students.nickname, yearGroup: students.yearGroup })
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
    ]);
    const childIds = childRows.map((s) => s.id);
    const [subjectRows, deviceRows, lastRows] =
      childIds.length === 0
        ? [[], [], []]
        : await Promise.all([
            db
              .select({ studentId: enrolments.studentId, subjectId: enrolments.subjectId })
              .from(enrolments)
              .where(inArray(enrolments.studentId, childIds))
              .orderBy(enrolments.subjectId),
            db
              .select({ studentId: devices.studentId, n: count() })
              .from(devices)
              .where(inArray(devices.studentId, childIds))
              .groupBy(devices.studentId),
            db
              .select({ studentId: attempts.studentId, last: max(attempts.createdAt) })
              .from(attempts)
              .where(inArray(attempts.studentId, childIds))
              .groupBy(attempts.studentId),
          ]);

    const detail: OperatorFamilyDetail = {
      id: family.id,
      createdAt: family.createdAt.toISOString(),
      lastActiveAt: family.lastActiveAt.toISOString(),
      deletesAfter: monthsBefore(family.lastActiveAt, -INACTIVE_DELETE_AFTER_MONTHS).toISOString(),
      parents: parentRows.map((p) => ({ email: p.email, joinedAt: p.joinedAt.toISOString() })),
      plan: null,
      children: childRows.map((s) => {
        const last = lastRows.find((r) => r.studentId === s.id)?.last ?? null;
        return {
          id: s.id,
          nickname: s.nickname,
          yearGroup: s.yearGroup,
          subjects: subjectRows.filter((r) => r.studentId === s.id).map((r) => r.subjectId),
          linkedDevices: deviceRows.find((r) => r.studentId === s.id)?.n ?? 0,
          lastActiveAt: last ? new Date(last).toISOString() : null,
        };
      }),
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
    return c.json(detail);
  });

  const TicketQuery = z
    .object({
      status: z
        .enum(['open', 'all', 'new', 'looking_into_it', 'fixed', 'will_not_fix'])
        .default('all'),
      familyId: z.string().uuid().optional(),
    })
    .strict();

  app.get('/tickets', async (c) => {
    const parsed = TicketQuery.safeParse(queryOf(c.req.url));
    if (!parsed.success) badQuery('Unknown ticket filter');
    const { status, familyId } = parsed.data;
    const filters: SQL[] = [];
    if (status === 'open') filters.push(inArray(feedback.status, [...OPEN_TICKET_STATUSES]));
    else if (status !== 'all') filters.push(eq(feedback.status, status));
    if (familyId) filters.push(eq(feedback.familyId, familyId));
    const rows = await db
      .select()
      .from(feedback)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(feedback.createdAt))
      .limit(TICKET_LIMIT);
    const tickets: OperatorTicket[] = rows.map((r) => ({
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
    }));
    await audit(
      db,
      c.var.operator,
      { action: 'tickets.list', ...(familyId ? { targetType: 'family', targetId: familyId } : {}) },
      now(),
    );
    return c.json({ tickets });
  });

  app.get('/error-reports', async (c) => {
    const at = now().getTime();
    const raw = c.req.query('since');
    const asked = raw ? new Date(raw) : new Date(at - DAY_MS);
    if (Number.isNaN(asked.getTime())) badQuery('since must be a date and time');
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
    return c.json(groupErrorReports(rows, since));
  });

  app.get('/content-reports', async (c) => {
    const status = c.req.query('status') ?? 'open';
    if (!['open', 'no_error', 'confirmed_error', 'all'].includes(status)) {
      badQuery('Unknown content report filter');
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
    return c.json({
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
      before: z.string().datetime().optional(),
      limit: z.coerce.number().int().min(1).max(500).default(100),
    })
    .strict();

  app.get('/audit-log', async (c) => {
    const parsed = AuditQuery.safeParse(queryOf(c.req.url));
    if (!parsed.success) badQuery('Unknown audit log filter');
    const q = parsed.data;
    const filters: SQL[] = [];
    if (q.targetType) filters.push(eq(operatorAuditLog.targetType, q.targetType));
    if (q.targetId) filters.push(eq(operatorAuditLog.targetId, q.targetId));
    if (q.before) filters.push(lt(operatorAuditLog.createdAt, new Date(q.before)));
    const rows = await db
      .select()
      .from(operatorAuditLog)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(operatorAuditLog.createdAt))
      .limit(q.limit + 1);
    const page = rows.slice(0, q.limit);
    return c.json({
      entries: page.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
      nextBefore: rows.length > q.limit ? page[page.length - 1]!.createdAt.toISOString() : null,
    });
  });

  app.get('/status', async (c) => {
    const at = now().getTime();
    const [[hour], [day]] = await Promise.all([
      db
        .select({ n: count() })
        .from(errorReports)
        .where(gte(errorReports.createdAt, new Date(at - HOUR_MS))),
      db
        .select({ n: count() })
        .from(errorReports)
        .where(gte(errorReports.createdAt, new Date(at - DAY_MS))),
    ]);
    return c.json({
      environment: config.environment,
      version: deps.version,
      database: 'ok',
      errorReportsLastHour: hour!.n,
      errorReports24h: day!.n,
    });
  });

  return app;
}
