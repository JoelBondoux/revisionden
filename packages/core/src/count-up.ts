/**
 * Count-up and enter animations for the stats pages (workstream K5). Pure: the caller passes
 * the time, so tests need no real timers. Short and calm: about 700ms, ease-out, with a light
 * stagger of at most 60ms between items, and the whole set done within 1 second.
 */

/** How long one number counts up, or one bar grows. */
export const COUNT_UP_MS = 700;
/** The most any set of items (with its stagger) may take. */
export const MAX_ENTER_MS = 1000;
/** The most time between one item starting and the next. */
export const MAX_STAGGER_MS = 60;

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** Fast at first, settling gently at the end. 0 → 0, 1 → 1. */
export function easeOutCubic(t: number): number {
  const x = clamp01(t);
  return 1 - (1 - x) ** 3;
}

/**
 * The number to show `elapsedMs` into a count from 0 to `target`, rounded to `decimals`
 * places. Before the start (a negative time, inside a stagger delay) it is 0; at or after the
 * end it is exactly `target`.
 */
export function countUpValue(
  target: number,
  elapsedMs: number,
  { durationMs = COUNT_UP_MS, decimals = 0 }: { durationMs?: number; decimals?: number } = {},
): number {
  if (elapsedMs >= durationMs) return target;
  const scale = 10 ** decimals;
  const raw = target * easeOutCubic(elapsedMs / durationMs);
  const rounded = Math.round(raw * scale) / scale;
  // Rounding must never pass the target (0.5 up to 1 on the way to 0.9, say).
  return target >= 0 ? Math.min(rounded, target) : Math.max(rounded, target);
}

/** The delay before item `index` of `count` starts, so the whole set ends within 1 second. */
export function staggerDelay(index: number, count: number): number {
  if (count <= 1 || index <= 0) return 0;
  const step = Math.min(MAX_STAGGER_MS, (MAX_ENTER_MS - COUNT_UP_MS) / (count - 1));
  return Math.floor(Math.min(index, count - 1) * step);
}
