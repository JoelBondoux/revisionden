import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { OperatorDiscountCodeListSchema } from '@revisionden/core';
import { discountCodes, discountRedemptions, operatorAuditLog, parents } from '@revisionden/db';
import { createTestContext, type TestContext } from '../test/helpers';
import { signedOperatorRequest, TEST_OPERATOR_SECRET } from '../test/operator';
import { checkCodeForFamily } from './discount-codes';

let t: TestContext;

beforeEach(async () => {
  t = await createTestContext({ config: { operatorBridge: { secret: TEST_OPERATOR_SECRET } } });
});
afterEach(async () => {
  await t.close();
});

async function call(method: string, path: string, body?: unknown, role = 'manager') {
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

const winter = {
  code: 'winter26',
  kind: 'percent',
  amount: 20,
  months: 3,
  expiresAt: '2026-12-31',
  maxUses: 50,
};

describe('discount codes in AppDeck (O5)', () => {
  it('lets a Manager create a code, stored in upper case, and lists it with its redemptions', async () => {
    const res = await call('POST', '/discount-codes', winter);
    expect(res.status).toBe(200);
    const created = (res.data as { code: Record<string, unknown> }).code;
    expect(created).toMatchObject({
      code: 'WINTER26',
      kind: 'percent',
      amount: 20,
      months: 3,
      expiresAt: '2026-12-31',
      maxUses: 50,
      redemptions: 0,
      disabledAt: null,
    });
    const list = OperatorDiscountCodeListSchema.parse(
      (await call('GET', '/discount-codes', undefined, 'agent')).data,
    );
    expect(list.codes.map((c) => c.code)).toEqual(['WINTER26']);
    expect(await t.db.select().from(operatorAuditLog)).toContainEqual(
      expect.objectContaining({
        action: 'discount_code.create',
        targetType: 'discount_code',
        operatorRole: 'manager',
      }),
    );
  });

  it('refuses Agents, duplicates in any case, and bad codes', async () => {
    expect((await call('POST', '/discount-codes', winter, 'agent')).status).toBe(403);
    await call('POST', '/discount-codes', winter);
    expect(await call('POST', '/discount-codes', { ...winter, code: 'Winter26' })).toMatchObject({
      status: 409,
      code: 'code_taken',
    });
    expect((await call('POST', '/discount-codes', { ...winter, code: 'abc' })).status).toBe(400);
    expect((await call('POST', '/discount-codes', { ...winter, amount: 120 })).status).toBe(400);
  });

  it('lets a Manager disable a code', async () => {
    const id = ((await call('POST', '/discount-codes', winter)).data as { code: { id: string } })
      .code.id;
    expect((await call('POST', `/discount-codes/${id}/disable`, {}, 'agent')).status).toBe(403);
    expect((await call('POST', `/discount-codes/${id}/disable`, {})).data).toEqual({ ok: true });
    const [row] = await t.db.select().from(discountCodes).where(eq(discountCodes.id, id));
    expect(row!.disabledAt).toEqual(t.clock.now());
    expect((await call('POST', `/discount-codes/${crypto.randomUUID()}/disable`, {})).status).toBe(
      404,
    );
  });
});

describe('checking a code for a family at checkout (for workstream $)', () => {
  it('finds a live code in any case, and applies the one-code-per-family rule', async () => {
    await call('POST', '/discount-codes', { ...winter, expiresAt: undefined, maxUses: 1 });
    const { parent } = await t.familyStudent('test_kid');
    const [p] = await t.db.select().from(parents).where(eq(parents.authUserId, parent.userId));
    const familyId = p!.familyId;

    const first = await checkCodeForFamily(t.db, ' winter26 ', familyId, t.clock.now());
    expect(first).toMatchObject({ ok: true, code: { code: 'WINTER26', kind: 'percent' } });
    await t.db
      .insert(discountRedemptions)
      .values({ codeId: (first as { code: { id: string } }).code.id, familyId });
    expect(await checkCodeForFamily(t.db, 'WINTER26', familyId, t.clock.now())).toEqual({
      ok: false,
      reason: 'used_up',
    });
    expect(await checkCodeForFamily(t.db, 'NOSUCHCODE', familyId, t.clock.now())).toEqual({
      ok: false,
      reason: 'unknown',
    });
  });
});
