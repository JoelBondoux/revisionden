import { Hono } from 'hono';
import { and, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { itemReports, quarantinedItems, REPORT_REASONS, type Database } from '@revisionden/db';
import type { AppEnv } from '../context';
import { readJson } from '../http';

/** Content ids, as in content/ (lowercase words joined by hyphens). */
export const ContentIdSchema = z
  .string()
  .max(120)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'must be a content id');

// Only a reason: no free text, so a report can never carry personal data.
const ReportSchema = z
  .object({ itemVersion: z.number().int().min(1), reason: z.enum(REPORT_REASONS) })
  .strict();

/** Ids of every item hidden from students. The learning loop must skip these. */
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

/** Hides an item now. A stronger cause (confirmed error) replaces a weaker one (report). */
export async function quarantine(
  db: Database,
  itemId: string,
  itemVersion: number,
  cause: 'report' | 'confirmed_error' | 'batch_failed',
) {
  const values = { itemId, itemVersion, cause };
  if (cause === 'report') {
    await db.insert(quarantinedItems).values(values).onConflictDoNothing();
  } else {
    await db
      .insert(quarantinedItems)
      .values(values)
      .onConflictDoUpdate({ target: quarantinedItems.itemId, set: { cause, itemVersion } });
  }
}

/** Releases an item hidden only by reports once none is left open. */
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
  await db
    .delete(quarantinedItems)
    .where(and(eq(quarantinedItems.itemId, itemId), eq(quarantinedItems.cause, 'report')));
}

/** POST /items/:itemId/reports for a student (under /v1/student) or a parent (under /v1). */
export function reportRoutes(db: Database, reportedBy: 'student' | 'parent') {
  const app = new Hono<AppEnv>();
  app.post('/items/:itemId/reports', async (c) => {
    const itemId = ContentIdSchema.parse(c.req.param('itemId'));
    const input = await readJson(c, ReportSchema);
    const familyId = reportedBy === 'student' ? c.var.student.familyId : c.var.parent.familyId;
    // Hide first: even if recording the report fails, no student sees the item meanwhile.
    await quarantine(db, itemId, input.itemVersion, 'report');
    const [row] = await db
      .insert(itemReports)
      .values({
        itemId,
        itemVersion: input.itemVersion,
        reason: input.reason,
        reportedBy,
        familyId,
      })
      .returning({ id: itemReports.id });
    return c.json({ reportId: row!.id, quarantined: true }, 201);
  });
  return app;
}
