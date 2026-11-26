/**
 * Effect styles as rewards (J10b, docs/GAME_FEEL.md "Effect styles"). Sticker Book is everyone's
 * default and never a reward. Pop Burst and Starlight come with two rewards that already exist,
 * tied to learning progress (reaching level 5; mastering 10 topics): never bought, never random,
 * never tied to a streak. Children who already earned those rewards have the styles straight away.
 */
import type { Reward } from './types';

export const EFFECT_STYLE_UNLOCKS: readonly { style: string; rewardId: string }[] = [
  { style: 'pop-burst', rewardId: 'level-5' },
  { style: 'starlight', rewardId: 'topics-mastered-10' },
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
