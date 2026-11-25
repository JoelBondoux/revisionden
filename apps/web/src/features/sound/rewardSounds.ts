/**
 * Which reward sound to play (docs/PRODUCT_RULES.md "Reward sounds grow with the reward").
 * Reads R's reward catalogue in packages/core; never changes it.
 */
import { RARITIES, REWARDS, type Rarity, type Reward } from '@revisionden/core';

export type RewardTier = Rarity;
export const REWARD_TIERS: readonly RewardTier[] = RARITIES;

/** At least 4 per tier; the same one never plays twice in a row. */
export const VARIATIONS_PER_TIER = 4;

export type RewardVoice =
  'standard' | 'chapter1' | 'chapter2' | 'chapter3' | 'chapter4' | 'chapter5';

export interface RewardSoundSpec {
  tier: RewardTier;
  /** Ladder or level step: each one sounds a step higher and fuller (0 = first). */
  step: number;
  /** Synth voice: each year chapter has its own. */
  voice: RewardVoice;
  /** The GCSE and A-Level finisher sets get their own fanfares. */
  fanfare: 'gcse' | 'aLevel' | null;
}

/** What a feature knows about an earned reward (a reward card from the API is enough). */
export interface EarnedReward {
  id: string;
  rarity: Rarity;
}

const BY_ID = new Map(REWARDS.map((r) => [r.id, r]));

/** For each milestone stat, its rewards' thresholds in order (the ladder). */
const LADDERS = new Map<string, number[]>();
for (const r of REWARDS) {
  if (r.source !== 'milestone' || r.target.kind !== 'stat') continue;
  const steps = LADDERS.get(r.target.stat) ?? [];
  steps.push(r.target.atLeast);
  LADDERS.set(r.target.stat, steps);
}
for (const steps of LADDERS.values()) steps.sort((a, b) => a - b);

function ladderStep(reward: Reward | undefined): number {
  if (!reward || reward.source !== 'milestone' || reward.target.kind !== 'stat') return 0;
  const { stat, atLeast } = reward.target;
  return Math.max(0, LADDERS.get(stat)?.indexOf(atLeast) ?? 0);
}

function finisher(reward: Reward | undefined): RewardSoundSpec['fanfare'] {
  if (reward?.source !== 'chapter' || reward.target.kind !== 'stat') return null;
  if (reward.target.stat === 'gcseFinished') return 'gcse';
  if (reward.target.stat === 'aLevelFinished') return 'aLevel';
  return null;
}

/** The sound for one earned reward: tier from its rarity, plus ladder step, voice and fanfare. */
export function rewardSoundSpec(earned: EarnedReward): RewardSoundSpec {
  const reward = BY_ID.get(earned.id);
  const level = /^level-(\d+)$/.exec(earned.id);
  const prestige = /^prestige-(\d+)$/.exec(earned.id);
  const chapter = /^chapter-([1-5])-/.exec(earned.id);
  if (prestige) {
    return { tier: 'legendary', step: Number(prestige[1]) - 1, voice: 'standard', fanfare: null };
  }
  return {
    tier: earned.rarity,
    // The level-up sound rises gently every 10 levels.
    step: level ? Math.floor(Number(level[1]) / 10) : ladderStep(reward),
    voice: chapter ? (`chapter${chapter[1]}` as RewardVoice) : 'standard',
    fanfare: finisher(reward),
  };
}

const rank = (e: EarnedReward) => {
  const s = rewardSoundSpec(e);
  return REWARD_TIERS.indexOf(s.tier) * 1000 + (s.fanfare ? 500 : 0) + s.step;
};

/** Several rewards at once play only the biggest one. */
export function biggestReward<T extends EarnedReward>(rewards: readonly T[]): T | null {
  let best: T | null = null;
  for (const r of rewards) if (!best || rank(r) > rank(best)) best = r;
  return best;
}

/** A random variation, never the one played last time. `random` returns [0, 1). */
export function pickVariation(count: number, last: number | null, random: () => number): number {
  if (last === null || count < 2) return Math.min(count - 1, Math.floor(random() * count));
  const pick = Math.min(count - 2, Math.floor(random() * (count - 1)));
  return pick >= last ? pick + 1 : pick;
}
