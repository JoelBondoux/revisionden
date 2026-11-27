import type { Rng } from './rng';

/**
 * Options that only make sense at the end of the list ("None of these", "All of the above",
 * "Both of them", "Neither of these"): they stay last when the others are shuffled (F22).
 */
const PINNED_LAST = /^(none|all|both|neither) of (these|those|them|the above)\b/i;

/**
 * F22: the order to show a multiple choice question's options in, as their original positions.
 * Shuffled fresh each serve (Fisher-Yates with the given randomness) so the right answer is not
 * always in the same place; options like "None of these" stay last in their own order. Marking
 * goes by the original position, so it never depends on where an option was shown.
 */
export function shuffledOptionOrder(options: readonly string[], rng: Rng): number[] {
  const free: number[] = [];
  const pinned: number[] = [];
  options.forEach((option, index) => (PINNED_LAST.test(option.trim()) ? pinned : free).push(index));
  for (let i = free.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [free[i], free[j]] = [free[j]!, free[i]!];
  }
  return [...free, ...pinned];
}
