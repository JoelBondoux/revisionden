import { kindChange, type StatsPeriod } from '@revisionden/core';

/** 95 → "1 h 35 min", 120 → "2 h", 45 → "45 min". */
export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Student wording: gains and "same" only, never a drop. */
export function kindNote(
  current: number | null,
  previous: number | null,
  period: StatsPeriod,
): string | null {
  const change = kindChange(current, previous);
  if (change.trend === 'up') return `+${change.by} on last ${period}`;
  if (change.trend === 'same') return `Same as last ${period}`;
  return null;
}

/** Parent wording: drops are shown plainly. */
export function signedNote(current: number | null, previous: number | null): string | null {
  if (current === null || previous === null) return null;
  const diff = current - previous;
  if (diff === 0) return 'Same as last week';
  return diff > 0 ? `+${diff} on last week` : `-${-diff} on last week`;
}

export const usd = (micro: number) => `US$${(micro / 1_000_000).toFixed(2)}`;
