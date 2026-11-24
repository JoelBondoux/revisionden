/** The full rewards catalogue as data (see docs/REWARDS.md). */
import { CHAPTER_REWARDS } from './chapters';
import { COLLECTIONS, COLLECTION_REWARDS } from './collections';
import { LEVEL_REWARDS } from './levels';
import { MILESTONE_REWARDS } from './milestones';
import { SEASONS, SEASON_REWARDS } from './seasons';
import type { Reward } from './types';

export * from './types';
export * from './validate';
export { CHAPTER_REWARDS, COLLECTIONS, COLLECTION_REWARDS, LEVEL_REWARDS, MILESTONE_REWARDS };
export { SEASONS, SEASON_REWARDS };

export const REWARDS: readonly Reward[] = [
  ...MILESTONE_REWARDS,
  ...LEVEL_REWARDS,
  ...CHAPTER_REWARDS,
  ...COLLECTION_REWARDS,
  ...SEASON_REWARDS,
];
