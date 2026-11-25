/**
 * O4: complaints in AppDeck, on AppDeck's paths. Agents list, log emailed complaints,
 * acknowledge, reply and resolve; Managers escalate. Every read and change is audited.
 */
import { Hono, type Context } from 'hono';
import { and, desc, eq, ne } from 'drizzle-orm';
import type { z } from 'zod';
import {
  ComplaintMessageBodySchema,
  OperatorComplaintLogBodySchema,
  OperatorComplaintOutcomeBodySchema,
  complaintDueDates,
  complaintEscalationFrom,
} from '@revisionden/core';
import { complaintMessages, complaints, families, type Database } from '@revisionden/db';
import type { AppEnv } from '../context';
import { complaintMessagesFor } from '../complaints/routes';
import { ApiError, notFound } from '../errors';
import type { Clock } from '../rate-limit';
import { isId } from '../validation';
import { audit, ok, requireManager } from './bridge';

export interface OperatorComplaintDeps {
  db: Database;
  clock: Clock;
}

async function body<T extends z.ZodTypeAny>(c: Context, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new ApiError(400, 'invalid_json', 'The request body must be JSON');
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new ApiError(400, 'invalid_request', 'The request is not valid');
  return parsed.data;
}

const COMPLAINT_LIMIT = 500;

export function operatorComplaintRoutes({ db, clock }: OperatorComplaintDeps) {
  const app = new Hono<AppEnv>();
  const now = () => clock.now();

  /** An open complaint (not resolved), or 404 / 409. */
  async function openComplaint(id: string) {
    if (!isId(id)) throw notFound('Complaint not found');
    const [row] = await db.select().from(complaints).where(eq(complaints.id, id));
    if (!row) throw notFound('Complaint not found');
    if (row.status === 'resolved') {
      throw new ApiError(409, 'complaint_closed', 'This complaint is already resolved');
    }
    return row;
  }

  const audited = (c: Context<AppEnv>, action: string, familyId: string | null, id: string) =>
    audit(
      db,
      c.var.operator,
      familyId
        ? { action, targetType: 'family', targetId: familyId }
        : { action, targetType: 'complaint', targetId: id },
      now(),
    );

  app.get('/complaints', async (c) => {
    const rows = await db
      .select()
      .from(complaints)
      .orderBy(desc(complaints.receivedAt))
      .limit(COMPLAINT_LIMIT);
    const messages = await complaintMessagesFor(
      db,
      rows.map((r) => r.id),
    );
    const at = now();
    await audit(db, c.var.operator, { action: 'complaints.list' }, at);
    return ok(c, {
      complaints: rows.map((r) => ({
        id: r.id,
        familyId: r.familyId,
        status: r.status,
        channel: r.channel,
        summary: r.summary,
        aboutPersonalData: r.aboutPersonalData,
        receivedAt: r.receivedAt.toISOString(),
        acknowledgeDueAt: r.acknowledgeDueAt.toISOString(),
        resolveDueAt: r.resolveDueAt.toISOString(),
        acknowledgedAt: r.acknowledgedAt?.toISOString() ?? null,
        resolvedAt: r.resolvedAt?.toISOString() ?? null,
        escalationFrom: r.acknowledgedAt
          ? complaintEscalationFrom(r.acknowledgedAt).toISOString()
          : null,
        acknowledgeOverdue: !r.acknowledgedAt && at > r.acknowledgeDueAt,
        resolveOverdue: !r.resolvedAt && at > r.resolveDueAt,
        outcome: r.outcome,
        messages: (messages.get(r.id) ?? []).map((m) => ({
          id: m.id,
          from: m.sender,
          body: m.body,
          createdAt: m.createdAt.toISOString(),
        })),
      })),
    });
  });

  // Logs a complaint that arrived by email (channel "email").
  app.post('/complaints', async (c) => {
    const { familyId, summary, aboutPersonalData, receivedOn } = await body(
      c,
      OperatorComplaintLogBodySchema,
    );
    if (familyId) {
      const [family] = await db
        .select({ id: families.id })
        .from(families)
        .where(eq(families.id, familyId));
      if (!family) throw notFound('Family not found');
    }
    // Noon UTC is the same day in UK time all year.
    const receivedAt = new Date(`${receivedOn}T12:00:00Z`);
    const [row] = await db
      .insert(complaints)
      .values({
        familyId,
        channel: 'email',
        summary,
        aboutPersonalData,
        receivedAt,
        ...complaintDueDates(receivedAt),
        createdAt: now(),
      })
      .returning({ id: complaints.id });
    await audited(c, 'complaint.log', familyId, row!.id);
    return ok(c, { complaint: { id: row!.id } });
  });

  app.post('/complaints/:id/acknowledge', async (c) => {
    const row = await openComplaint(c.req.param('id'));
    if (row.acknowledgedAt) {
      throw new ApiError(409, 'already_acknowledged', 'This complaint is already acknowledged');
    }
    await db
      .update(complaints)
      .set({
        acknowledgedAt: now(),
        ...(row.status === 'new' ? { status: 'acknowledged' as const } : {}),
      })
      .where(eq(complaints.id, row.id));
    await audited(c, 'complaint.acknowledge', row.familyId, row.id);
    return ok(c, { ok: true });
  });

  app.post('/complaints/:id/reply', async (c) => {
    const { text } = await body(c, ComplaintMessageBodySchema);
    const row = await openComplaint(c.req.param('id'));
    await db.insert(complaintMessages).values({
      complaintId: row.id,
      sender: 'operator',
      authorEmail: c.var.operator.email,
      body: text,
      createdAt: now(),
    });
    await audited(c, 'complaint.reply', row.familyId, row.id);
    return ok(c, { ok: true });
  });

  app.post('/complaints/:id/resolve', async (c) => {
    const { outcome } = await body(c, OperatorComplaintOutcomeBodySchema);
    const row = await openComplaint(c.req.param('id'));
    const at = now();
    await db
      .update(complaints)
      .set({
        status: 'resolved',
        resolvedAt: at,
        outcome,
        acknowledgedAt: row.acknowledgedAt ?? at,
      })
      .where(and(eq(complaints.id, row.id), ne(complaints.status, 'resolved')));
    await audited(c, 'complaint.resolve', row.familyId, row.id);
    return ok(c, { ok: true });
  });

  app.post('/complaints/:id/escalate', requireManager(db), async (c) => {
    const row = await openComplaint(c.req.param('id'));
    const at = now();
    await db
      .update(complaints)
      .set({ status: 'escalated', escalatedAt: at, acknowledgedAt: row.acknowledgedAt ?? at })
      .where(eq(complaints.id, row.id));
    await audited(c, 'complaint.escalate', row.familyId, row.id);
    return ok(c, { ok: true });
  });

  return app;
}
