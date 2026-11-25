/**
 * O3b: data requests a family sent by email (export or deletion, due within one calendar
 * month), and the Manager-only trial and free-place changes, which wait for payments
 * (workstream $). `docs/OPERATOR_CONSOLE.md`.
 */
import { Hono } from 'hono';
import { and, asc, count, eq, isNull, lt, sql } from 'drizzle-orm';
import { OperatorDataRequestBodySchema, dataRequestDueAt } from '@revisionden/core';
import { dataRequests, families, parents, type Database } from '@revisionden/db';
import type { AppEnv } from '../context';
import { deleteFamilies } from '../cleanup';
import { ApiError, notFound } from '../errors';
import type { Clock } from '../rate-limit';
import { isId } from '../validation';
import { audit, ok, requireManager } from './bridge';

/** Data request records are kept this many years after they arrive. */
export const DATA_REQUEST_RETENTION_YEARS = 2;

export interface OperatorDataRequestDeps {
  db: Database;
  clock: Clock;
}

const paymentsNotReady = () =>
  new ApiError(
    503,
    'payments_not_ready',
    'Trials and free places can be changed once payments are set up',
  );

export function operatorDataRequestRoutes({ db, clock }: OperatorDataRequestDeps) {
  const app = new Hono<AppEnv>();
  const now = () => clock.now();

  app.get('/data-requests', async (c) => {
    const rows = await db
      .select()
      .from(dataRequests)
      // Open ones first, soonest deadline first; then the latest handled.
      .orderBy(sql`${dataRequests.handledAt} is not null`, asc(dataRequests.dueAt))
      .limit(500);
    return ok(c, {
      requests: rows.map((r) => ({
        id: r.id,
        familyId: r.familyId,
        kind: r.kind,
        receivedAt: r.receivedAt.toISOString(),
        dueAt: r.dueAt.toISOString(),
        status: r.handledAt ? ('handled' as const) : ('open' as const),
        handledAt: r.handledAt?.toISOString() ?? null,
      })),
    });
  });

  app.post('/data-requests', async (c) => {
    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch {
      throw new ApiError(400, 'invalid_json', 'The request body must be JSON');
    }
    const parsed = OperatorDataRequestBodySchema.safeParse(raw);
    if (!parsed.success) throw new ApiError(400, 'invalid_request', 'The request is not valid');
    const { familyId, kind, receivedOn } = parsed.data;
    const [family] = await db
      .select({ id: families.id })
      .from(families)
      .where(eq(families.id, familyId));
    if (!family) throw notFound('Family not found');
    const receivedAt = new Date(`${receivedOn}T00:00:00Z`);
    const [row] = await db
      .insert(dataRequests)
      .values({
        familyId,
        kind,
        receivedAt,
        dueAt: dataRequestDueAt(receivedAt),
        loggedBy: c.var.operator.email,
        createdAt: now(),
      })
      .returning({ id: dataRequests.id });
    await audit(
      db,
      c.var.operator,
      { action: 'data_request.log', targetType: 'family', targetId: familyId },
      now(),
    );
    return ok(c, { request: { id: row!.id } });
  });

  // Marks a request handled. A deletion runs the app's own deletion code, and only for a
  // one-parent family: with two parents both must confirm in the app (docs/PRODUCT_RULES.md).
  app.post('/data-requests/:id/handled', requireManager(db), async (c) => {
    const id = c.req.param('id');
    if (!isId(id)) throw notFound('Data request not found');
    const [request] = await db.select().from(dataRequests).where(eq(dataRequests.id, id));
    if (!request) throw notFound('Data request not found');
    if (request.handledAt) throw new ApiError(409, 'already_handled', 'Already handled');
    if (request.kind === 'deletion') {
      const [parentCount] = await db
        .select({ n: count() })
        .from(parents)
        .where(eq(parents.familyId, request.familyId));
      if (parentCount!.n > 1) {
        throw new ApiError(
          409,
          'needs_both_parents',
          'This family has two parents: both confirm the deletion in the app',
        );
      }
      await deleteFamilies(db, [request.familyId]);
      await audit(
        db,
        c.var.operator,
        { action: 'family.delete', targetType: 'family', targetId: request.familyId },
        now(),
      );
    }
    const [handled] = await db
      .update(dataRequests)
      .set({ handledAt: now() })
      .where(and(eq(dataRequests.id, id), isNull(dataRequests.handledAt)))
      .returning({ id: dataRequests.id });
    if (!handled) throw new ApiError(409, 'already_handled', 'Already handled');
    await audit(
      db,
      c.var.operator,
      { action: 'data_request.handled', targetType: 'family', targetId: request.familyId },
      now(),
    );
    return ok(c, { ok: true });
  });

  // Manager-only: wait for payments (workstream $), so they never pretend to work.
  for (const path of [
    '/families/:id/trial/extend',
    '/families/:id/free-place/grant',
    '/families/:id/free-place/end',
  ]) {
    app.post(path, requireManager(db), () => {
      throw paymentsNotReady();
    });
  }
  app.get('/free-places', () => {
    throw paymentsNotReady();
  });

  return app;
}

/** Deletes data request records older than 2 years (scheduled clean-up). */
export async function deleteExpiredDataRequests(db: Database, now: Date): Promise<number> {
  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - DATA_REQUEST_RETENTION_YEARS);
  const deleted = await db
    .delete(dataRequests)
    .where(lt(dataRequests.receivedAt, cutoff))
    .returning({ id: dataRequests.id });
  return deleted.length;
}
