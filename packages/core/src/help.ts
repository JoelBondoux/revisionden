/**
 * "Need a clue?" then "Help me understand" (workstream F10, owner 2026-11-26; docs/PRODUCT_RULES.md
 * "Clues and help").
 *
 * - "Need a clue?" shows the item's verified hint, with no penalty. It is only offered when a
 *   verified hint exists.
 * - The button then becomes "Help me understand": the item's verified worked solution, one step
 *   at a time (the F7 Explain steps). With no hint but verified steps, it starts there.
 * - After help the student still has to answer. The answer is "helped": a right one earns half
 *   the XP (rounded down, owner), never a combo, and counts as wrong for practice: mastery,
 *   the review ladder and a wrong-answer flashcard.
 */

/** A right answer after "Help me understand" earns this share of the usual XP (owner). */
export const HELPED_XP_FACTOR = 0.5;

export function helpedXp(xp: number): number {
  return Math.floor(xp * HELPED_XP_FACTOR);
}

/** A helped answer counts as wrong for mastery. */
export function helpedMasteryScore(): number {
  return 0;
}

/** Which help button to show: the clue first, then help; null when there is nothing verified. */
export function helpButton(
  item: { hint?: string; canHelp?: boolean },
  clueShown: boolean,
): 'clue' | 'help' | null {
  if (item.hint && !clueShown) return 'clue';
  return item.canHelp ? 'help' : null;
}
