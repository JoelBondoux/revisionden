/**
 * Rewards catalogue and evaluator (see docs/PRODUCT_RULES.md "Rewards (avatar unlocks)").
 *
 * Each reward has one unlock target: a stat that must reach a number. Every reward unlocks one
 * avatar item (see AVATAR_CATALOGUE in avatar.ts). Streak badges also come with gift days.
 */
export interface RewardStats {
  /** Longest streak ever, in days. */
  bestStreak: number;
  /** Mocks where the student hit their target grade. */
  mocksWithTargetHit: number;
  /** Assessments where the student hit every target. */
  assessmentsWithAllTargetsHit: number;
  fullPastPapers: number;
  /** Topics that were weak spots and are now at or above the weak-spot line. */
  weakSpotsFixed: number;
  topicsMastered: number;
  /** Sets with every question right (for example 5 out of 5). */
  perfectSets: number;
  daysGifted: number;
  /** Different friends the student has gifted a day to. */
  friendsGiftedTo: number;
  weeksTopOfLeague: number;
  startingTestsCompleted: number;
  /** Most answers right in a row. */
  bestCorrectRun: number;
}

export type RewardCategory =
  'streak' | 'grade' | 'practice' | 'friendship' | 'competition' | 'early_win';

export interface Reward {
  id: string;
  name: string;
  category: RewardCategory;
  target: { stat: keyof RewardStats; atLeast: number };
  /** Gift days that come with this reward (they can only be given to friends). */
  giftDays: number;
}

const reward = (
  id: string,
  name: string,
  category: RewardCategory,
  stat: keyof RewardStats,
  atLeast: number,
  giftDays = 0,
): Reward => ({ id, name, category, target: { stat, atLeast }, giftDays });

export const REWARDS: readonly Reward[] = [
  reward('streak-7', '7-day streak', 'streak', 'bestStreak', 7, 1),
  reward('streak-30', '30-day streak', 'streak', 'bestStreak', 30, 2),
  reward('streak-100', '100-day streak', 'streak', 'bestStreak', 100, 3),
  reward('mock-target-hit', 'Target grade in a mock', 'grade', 'mocksWithTargetHit', 1),
  reward(
    'assessment-all-targets',
    'Every target at an assessment',
    'grade',
    'assessmentsWithAllTargetsHit',
    1,
  ),
  reward('full-past-paper', 'Full past paper', 'practice', 'fullPastPapers', 1),
  reward('weak-spots-10', '10 weak spots fixed', 'practice', 'weakSpotsFixed', 10),
  reward('topics-mastered-10', '10 topics mastered', 'practice', 'topicsMastered', 10),
  reward('perfect-set', 'Perfect set', 'practice', 'perfectSets', 1),
  reward('gift-3-days', 'Gave 3 days', 'friendship', 'daysGifted', 3),
  reward('gift-5-friends', 'Gifted 5 friends', 'friendship', 'friendsGiftedTo', 5),
  reward('league-top', 'Top of the friends league', 'competition', 'weeksTopOfLeague', 1),
  reward('starting-test', 'Starting test done', 'early_win', 'startingTestsCompleted', 1),
  reward('correct-25-in-a-row', '25 right in a row', 'early_win', 'bestCorrectRun', 25),
];

const statValue = (stats: Partial<RewardStats>, stat: keyof RewardStats) => stats[stat] ?? 0;

/** Rewards the stats have now earned that are not already in `earnedIds`, in catalogue order. */
export function evaluateRewards(
  stats: Partial<RewardStats>,
  earnedIds: readonly string[],
  catalogue: readonly Reward[] = REWARDS,
): Reward[] {
  const earned = new Set(earnedIds);
  return catalogue.filter(
    (r) => !earned.has(r.id) && statValue(stats, r.target.stat) >= r.target.atLeast,
  );
}

export function giftDaysFor(rewards: readonly Reward[]): number {
  return rewards.reduce((sum, r) => sum + r.giftDays, 0);
}

/** How far along a reward the student is, for "locked" labels in the avatar builder. */
export function rewardProgress(
  reward: Reward,
  stats: Partial<RewardStats>,
): { current: number; target: number } {
  const target = reward.target.atLeast;
  return { current: Math.min(target, statValue(stats, reward.target.stat)), target };
}
