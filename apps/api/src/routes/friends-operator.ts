/**
 * Friend reports in AppDeck (FL PR 4, docs/FRIENDS_LEAGUE.md section 7; owner 2026-11-26: support
 * sees reports so repeated abuse can be acted on). Support sees only the two nicknames, the
 * reported child's avatar code (so a bad nickname or avatar can be changed), the fixed reason and
 * the dates: never ids, families, free text or anything else. Every read and close is audited.
 *
 * - GET friend-reports: newest 500.
 * - POST friend-reports/{id}/close: marks it dealt with; it is then deleted 12 months later.
 */
import { Hono } from 'hono';
import { desc, eq, inArray } from 'drizzle-orm';
import { friendReports, students, type Database } from '@revisionden/db';
import type { AppEnv } from '../context';
import { ApiError, notFound } from '../errors';
import { audit, ok } from '../operator/bridge';
import type { Clock } from '../rate-limit';
import { isId } from '../validation';

const REPORT_LIMIT = 500;

export function operatorFriendReportRoutes({ db, clock }: { db: Database; clock: Clock }) {
  const app = new Hono<AppEnv>();

  app.get('/friend-reports', async (c) => {
    const rows = await db
      .select()
      .from(friendReports)
      .orderBy(desc(friendReports.createdAt))
      .limit(REPORT_LIMIT);
    const ids = [...new Set(rows.flatMap((r) => [r.reporterId, r.reportedId]))];
    const people =
      ids.length === 0
        ? []
        : await db
            .select({
              id: students.id,
              nickname: students.nickname,
              avatarCode: students.avatarCode,
            })
            .from(students)
            .where(inArray(students.id, ids));
    const byId = new Map(people.map((p) => [p.id, p]));
    await audit(db, c.var.operator, { action: 'friend_reports.list' }, clock.now());
    return ok(c, {
      reports: rows.map((r) => ({
        id: r.id,
        reason: r.reason,
        reporter: byId.get(r.reporterId)?.nickname ?? null,
        reported: byId.get(r.reportedId)?.nickname ?? null,
        reportedAvatarCode: byId.get(r.reportedId)?.avatarCode ?? null,
        createdAt: r.createdAt.toISOString(),
        closedAt: r.closedAt?.toISOString() ?? null,
      })),
    });
  });

  app.post('/friend-reports/:id/close', async (c) => {
    const id = c.req.param('id');
    if (!isId(id)) throw notFound('Report not found');
    const [row] = await db.select().from(friendReports).where(eq(friendReports.id, id));
    if (!row) throw notFound('Report not found');
    if (row.closedAt) throw new ApiError(409, 'report_closed', 'This report is already closed');
    const now = clock.now();
    await db.update(friendReports).set({ closedAt: now }).where(eq(friendReports.id, id));
    await audit(
      db,
      c.var.operator,
      { action: 'friend_report.close', targetType: 'friend_report', targetId: id },
      now,
    );
    return ok(c, { closed: true });
  });

  return app;
}
