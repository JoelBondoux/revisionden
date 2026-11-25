import { describe, expect, it } from 'vitest';
import { aiAllowance } from './stats-allowance';

describe('AI marking allowance (no money shown to families)', () => {
  it('turns this month’s use into a percentage and the next reset date', () => {
    expect(
      aiAllowance({ month: '2026-11', spentMicroUsd: 300_000, capMicroUsd: 2_500_000 }),
    ).toEqual({
      percentUsed: 12,
      usedUp: false,
      resetsOn: '2026-12-01',
    });
  });

  it('rolls the reset date over the new year', () => {
    expect(
      aiAllowance({ month: '2026-12', spentMicroUsd: 0, capMicroUsd: 2_500_000 }).resetsOn,
    ).toBe('2027-01-01');
  });

  it('is used up at or over the cap, and never shows more than 100%', () => {
    expect(
      aiAllowance({ month: '2026-11', spentMicroUsd: 2_500_000, capMicroUsd: 2_500_000 }),
    ).toMatchObject({
      percentUsed: 100,
      usedUp: true,
    });
    expect(
      aiAllowance({ month: '2026-11', spentMicroUsd: 2_600_000, capMicroUsd: 2_500_000 })
        .percentUsed,
    ).toBe(100);
  });

  it('does not show 100% before the allowance is really used up', () => {
    expect(
      aiAllowance({ month: '2026-11', spentMicroUsd: 2_499_000, capMicroUsd: 2_500_000 }),
    ).toMatchObject({
      percentUsed: 99,
      usedUp: false,
    });
  });

  it('treats a zero allowance as used up', () => {
    expect(aiAllowance({ month: '2026-11', spentMicroUsd: 0, capMicroUsd: 0 })).toMatchObject({
      percentUsed: 100,
      usedUp: true,
    });
  });
});

describe('allowance wording helpers', () => {
  it('names the reset day in UK English', async () => {
    const { resetDayLabel } = await import('./stats-allowance');
    expect(resetDayLabel('2026-12-01')).toBe('1 December');
    expect(resetDayLabel('2027-01-01')).toBe('1 January');
  });

  it('gives one call’s share of the allowance to one decimal place', async () => {
    const { allowanceSharePercent } = await import('./stats-allowance');
    expect(allowanceSharePercent(25_000, 2_500_000)).toBe(1);
    expect(allowanceSharePercent(1_200, 2_500_000)).toBe(0);
    expect(allowanceSharePercent(3_750, 2_500_000)).toBe(0.2);
    expect(allowanceSharePercent(10, 0)).toBe(100);
  });
});
