import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { OperatorDataRequestListSchema } from '@revisionden/core';
import { authUsers, dataRequests, families, operatorAuditLog, parents } from '@revisionden/db';
import { createTestContext, type TestContext } from '../test/helpers';
import { signedOperatorRequest, TEST_OPERATOR_SECRET } from '../test/operator';

let t: TestContext;

beforeEach(async () => {
  t = await createTestContext({ config: { operatorBridge: { secret: TEST_OPERATOR_SECRET } } });
});
afterEach(async () => {
  await t.close();
});

async function call(method: string, path: string, body?: unknown, role = 'agent') {
  const res = await t.app.request(
    ...(await signedOperatorRequest({
      clock: t.clock,
      method,
      path: `/operator/appdeck${path}`,
      body,
      role,
    })),
  );
  const json = (await res.json()) as { data?: unknown; error?: { code: string } };
  return { status: res.status, data: json.data, code: json.error?.code };
}

async function makeFamily() {
  const { parent } = await t.familyStudent('test_kid');
  const [row] = await t.db
    .select({ familyId: parents.familyId })
    .from(parents)
    .where(eq(parents.authUserId, parent.userId));
  return { familyId: row!.familyId, parentUserId: parent.userId };
}

const log = (familyId: string, kind: string, receivedOn = '2026-11-20') =>
  call('POST', '/data-requests', { familyId, kind, receivedOn });

async function requestId(familyId: string, kind: string) {
  const res = await log(familyId, kind);
  return (res.data as { request: { id: string } }).request.id;
}

describe('operator data requests (emailed export and deletion requests)', () => {
  it('lets an Agent log a request with a one-calendar-month deadline, and lists it', async () => {
    const f = await makeFamily();
    const res = await log(f.familyId, 'export', '2026-01-31');
    expect(res.status).toBe(200);
    const list = OperatorDataRequestListSchema.parse((await call('GET', '/data-requests')).data);
    expect(list.requests).toEqual([
      {
        id: (res.data as { request: { id: string } }).request.id,
        familyId: f.familyId,
        kind: 'export',
        receivedAt: '2026-01-31T00:00:00.000Z',
        // One calendar month, to the end of the shorter month.
        dueAt: '2026-02-28T00:00:00.000Z',
        status: 'open',
        handledAt: null,
      },
    ]);
    expect(await t.db.select().from(operatorAuditLog)).toContainEqual(
      expect.objectContaining({ action: 'data_request.log', targetId: f.familyId }),
    );
  });

  it('refuses an unknown family, kind or date', async () => {
    const f = await makeFamily();
    expect((await log(crypto.randomUUID(), 'export')).status).toBe(404);
    expect((await log(f.familyId, 'rename')).status).toBe(400);
    expect((await log(f.familyId, 'export', '20-11-2026')).status).toBe(400);
  });

  it('lets only a Manager mark a request handled', async () => {
    const f = await makeFamily();
    const id = await requestId(f.familyId, 'export');
    expect((await call('POST', `/data-requests/${id}/handled`, {}, 'agent')).status).toBe(403);
    expect((await call('POST', `/data-requests/${id}/handled`, {}, 'manager')).data).toEqual({
      ok: true,
    });
    const [row] = await t.db.select().from(dataRequests).where(eq(dataRequests.id, id));
    expect(row!.handledAt).toEqual(t.clock.now());
    const again = await call('POST', `/data-requests/${id}/handled`, {}, 'manager');
    expect(again).toMatchObject({ status: 409, code: 'already_handled' });
  });

  it('deletes a one-parent family with the existing deletion code when a deletion is handled', async () => {
    const f = await makeFamily();
    const id = await requestId(f.familyId, 'deletion');
    expect((await call('POST', `/data-requests/${id}/handled`, {}, 'manager')).data).toEqual({
      ok: true,
    });
    expect(await t.db.select().from(families).where(eq(families.id, f.familyId))).toEqual([]);
    expect(await t.db.select().from(authUsers).where(eq(authUsers.id, f.parentUserId))).toEqual([]);
    // The record of handling it stays.
    const [row] = await t.db.select().from(dataRequests).where(eq(dataRequests.id, id));
    expect(row!.handledAt).not.toBeNull();
    expect(await t.db.select().from(operatorAuditLog)).toContainEqual(
      expect.objectContaining({
        action: 'family.delete',
        targetId: f.familyId,
        operatorRole: 'manager',
      }),
    );
  });

  it('never deletes a two-parent family from AppDeck: both parents confirm in the app', async () => {
    const f = await makeFamily();
    await t.db.insert(authUsers).values({ id: 'second-parent', email: 'second@example.com' });
    await t.db
      .insert(parents)
      .values({ familyId: f.familyId, authUserId: 'second-parent', position: 2 });
    const id = await requestId(f.familyId, 'deletion');
    const res = await call('POST', `/data-requests/${id}/handled`, {}, 'manager');
    expect(res).toMatchObject({ status: 409, code: 'needs_both_parents' });
    expect(await t.db.select().from(families).where(eq(families.id, f.familyId))).toHaveLength(1);
  });
});

describe('operator trial and free-place changes before payments exist', () => {
  it('refuses Agents and tells a Manager payments are not ready yet', async () => {
    const f = await makeFamily();
    const paths: [string, unknown][] = [
      [`/families/${f.familyId}/trial/extend`, { days: 7, reason: 'Sorted a bug' }],
      [
        `/families/${f.familyId}/free-place/grant`,
        { scheme: 'Free school meals', reason: 'Checked' },
      ],
      [`/families/${f.familyId}/free-place/end`, { reason: 'No longer eligible' }],
    ];
    for (const [path, body] of paths) {
      expect((await call('POST', path, body, 'agent')).status, path).toBe(403);
      expect(await call('POST', path, body, 'manager'), path).toMatchObject({
        status: 503,
        code: 'payments_not_ready',
      });
    }
    expect(await call('GET', '/free-places')).toMatchObject({
      status: 503,
      code: 'payments_not_ready',
    });
  });
});

describe('data request retention', () => {
  it('deletes records 2 years after the request arrived', async () => {
    const { deleteExpiredDataRequests } = await import('./data-requests');
    const row = (receivedAt: string) => ({
      familyId: crypto.randomUUID(),
      kind: 'export' as const,
      receivedAt: new Date(receivedAt),
      dueAt: new Date(receivedAt),
      loggedBy: 'agent@example.com',
    });
    await t.db
      .insert(dataRequests)
      .values([row('2024-11-24T09:00:00Z'), row('2024-11-25T11:00:00Z')]);
    expect(await deleteExpiredDataRequests(t.db, new Date('2026-11-25T10:00:00Z'))).toBe(1);
    expect(await t.db.select().from(dataRequests)).toHaveLength(1);
  });
});
