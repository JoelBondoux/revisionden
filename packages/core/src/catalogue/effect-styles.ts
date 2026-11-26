/**
 * Effect styles as rewards (J10b, docs/GAME_FEEL.md "Effect styles"). Each style comes with a
 * reward that already exists, tied to learning progress (levels and topics mastered): never
 * bought, never random, never tied to a streak. Children who already earned one have its style
 * straight away.
 */
import type { Reward } from './types';

/**
 * The owner's ladder (2026-11-26), spread across the five years so there is always a next one.
 * Sticker Book is listed for when Doodle Diary becomes the free default; until then the web app
 * treats Sticker Book as everyone's default.
 */
export const EFFECT_STYLE_UNLOCKS: readonly { style: string; rewardId: string }[] = [
  { style: 'sticker-book', rewardId: 'level-3' },
  { style: 'pop-burst', rewardId: 'level-5' },
  { style: 'garden-grow', rewardId: 'subject-topics-5' },
  { style: 'starlight', rewardId: 'topics-mastered-10' },
  { style: 'comic-pop', rewardId: 'level-20' },
  { style: 'pixel-arcade', rewardId: 'level-40' },
  // J16 (U7, owner-approved 2026-11-26): unlocked together by finishing the starting test.
  { style: 'petal-glow', rewardId: 'starting-test' },
  { style: 'turbo-drive', rewardId: 'starting-test' },
  { style: 'rainbow-parade', rewardId: 'starting-test' },
];

/** Adds each effect style to the reward that unlocks it. */
export function withEffectStyles(rewards: readonly Reward[]): Reward[] {
  return rewards.map((r) => {
    const styles = EFFECT_STYLE_UNLOCKS.filter((u) => u.rewardId === r.id);
    if (styles.length === 0) return r;
    return {
      ...r,
      items: [...r.items, ...styles.map((u) => ({ kind: 'effectStyle' as const, id: u.style }))],
    };
  });
}

/** The effect styles unlocked by these earned reward ids. */
export function effectStylesFor(earnedIds: readonly string[]): string[] {
  const earned = new Set(earnedIds);
  return EFFECT_STYLE_UNLOCKS.filter((u) => earned.has(u.rewardId)).map((u) => u.style);
}
