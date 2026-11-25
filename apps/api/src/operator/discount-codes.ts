/**
 * O5: discount codes in AppDeck (`docs/OPERATOR_CONSOLE.md` "Discount codes"). Everyone can see
 * them; only Managers create and disable. Payments (workstream $) apply a code at checkout with
 * `checkCodeForFamily` and record the redemption.
 */
import { Hono } from 'hono';
import { and, count, desc, eq, isNull } from 'drizzle-orm';
import {
  DiscountCodeCreateSchema,
  checkDiscountCode,
  normaliseDiscountCode,
  type DiscountCodeCheck,
} from '@revisionden/core';
import { discountCodes, discountRedemptions, type Database } from '@revisionden/db';
import type { AppEnv } from '../context';
import { ApiError, notFound } from '../errors';
import { isUniqueViolation } from '../http';
import type { Clock } from '../rate-limit';
import { isId } from '../validation';
import { audit, ok, requireManager } from './bridge';

export interface OperatorDiscountCodeDeps {
  db: Database;
  clock: Clock;
}

type CodeRow = typeof discountCodes.$inferSelect;

async function redemptionCount(db: Database, codeId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(discountRedemptions)
    .where(eq(discountRedemptions.codeId, codeId));
  return row!.n;
}

const toOperatorCode = (row: CodeRow, redemptions: number) => ({
  id: row.id,
  code: row.code,
  kind: row.kind,
  amount: row.amount,
  months: row.months,
  expiresAt: row.expiresOn,
  maxUses: row.maxUses,
  redemptions,
  disabledAt: row.disabledAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
});

export function operatorDiscountCodeRoutes({ db, clock }: OperatorDiscountCodeDeps) {
  const app = new Hono<AppEnv>();
  const now = () => clock.now();

  app.get('/discount-codes', async (c) => {
    const rows = await db.select().from(discountCodes).orderBy(desc(discountCodes.createdAt));
    const counts = await db
      .select({ codeId: discountRedemptions.codeId, n: count() })
      .from(discountRedemptions)
      .groupBy(discountRedemptions.codeId);
    const used = new Map(counts.map((r) => [r.codeId, r.n]));
    return ok(c, { codes: rows.map((r) => toOperatorCode(r, used.get(r.id) ?? 0)) });
  });

  app.post('/discount-codes', requireManager(db), async (c) => {
    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch {
      throw new ApiError(400, 'invalid_json', 'The request body must be JSON');
    }
    const parsed = DiscountCodeCreateSchema.safeParse(raw);
    if (!parsed.success) throw new ApiError(400, 'invalid_request', 'The code is not valid');
    const body = parsed.data;
    let row: CodeRow;
    try {
      [row] = (await db
        .insert(discountCodes)
        .values({
          code: body.code,
          kind: body.kind,
          amount: body.amount,
          months: body.months ?? null,
          expiresOn: body.expiresAt ?? null,
          maxUses: body.maxUses ?? null,
          createdBy: c.var.operator.email,
          createdAt: now(),
        })
        .returning()) as [CodeRow];
    } catch (err) {
      if (isUniqueViolation(err, 'discount_codes_code_unique')) {
        throw new ApiError(409, 'code_taken', 'That code already exists');
      }
      throw err;
    }
    await audit(
      db,
      c.var.operator,
      { action: 'discount_code.create', targetType: 'discount_code', targetId: row.id },
      now(),
    );
    return ok(c, { code: toOperatorCode(row, 0) });
  });

  app.post('/discount-codes/:id/disable', requireManager(db), async (c) => {
    const id = c.req.param('id');
    if (!isId(id)) throw notFound('Code not found');
    const [row] = await db.select().from(discountCodes).where(eq(discountCodes.id, id));
    if (!row) throw notFound('Code not found');
    if (!row.disabledAt) {
      await db
        .update(discountCodes)
        .set({ disabledAt: now() })
        .where(and(eq(discountCodes.id, id), isNull(discountCodes.disabledAt)));
    }
    await audit(
      db,
      c.var.operator,
      { action: 'discount_code.disable', targetType: 'discount_code', targetId: id },
      now(),
    );
    return ok(c, { ok: true });
  });

  return app;
}

/**
 * For checkout (workstream $): whether a family may use a code now. Free school meals places
 * do not exist yet, so that rule is checked by payments once they do.
 */
export async function checkCodeForFamily(
  db: Database,
  text: string,
  familyId: string,
  now: Date,
): Promise<
  | { ok: true; code: CodeRow }
  | { ok: false; reason: 'unknown' | Exclude<DiscountCodeCheck, { ok: true }>['reason'] }
> {
  const [row] = await db
    .select()
    .from(discountCodes)
    .where(eq(discountCodes.code, normaliseDiscountCode(text)));
  if (!row) return { ok: false, reason: 'unknown' };
  const [active] = await db
    .select({ n: count() })
    .from(discountRedemptions)
    .where(and(eq(discountRedemptions.familyId, familyId), isNull(discountRedemptions.endedAt)));
  const result = checkDiscountCode(
    {
      kind: row.kind,
      amount: row.amount,
      months: row.months,
      expiresOn: row.expiresOn,
      maxUses: row.maxUses,
      redemptions: await redemptionCount(db, row.id),
      disabledAt: row.disabledAt,
    },
    { hasActiveCode: active!.n > 0, hasFreePlace: false },
    now,
  );
  return result.ok ? { ok: true, code: row } : result;
}
