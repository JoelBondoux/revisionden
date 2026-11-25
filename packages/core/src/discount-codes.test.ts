import { describe, expect, it } from 'vitest';
import {
  DiscountCodeCreateSchema,
  checkDiscountCode,
  normaliseDiscountCode,
  type DiscountCodeRules,
} from './discount-codes';

const code: DiscountCodeRules = {
  kind: 'percent',
  amount: 20,
  months: 3,
  expiresOn: '2026-12-31',
  maxUses: 2,
  redemptions: 0,
  disabledAt: null,
};
const now = new Date('2026-11-25T10:00:00Z');
const family = { hasActiveCode: false, hasFreePlace: false };

describe('discount codes (O5, docs/OPERATOR_CONSOLE.md)', () => {
  it('reads codes in any letter case and without spaces', () => {
    expect(normaliseDiscountCode(' winter26 ')).toBe('WINTER26');
  });

  it('accepts a Manager code of 6–16 letters and digits, percent 1–100 or a fixed amount', () => {
    expect(
      DiscountCodeCreateSchema.parse({ code: 'winter26', kind: 'percent', amount: 20, months: 3 }),
    ).toEqual({ code: 'WINTER26', kind: 'percent', amount: 20, months: 3 });
    expect(
      DiscountCodeCreateSchema.parse({ code: 'FIVEOFF', kind: 'fixed', amount: 500 }).amount,
    ).toBe(500);
    for (const bad of [
      { code: 'SHORT', kind: 'percent', amount: 10 },
      { code: 'WAY-TOO-LONG-CODE-1', kind: 'percent', amount: 10 },
      { code: 'HAS SPACE', kind: 'percent', amount: 10 },
      { code: 'PERCENT1', kind: 'percent', amount: 101 },
      { code: 'ZEROOFF1', kind: 'fixed', amount: 0 },
      { code: 'BADDATE1', kind: 'fixed', amount: 100, expiresAt: '31/12/2026' },
      { code: 'NOUSES01', kind: 'fixed', amount: 100, maxUses: 0 },
    ]) {
      expect(() => DiscountCodeCreateSchema.parse(bad), JSON.stringify(bad)).toThrow();
    }
  });

  it('lets a family use a live code', () => {
    expect(checkDiscountCode(code, family, now)).toEqual({ ok: true });
  });

  it('refuses a disabled, expired or used-up code', () => {
    expect(checkDiscountCode({ ...code, disabledAt: now }, family, now)).toEqual({
      ok: false,
      reason: 'disabled',
    });
    expect(checkDiscountCode(code, family, new Date('2027-01-01T00:00:00Z'))).toEqual({
      ok: false,
      reason: 'expired',
    });
    // The expiry date is the last UK day the code works.
    expect(checkDiscountCode(code, family, new Date('2026-12-31T23:30:00Z')).ok).toBe(true);
    expect(checkDiscountCode({ ...code, redemptions: 2 }, family, now)).toEqual({
      ok: false,
      reason: 'used_up',
    });
  });

  it('allows one code per family at a time, and never with a free school meals place', () => {
    expect(checkDiscountCode(code, { ...family, hasActiveCode: true }, now)).toEqual({
      ok: false,
      reason: 'one_code_per_family',
    });
    expect(checkDiscountCode(code, { ...family, hasFreePlace: true }, now)).toEqual({
      ok: false,
      reason: 'free_place',
    });
  });

  it('has no limit when expiry or maximum uses are not set', () => {
    expect(
      checkDiscountCode({ ...code, expiresOn: null, maxUses: null, redemptions: 999 }, family, now),
    ).toEqual({ ok: true });
  });
});
