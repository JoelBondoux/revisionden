import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { operatorAuditLog, operatorRequests } from '@revisionden/db';
import type { AppEnv } from '../context';
import { createErrorHandler } from '../errors';
import { createMemoryRateLimiter } from '../rate-limit';
import { createTestContext, type TestContext } from '../test/helpers';
import { signedOperatorRequest, TEST_OPERATOR_SECRET } from '../test/operator';
import { audit, deleteExpiredOperatorRecords, operatorAuth, requireManager } from './bridge';

/** The error code in a shared-shape error response. */
const errorCode = async (res: Response) =>
  ((await res.json()) as { error: { code: string } }).error.code;

const bridgeOn = { config: { operatorBridge: { secret: TEST_OPERATOR_SECRET } } };

let t: TestContext;
afterEach(async () => {
  await t.close();
});

describe('operator bridge: signed requests from AppDeck', () => {
  beforeEach(async () => {
    t = await createTestContext(bridgeOn);
  });

  it('answers a correctly signed ping with the environment, version and operator', async () => {
    const res = await t.app.request(
      ...(await signedOperatorRequest({
        clock: t.clock,
        path: '/operator/appdeck/health',
        email: 'Agent@Example.com',
      })),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      data: {
        status: 'ok',
        environment: 'development',
        version: '00.01.000',
        operator: { email: 'agent@example.com', role: 'agent' },
      },
    });
  });

  it('refuses a request with no signature headers', async () => {
    const res = await t.app.request('/operator/appdeck/health');
    expect(res.status).toBe(401);
    expect(await errorCode(res)).toBe('operator_unauthorized');
  });

  it('refuses a request signed with the wrong secret', async () => {
    const res = await t.app.request(
      ...(await signedOperatorRequest({
        clock: t.clock,
        path: '/operator/appdeck/health',
        secret: `${TEST_OPERATOR_SECRET}-wrong`,
      })),
    );
    expect(res.status).toBe(401);
    expect(await errorCode(res)).toBe('operator_unauthorized');
  });

  it('signs the query string too, so a changed search is refused', async () => {
    const [, init] = await signedOperatorRequest({
      clock: t.clock,
      path: '/operator/appdeck/health?id=one',
    });
    const res = await t.app.request('/operator/appdeck/health?id=two', init);
    expect(res.status).toBe(401);
  });

  it('refuses a request signed more than 5 minutes ago', async () => {
    const old = String(t.clock.now().getTime() - 301_000);
    const res = await t.app.request(
      ...(await signedOperatorRequest({
        clock: t.clock,
        path: '/operator/appdeck/health',
        timestamp: old,
      })),
    );
    expect(res.status).toBe(401);
    expect(await errorCode(res)).toBe('operator_request_expired');
  });

  it('refuses a timestamp sent in seconds instead of milliseconds', async () => {
    const seconds = String(Math.floor(t.clock.now().getTime() / 1000));
    const res = await t.app.request(
      ...(await signedOperatorRequest({
        clock: t.clock,
        path: '/operator/appdeck/health',
        timestamp: seconds,
      })),
    );
    expect(await errorCode(res)).toBe('operator_request_expired');
  });

  it('refuses a role other than Agent or Manager, even when signed', async () => {
    const res = await t.app.request(
      ...(await signedOperatorRequest({
        clock: t.clock,
        path: '/operator/appdeck/health',
        role: 'owner',
      })),
    );
    expect(res.status).toBe(401);
  });

  it('refuses an operator email that is not an email address', async () => {
    const res = await t.app.request(
      ...(await signedOperatorRequest({
        clock: t.clock,
        path: '/operator/appdeck/health',
        email: 'x',
      })),
    );
    expect(res.status).toBe(401);
  });

  it('refuses a read sent again with the same request id (no replays)', async () => {
    const call = { clock: t.clock, path: '/operator/appdeck/health', requestId: 'read-once-0001' };
    expect((await t.app.request(...(await signedOperatorRequest(call)))).status).toBe(200);
    const again = await t.app.request(...(await signedOperatorRequest(call)));
    expect(again.status).toBe(409);
    expect(await errorCode(again)).toBe('operator_request_replayed');
  });

  it('does not store what a read returned', async () => {
    await t.app.request(
      ...(await signedOperatorRequest({ clock: t.clock, path: '/operator/appdeck/health' })),
    );
    const rows = await t.db.select().from(operatorRequests);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.responseBody).toBeNull();
  });
});

describe('operator bridge: switched off and rate limited', () => {
  it('answers 503 (switched off) when no shared secret is set for the environment', async () => {
    t = await createTestContext();
    const res = await t.app.request(
      ...(await signedOperatorRequest({ clock: t.clock, path: '/operator/appdeck/health' })),
    );
    expect(res.status).toBe(503);
    expect(await errorCode(res)).toBe('operator_bridge_off');
  });

  it('limits how many requests arrive a minute', async () => {
    t = await createTestContext({ ...bridgeOn, operatorLimit: 2 });
    const ping = async () =>
      t.app.request(
        ...(await signedOperatorRequest({ clock: t.clock, path: '/operator/appdeck/health' })),
      );
    expect((await ping()).status).toBe(200);
    expect((await ping()).status).toBe(200);
    const third = await ping();
    expect(third.status).toBe(429);
    expect(third.headers.get('retry-after')).toBe('60');
  });
});

