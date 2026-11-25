import { Hono } from 'hono';
import { desc, gte, lt } from 'drizzle-orm';
import {
  ERROR_REPORT_RETENTION_DAYS,
  ErrorReportSchema,
  type ErrorReportSummary,
} from '@revisionden/core';
import { errorReports, type Database } from '@revisionden/db';
import type { AppEnv } from '../context';
import type { AppConfig } from '../env';
import { ApiError, notFound, type ErrorLog } from '../errors';
import { readJson } from '../http';
import type { Clock } from '../rate-limit';

const DAY_MS = 24 * 60 * 60 * 1000;
const REFS_PER_GROUP = 20;

export interface ErrorReportDeps {
  db: Database;
  config: AppConfig;
  clock: Clock;
  errorLog?: ErrorLog;
}

/**
 * `POST /v1/error-reports`: the "Send error report" button. Public (errors happen signed out
 * too) and rate limited with the sign-in limiter. Stores the anonymous report once per
 * reference code and logs a line with the same code, so it matches the API's own error line.
 */
export function errorReportRoutes({ db, errorLog }: ErrorReportDeps) {
  const app = new Hono<AppEnv>();
  const log = errorLog ?? ((line) => console.warn(JSON.stringify(line)));
  app.post('/', async (c) => {
    const report = await readJson(c, ErrorReportSchema);
    await db
      .insert(errorReports)
      .values({
        ref: report.ref,
        screen: report.screen,
        apiPath: report.apiPath ?? null,
        status: report.status ?? null,
        build: report.build,
        browser: report.browser,
        online: report.online,
        reportedAt: new Date(report.at),
      })
      .onConflictDoNothing({ target: errorReports.ref });
    log({
      source: 'error-report',
      ref: report.ref,
      screen: report.screen,
      apiPath: report.apiPath,
      status: report.status,
    });
    return c.json({ received: true }, 202);
  });
  return app;
}

type ReportRow = Pick<
  typeof errorReports.$inferSelect,
  'ref' | 'screen' | 'apiPath' | 'status' | 'build' | 'createdAt'
>;

/** Groups reports by screen, API path and status: most reports first, then the latest. */
export function groupErrorReports(rows: ReportRow[], since: Date): ErrorReportSummary {
  const groups = new Map<string, ReportRow[]>();
  for (const row of rows) {
    const key = JSON.stringify([row.screen, row.apiPath, row.status]);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const summary = [...groups.values()].map((list) => {
    const newest = [...list].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const first = newest[newest.length - 1]!;
    const last = newest[0]!;
    return {
      screen: last.screen,
      apiPath: last.apiPath,
      status: last.status,
      count: list.length,
      refs: newest.slice(0, REFS_PER_GROUP).map((r) => r.ref),
      builds: [...new Set(newest.map((r) => r.build))],
      firstSeen: first.createdAt.toISOString(),
      lastSeen: last.createdAt.toISOString(),
    };
  });
  summary.sort((a, b) => b.count - a.count || b.lastSeen.localeCompare(a.lastSeen));
  return { since: since.toISOString(), total: rows.length, groups: summary };
}

/**
 * `GET /v1/admin/error-reports?since=…` for the operator (OPERATOR_EMAILS; 404 for anyone
 * else). `since` defaults to 24 hours ago and goes back at most 90 days.
 */
export function adminErrorReportRoutes({ db, config, clock }: ErrorReportDeps) {
  const app = new Hono<AppEnv>();
  app.get('/error-reports', async (c) => {
    if (!config.operatorEmails.includes(c.var.parentEmail.toLowerCase())) throw notFound();
    const now = clock.now().getTime();
    const raw = c.req.query('since');
    const asked = raw ? new Date(raw) : new Date(now - DAY_MS);
    if (Number.isNaN(asked.getTime())) {
      throw new ApiError(400, 'invalid_request', 'since must be a date and time');
    }
    const since = new Date(Math.max(asked.getTime(), now - ERROR_REPORT_RETENTION_DAYS * DAY_MS));
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
  return app;
}

/** Deletes error reports older than 90 days (scheduled clean-up). */
export async function deleteExpiredErrorReports(db: Database, now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - ERROR_REPORT_RETENTION_DAYS * DAY_MS);
  const deleted = await db
    .delete(errorReports)
    .where(lt(errorReports.createdAt, cutoff))
    .returning({ id: errorReports.id });
  return deleted.length;
}
