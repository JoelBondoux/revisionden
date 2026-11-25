/**
 * O4: formal complaints (`docs/legal/complaints-policy.md`). A parent makes one in the app
 * (`/v1/complaints`); support handles it from AppDeck (`operator/complaints.ts`). The family
 * sees replies and the outcome, never who in support wrote them.
 */
import { Hono } from 'hono';
import { and, count, desc, eq, gt, inArray, lt } from 'drizzle-orm';
import {
  ComplaintCreateSchema,
  ComplaintMessageBodySchema,
  complaintDueDates,
} from '@revisionden/core';
import { complaintMessages, complaints, type Database } from '@revisionden/db';
import type { AppEnv } from '../context';
import { ApiError, notFound } from '../errors';
import { findPersonalData } from '../ai/privacy';
import { familyProfiles } from '../feedback/routes';
import { readJson } from '../http';
import type { Clock } from '../rate-limit';
import { isId } from '../validation';

/** Complaints one family may make in any 24 hours. */
export const COMPLAINTS_PER_DAY = 3;
/** Resolved complaints are deleted this many months later. */
export const COMPLAINT_RETENTION_MONTHS = 12;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ComplaintDeps {
  db: Database;
  clock: Clock;
}

type ComplaintRow = typeof complaints.$inferSelect;
type MessageRow = typeof complaintMessages.$inferSelect;

/** Messages per complaint, oldest first. */
export async function complaintMessagesFor(
  db: Database,
  ids: string[],
): Promise<Map<string, MessageRow[]>> {
  const map = new Map<string, MessageRow[]>();
  if (ids.length === 0) return map;
  const rows = await db
    .select()
    .from(complaintMessages)
    .where(inArray(complaintMessages.complaintId, ids))
    .orderBy(complaintMessages.createdAt);
  for (const r of rows) map.set(r.complaintId, [...(map.get(r.complaintId) ?? []), r]);
  return map;
}

/** What the family sees (and downloads): no ids of staff, no operator emails. */
export function toFamilyComplaint(row: ComplaintRow, messages: MessageRow[]) {
  return {
    id: row.id,
    status: row.status,
    summary: row.summary,
    aboutPersonalData: row.aboutPersonalData,
    receivedAt: row.receivedAt.toISOString(),
    acknowledgeDueAt: row.acknowledgeDueAt.toISOString(),
    resolveDueAt: row.resolveDueAt.toISOString(),
    acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    outcome: row.outcome,
    messages: messages.map((m) => ({
      from: m.sender,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

/** Email, phone number or a child's nickname: kept out of complaint text, as for feedback. */
async function holdsContactDetails(db: Database, familyId: string, text: string) {
  const profiles = await familyProfiles(db, familyId);
  const blocked = new Set(['email', 'phone', 'nickname']);
  // With no children, a profile that matches nothing still checks emails and phone numbers.
  const none = {
    id: '\u0000',
    familyId: '\u0000',
    nickname: '\u0000',
    avatarCode: '\u0000',
    yearGroup: 0,
  };
  const checks = profiles.length > 0 ? profiles : [none];
  return checks.some((profile) => findPersonalData(text, profile).some((f) => blocked.has(f)));
}

const personalDetails = () =>
  new ApiError(
    400,
    'personal_details',
    "Please leave out email addresses, phone numbers and your child's nickname.",
  );

/** Parent routes under /v1 (the parent session is checked by the caller). */
export function parentComplaintRoutes({ db, clock }: ComplaintDeps) {
  const app = new Hono<AppEnv>();

  app.get('/complaints', async (c) => {
    const rows = await db
      .select()
      .from(complaints)
      .where(eq(complaints.familyId, c.var.parent.familyId))
      .orderBy(desc(complaints.receivedAt));
    const messages = await complaintMessagesFor(
      db,
      rows.map((r) => r.id),
    );
    return c.json({ complaints: rows.map((r) => toFamilyComplaint(r, messages.get(r.id) ?? [])) });
  });

  app.post('/complaints', async (c) => {
    const { summary, aboutPersonalData } = await readJson(c, ComplaintCreateSchema);
    const { familyId } = c.var.parent;
    if (await holdsContactDetails(db, familyId, summary)) throw personalDetails();
    const now = clock.now();
    const [recent] = await db
      .select({ n: count() })
      .from(complaints)
      .where(
        and(
          eq(complaints.familyId, familyId),
          gt(complaints.receivedAt, new Date(now.getTime() - DAY_MS)),
        ),
      );
    if (recent!.n >= COMPLAINTS_PER_DAY) {
      throw new ApiError(
        429,
        'limit_reached',
        'You can make 3 complaints a day. Please try tomorrow.',
      );
    }
    const due = complaintDueDates(now);
    const [row] = await db
      .insert(complaints)
      .values({
        familyId,
        channel: 'app',
        summary,
        aboutPersonalData,
        receivedAt: now,
        ...due,
        createdAt: now,
      })
      .returning();
    return c.json(
      {
        id: row!.id,
        acknowledgeDueAt: due.acknowledgeDueAt.toISOString(),
        resolveDueAt: due.resolveDueAt.toISOString(),
      },
      201,
    );
  });

  app.post('/complaints/:id/messages', async (c) => {
    const id = c.req.param('id');
    const { text } = await readJson(c, ComplaintMessageBodySchema);
    const { familyId } = c.var.parent;
    if (!isId(id)) throw notFound('Complaint not found');
    const [row] = await db
      .select()
      .from(complaints)
      .where(and(eq(complaints.id, id), eq(complaints.familyId, familyId)));
    if (!row) throw notFound('Complaint not found');
    if (await holdsContactDetails(db, familyId, text)) throw personalDetails();
    await db
      .insert(complaintMessages)
      .values({ complaintId: id, sender: 'family', body: text, createdAt: clock.now() });
    return c.body(null, 201);
  });

  return app;
}

/** Deletes complaints resolved more than 12 months ago (scheduled clean-up). */
export async function deleteExpiredComplaints(db: Database, now: Date): Promise<number> {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - COMPLAINT_RETENTION_MONTHS);
  const deleted = await db
    .delete(complaints)
    .where(lt(complaints.resolvedAt, cutoff))
    .returning({ id: complaints.id });
  return deleted.length;
}
