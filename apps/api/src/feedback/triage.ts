/**
 * L14: the lead's triage (owner ruling, 2026-11-27: "Confirm is an automated process by you [the
 * lead] if you see a genuine issue that needs fixing"). A scoped machine token, not a person's
 * session: its SHA-256 is a Worker secret (TRIAGE_TOKEN_HASH; never in the repo), and it opens
 * only these routes. It reuses the operator's confirm, duplicate and Not-a-bug code, so every Bug
 * Hunter rule still applies, and every change is audited with actor `triage-bot` and a reason.
 * Off in production until the owner approves it (env.ts). No names, no emails, no family ids.
 */
import { Hono, type Context } from 'hono';
import { and, desc, eq, gt, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { feedback, students, type Database } from '@revisionden/db';
import type { AppEnv } from '../context';
import type { AppConfig } from '../env';
import { ApiError, notFound } from '../errors';
import { readJson } from '../http';
import type { Clock } from '../rate-limit';
import { audit } from '../operator/bridge';
import { confirmFeedback, markNotABug } from './routes';

export interface TriageDeps {
  db: Database;
  config: AppConfig;
  clock: Clock;
}

const TRIAGE_ACTOR = 'triage-bot';
const MAX_TICKETS = 200;

const reason = z.string().trim().min(1).max(300);
const reasonSchema = z.object({ reason }).strict();
const duplicateSchema = z.object({ duplicateOf: z.string().uuid(), reason }).strict();
const listQuery = z.object({ since: z.string().datetime().optional() });

/** SHA-256 of a string, as lower-case hex. */
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Compares two equal-length hex strings without stopping at the first difference. */
function sameHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const unauthorised = () =>
  new ApiError(401, 'unauthorised', 'A valid triage token is needed for this request.');

export function triageRoutes({ db, config, clock }: TriageDeps) {
  const app = new Hono<AppEnv>();

  app.use('*', async (c, next) => {
    // No hash set (or production): the routes stay hidden.
    if (!config.triage) throw notFound();
    const header = c.req.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
    if (!token || !sameHex(await sha256Hex(token), config.triage.tokenHash)) throw unauthorised();
    await next();
  });

  const audited = (c: Context<AppEnv>, action: string, familyId: string, why: string) =>
    audit(
      db,
      {
        email: TRIAGE_ACTOR,
        role: 'agent',
        requestId: c.req.header('x-request-id') ?? crypto.randomUUID(),
      },
      { action, targetType: 'family', targetId: familyId, reason: why },
      clock.now(),
    );

  // The tickets triage reads: the report itself, never who sent it beyond the role.
  app.get('/tickets', async (c) => {
    const parsed = listQuery.safeParse(c.req.query());
    if (!parsed.success) throw new ApiError(400, 'invalid_request', 'Use since=<ISO time>');
    const since = parsed.data.since ? new Date(parsed.data.since) : null;
    const rows = await db
      .select({ row: feedback, tester: students.tester })
      .from(feedback)
      .leftJoin(students, eq(students.id, feedback.studentId))
      .where(
        and(
          inArray(feedback.kind, ['bug', 'idea', 'confusing', 'other']),
          since ? gt(feedback.createdAt, since) : undefined,
        ),
      )
      .orderBy(desc(feedback.createdAt))
      .limit(MAX_TICKETS);
    return c.json({
      tickets: rows.map(({ row, tester }) => ({
        id: row.id,
        kind: row.kind,
        senderRole: row.senderRole,
        text: row.text,
        itemId: row.itemId ?? null,
        contentId: row.device?.contentId ?? null,
        device: row.device,
        status: row.status,
        outcome: row.outcome ?? null,
        tester: tester ?? false,
        createdAt: row.createdAt.toISOString(),
      })),
    });
  });

  app.post('/tickets/:id/confirm-bug', async (c) => {
    const { reason: why } = await readJson(c, reasonSchema);
    const { item } = await confirmFeedback(db, clock.now(), c.req.param('id'), undefined, 'triage');
    await audited(c, 'ticket.confirm_bug', item.familyId, why);
    return c.json({ ok: true });
  });

  app.post('/tickets/:id/duplicate', async (c) => {
    const { duplicateOf, reason: why } = await readJson(c, duplicateSchema);
    const { item } = await confirmFeedback(
      db,
      clock.now(),
      c.req.param('id'),
      duplicateOf,
      'triage',
    );
    await audited(c, 'ticket.duplicate', item.familyId, why);
    return c.json({ ok: true });
  });

  app.post('/tickets/:id/not-a-bug', async (c) => {
    const { reason: why } = await readJson(c, reasonSchema);
    const item = await markNotABug(db, clock.now(), c.req.param('id'), 'triage');
    await audited(c, 'ticket.not_a_bug', item.familyId, why);
    return c.json({ ok: true });
  });

  return app;
}
