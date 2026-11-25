/**
 * The AI marking allowance (workstream K9, docs/PRODUCT_RULES.md "Statistics dashboards"):
 * families never see money for AI. The per-child monthly cap is shown as a percentage used
 * and the date it resets. The internal cost fields stay operator-only.
 */
export interface AiUse {
  /** The calendar month the cap counts, as YYYY-MM (the cap resets on the 1st, apps/api ai/gateway.ts). */
  month: string;
  spentMicroUsd: number;
  capMicroUsd: number;
}

export interface AiAllowance {
  /** 0 to 100, rounded down so 100 only shows once the allowance is really used up. */
  percentUsed: number;
  usedUp: boolean;
  /** The 1st of the next month, YYYY-MM-DD. */
  resetsOn: string;
}

export function aiAllowance(use: AiUse): AiAllowance {
  const usedUp = use.spentMicroUsd >= use.capMicroUsd;
  const percentUsed = usedUp
    ? 100
    : Math.min(99, Math.floor((Math.max(0, use.spentMicroUsd) / use.capMicroUsd) * 100));
  const [year, month] = use.month.split('-').map(Number) as [number, number];
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  return { percentUsed, usedUp, resetsOn: `${next.y}-${String(next.m).padStart(2, '0')}-01` };
}

/** "1 December" for a reset date (YYYY-MM-DD, the 1st of a month), for families to read. */
export function resetDayLabel(resetsOn: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${resetsOn}T00:00:00Z`));
}

/** One AI call's share of the monthly allowance, to one decimal place (for the family export). */
export function allowanceSharePercent(costMicroUsd: number, capMicroUsd: number): number {
  if (capMicroUsd <= 0) return 100;
  return Math.round((costMicroUsd / capMicroUsd) * 1000) / 10;
}