describe('operator bridge: roles, changes and the audit log', () => {
  let app: Hono<AppEnv>;
  let runs: number;

  beforeEach(async () => {
    t = await createTestContext(bridgeOn);
    runs = 0;
    app = new Hono<AppEnv>();
    app.use(
      '*',
      operatorAuth({
        db: t.db,
        clock: t.clock,
        config: { ...t.config, operatorBridge: { secret: TEST_OPERATOR_SECRET } },
        rateLimiter: createMemoryRateLimiter({ limit: 100, periodMs: 60_000, clock: t.clock }),
      }),
    );
    app.post('/money', requireManager(t.db), async (c) => {
      runs += 1;
      const body = await c.req.json<{ amount: number }>();
      await audit(t.db, c.var.operator, {
        action: 'money.give',
        targetType: 'family',
        targetId: 'family-1',
      });
      return c.json({ given: body.amount, run: runs });
    });
    app.post('/broken', () => {
      runs += 1;
      throw new Error('boom');
    });
    app.onError(createErrorHandler({ log: () => {} }));
  });

  const post = async (
    path: string,
    body: unknown,
    extra: { role?: string; requestId?: string } = {},
  ) =>
    app.request(
      ...(await signedOperatorRequest({ clock: t.clock, method: 'POST', path, body, ...extra })),
    );

  it('refuses an Agent on a Manager action and records the refusal', async () => {
    const res = await post('/money', { amount: 5 }, { role: 'agent' });
    expect(res.status).toBe(403);
    expect(await errorCode(res)).toBe('operator_forbidden');
    expect(runs).toBe(0);
    const [entry] = await t.db.select().from(operatorAuditLog);
    expect(entry).toMatchObject({
      operatorEmail: 'agent@example.com',
      operatorRole: 'agent',
      action: 'POST /money',
      outcome: 'denied',
    });
  });

  it('lets a Manager act and records who did what to which family', async () => {
    const res = await post('/money', { amount: 5 }, { role: 'Manager', requestId: 'change-0001' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ given: 5, run: 1 });
    const [entry] = await t.db.select().from(operatorAuditLog);
    expect(entry).toMatchObject({
      operatorRole: 'manager',
      action: 'money.give',
      targetType: 'family',
      targetId: 'family-1',
      requestId: 'change-0001',
      outcome: 'ok',
    });
  });

  it('runs a change once when AppDeck retries it with the same request id and body', async () => {
    const first = await post('/money', { amount: 5 }, { role: 'manager', requestId: 'retry-0001' });
    const retry = await post('/money', { amount: 5 }, { role: 'manager', requestId: 'retry-0001' });
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual(await first.json());
    expect(retry.headers.get('x-appdeck-replayed')).toBe('true');
    expect(runs).toBe(1);
    expect(await t.db.select().from(operatorAuditLog)).toHaveLength(1);
  });

  it('refuses a request id reused with a different body', async () => {
    await post('/money', { amount: 5 }, { role: 'manager', requestId: 'reuse-0001' });
    const res = await post('/money', { amount: 50 }, { role: 'manager', requestId: 'reuse-0001' });
    expect(res.status).toBe(409);
    expect(await errorCode(res)).toBe('operator_request_conflict');
    expect(runs).toBe(1);
  });

  it('lets a change that crashed be tried again with the same request id', async () => {
    expect((await post('/broken', {}, { requestId: 'crash-0001' })).status).toBe(500);
    expect((await post('/broken', {}, { requestId: 'crash-0001' })).status).toBe(500);
    expect(runs).toBe(2);
  });
});

describe('operator records retention', () => {
  beforeEach(async () => {
    t = await createTestContext();
  });

  it('keeps the audit log 2 years and request ids 1 day', async () => {
    const now = new Date('2026-11-25T10:00:00Z');
    const entry = (createdAt: Date, requestId: string) => ({
      operatorEmail: 'agent@example.com',
      operatorRole: 'agent' as const,
      action: 'family.view',
      requestId,
      outcome: 'ok' as const,
      createdAt,
    });
    await t.db
      .insert(operatorAuditLog)
      .values([
        entry(new Date('2024-11-25T09:59:00Z'), 'old'),
        entry(new Date('2024-11-25T10:01:00Z'), 'kept'),
      ]);
    const request = (createdAt: Date, requestId: string) => ({
      requestId,
      method: 'GET',
      path: '/operator/appdeck/health',
      bodyHash: 'h',
      createdAt,
    });
    await t.db
      .insert(operatorRequests)
      .values([
        request(new Date('2026-11-24T09:59:00Z'), 'old-request'),
        request(new Date('2026-11-24T10:01:00Z'), 'kept-request'),
      ]);

    expect(await deleteExpiredOperatorRecords(t.db, now)).toEqual({
      operatorAuditDeleted: 1,
      operatorRequestsDeleted: 1,
    });
    expect((await t.db.select().from(operatorAuditLog)).map((r) => r.requestId)).toEqual(['kept']);
    expect((await t.db.select().from(operatorRequests)).map((r) => r.requestId)).toEqual([
      'kept-request',
    ]);
  });
});
