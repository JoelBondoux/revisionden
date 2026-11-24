import { Hono } from 'hono';
import { and, eq, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  itemReports,
  items,
  quarantinedItems,
  REPORT_REASONS,
  type Database,
} from '@revisionden/db';
import type { AppEnv } from '../context';
import { ApiError, notFound } from '../errors';
import { readJson } from '../http';

/** Content ids, as in content/ (lowercase words joined by hyphens). */
export const ContentIdSchema = z
  .string()
  .max(120)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'must be a content id');

// Only a reason: no free text, so a report can never carry personal data. The version comes
// from the item when it is in the database.
const ReportSchema = z
  .object({ itemVersion: z.number().int().min(1).optional(), reason: z.enum(REPORT_REASONS) })
  .strict();

/** Content ids of every item hidden from students. */
export async function quarantinedItemIds(db: Database): Promise<Set<string>> {
  const rows = await db.select({ itemId: quarantinedItems.itemId }).from(quarantinedItems);
  return new Set(rows.map((r) => r.itemId));
}

export async function isQuarantined(db: Database, itemId: string): Promise<boolean> {
  const [row] = await db
    .select({ itemId: quarantinedItems.itemId })
    .from(quarantinedItems)
    .where(eq(quarantinedItems.itemId, itemId));
  return Boolean(row);
}

/**
 * Hides an item now: records it in quarantined_items and sets its status in items to
 * 'quarantined', which the learning loop's content gate never serves. A stronger cause
 * (confirmed error) replaces a weaker one (report).
 */
export async function quarantine(
  db: Database,
  itemId: string,
  itemVersion: number,
  cause: 'report' | 'confirmed_error' | 'batch_failed',
) {
  const [row] = await db
    .select({ status: items.status })
    .from(items)
    .where(eq(items.contentId, itemId));
  const values = {
    itemId,
    itemVersion,
    cause,
    previousStatus: row && row.status !== 'quarantined' ? row.status : null,
  };
  if (cause === 'report') {
    await db.insert(quarantinedItems).values(values).onConflictDoNothing();
  } else {
    await db
      .insert(quarantinedItems)
      .values(values)
      .onConflictDoUpdate({ target: quarantinedItems.itemId, set: { cause, itemVersion } });
  }
  await db.update(items).set({ status: 'quarantined' }).where(eq(items.contentId, itemId));
}

/** Releases an item hidden only by reports once none is left open, restoring its status. */
export async function releaseIfNoOpenReports(db: Database, itemId: string, exceptReportId: string) {
  const open = await db
    .select({ id: itemReports.id })
    .from(itemReports)
    .where(
      and(
        eq(itemReports.itemId, itemId),
        eq(itemReports.status, 'open'),
        ne(itemReports.id, exceptReportId),
      ),
    );
  if (open.length > 0) return;
  const released = await db
    .delete(quarantinedItems)
    .where(and(eq(quarantinedItems.itemId, itemId), eq(quarantinedItems.cause, 'report')))
    .returning({ previousStatus: quarantinedItems.previousStatus });
  if (released.length === 0) return;
  await db
    .update(items)
    // Unknown previous status: 'draft', which is never served in production.
    .set({ status: released[0]!.previousStatus ?? 'draft' })
    .where(and(eq(items.contentId, itemId), eq(items.status, 'quarantined')));
}

/**
 * Run after every content sync (which copies statuses from content/): keeps quarantined items
 * hidden, and lifts a confirmed-error quarantine once a newer version of the item has arrived
 * (a fixed version has been through the pipeline again).
 */
export async function reapplyQuarantine(db: Database) {
  await db.execute(sql`
    delete from ${quarantinedItems} q using ${items} i
    where i.content_id = q.item_id and q.cause = 'confirmed_error' and i.version > q.item_version`);
  await db.execute(sql`
    update ${quarantinedItems} q set previous_status = i.status from ${items} i
    where i.content_id = q.item_id and i.status <> 'quarantined'`);
  await db.execute(sql`
    update ${items} set status = 'quarantined'
    where content_id in (select item_id from ${quarantinedItems})`);
}

const isUuid = (id: string) => z.string().uuid().safeParse(id).success;

/** POST /items/:itemId/reports for a student (under /v1/student) or a parent (under /v1). */
export function reportRoutes(db: Database, reportedBy: 'student' | 'parent') {
  const app = new Hono<AppEnv>();
  app.post('/items/:itemId/reports', async (c) => {
    const param = c.req.param('itemId');
    const input = await readJson(c, ReportSchema);
    // The app knows an item by its database id; content tools use the content id.
    const [row] = await db
      .select({ contentId: items.contentId, version: items.version })
      .from(items)
      .where(
        isUuid(param) ? eq(items.id, param) : eq(items.contentId, ContentIdSchema.parse(param)),
      );
    if (isUuid(param) && !row?.contentId) throw notFound('No such item');
    const itemId = row?.contentId ?? param;
    const itemVersion = input.itemVersion ?? row?.version;
    if (!itemVersion) throw new ApiError(400, 'invalid_request', 'itemVersion is needed');
    const familyId = reportedBy === 'student' ? c.var.student.familyId : c.var.parent.familyId;
    // Hide first: even if recording the report fails, no student sees the item meanwhile.
    await quarantine(db, itemId, itemVersion, 'report');
    const [report] = await db
      .insert(itemReports)
      .values({ itemId, itemVersion, reason: input.reason, reportedBy, familyId })
      .returning({ id: itemReports.id });
    return c.json({ reportId: report!.id, quarantined: true }, 201);
  });
  return app;
}
