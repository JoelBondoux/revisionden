/**
 * Discount codes (workstream O5, `docs/OPERATOR_CONSOLE.md` "Discount codes"). Managers create
 * them in AppDeck; payments (workstream $) apply them at checkout with `checkDiscountCode`.
 * Codes are case-insensitive, 6–16 letters and digits. One code per family at a time, and never
 * with a free school meals place (already free).
 */
import { z } from 'zod';

export const normaliseDiscountCode = (code: string) => code.trim().toUpperCase();

const ymd = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  // A real calendar day: JavaScript rolls 2026-02-29 into March, so compare it back.
  .refine((d) => {
    const parsed = new Date(`${d}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === d;
  }, 'Not a date');

/** `POST discount-codes`: `amount` is a percentage, or pence when `kind` is fixed. */
export const DiscountCodeCreateSchema = z
  .object({
    code: z
      .string()
      .transform(normaliseDiscountCode)
      .pipe(z.string().regex(/^[A-Z0-9]{6,16}$/, '6–16 letters and digits')),
    kind: z.enum(['percent', 'fixed']),
    amount: z.number().int().min(1),
    /** How many months the discount lasts; forever when left out. */
    months: z.number().int().min(1).max(120).optional(),
    /** Last day (UK) the code can be used. */
    expiresAt: ymd.optional(),
    maxUses: z.number().int().min(1).optional(),
  })
  .strict()
  .refine((c) => c.kind !== 'percent' || c.amount <= 100, {
    message: 'A percentage is 1 to 100',
    path: ['amount'],
  });
export type DiscountCodeCreate = z.infer<typeof DiscountCodeCreateSchema>;

export interface DiscountCodeRules {
  kind: 'percent' | 'fixed';
  amount: number;
  months: number | null;
  /** YYYY-MM-DD, the last UK day it works; null for no expiry. */
  expiresOn: string | null;
  maxUses: number | null;
  redemptions: number;
  disabledAt: Date | null;
}

export type DiscountCodeCheck =
  | { ok: true }
  | {
      ok: false;
      reason: 'disabled' | 'expired' | 'used_up' | 'one_code_per_family' | 'free_place';
    };

const ukDate = (at: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);

/** Whether a family may use a code now. */
export function checkDiscountCode(
  code: DiscountCodeRules,
  family: { hasActiveCode: boolean; hasFreePlace: boolean },
  now: Date,
): DiscountCodeCheck {
  if (code.disabledAt) return { ok: false, reason: 'disabled' };
  if (code.expiresOn && ukDate(now) > code.expiresOn) return { ok: false, reason: 'expired' };
  if (code.maxUses !== null && code.redemptions >= code.maxUses) {
    return { ok: false, reason: 'used_up' };
  }
  if (family.hasFreePlace) return { ok: false, reason: 'free_place' };
  if (family.hasActiveCode) return { ok: false, reason: 'one_code_per_family' };
  return { ok: true };
}

/** A discount code as AppDeck sees it (`GET discount-codes`). */
export const OperatorDiscountCodeSchema = z
  .object({
    id: z.string().uuid(),
    code: z.string(),
    kind: z.enum(['percent', 'fixed']),
    amount: z.number().int().min(1),
    months: z.number().int().nullable(),
    expiresAt: z.string().nullable(),
    maxUses: z.number().int().nullable(),
    redemptions: z.number().int().nonnegative(),
    disabledAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
  })
  .strict();

export const OperatorDiscountCodeListSchema = z
  .object({ codes: z.array(OperatorDiscountCodeSchema) })
  .strict();
