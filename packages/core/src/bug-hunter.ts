/**
 * Bug Hunter rewards (docs/REWARDS.md, "Bug Hunter track"). The operator confirms a bug report;
 * this decides what the sender earns. The track items themselves live in the reward catalogue.
 */
export const BUG_REWARD_XP = 50;
export const DUPLICATE_BUG_XP = 10;
/** Confirmed-bug rewards (full or duplicate) a student can earn in one week (Monday to Sunday). */
export const MAX_BUG_REWARDS_PER_WEEK = 3;

export interface BugRewardInput {
  senderRole: 'student' | 'parent';
  /** A duplicate of a bug already confirmed for someone else. */
  duplicate: boolean;
  /** Rewards this student already earned for confirmed bugs this week. */
  rewardsThisWeek: number;
  /** L13: a tester account (set in the operator console): the outcome counts, no reward. */
  tester?: boolean;
}

export interface BugReward {
  xp: number;
  /** Moves the student one step along the Bug Hunter track. */
  trackStep: boolean;
  /** Shown to the sender in the app. */
  message: string;
}

export function bugReward({
  senderRole,
  duplicate,
  rewardsThisWeek,
  tester = false,
}: BugRewardInput): BugReward {
  if (senderRole === 'parent') {
    return { xp: 0, trackStep: false, message: 'Thank you for reporting this bug.' };
  }
  if (tester) {
    return {
      xp: 0,
      trackStep: false,
      message: 'Thanks, tester! This bug is confirmed (tester accounts earn no rewards).',
    };
  }
  if (rewardsThisWeek >= MAX_BUG_REWARDS_PER_WEEK) {
    return { xp: 0, trackStep: false, message: 'Your bug report helped! Thank you.' };
  }
  if (duplicate) {
    return {
      xp: DUPLICATE_BUG_XP,
      trackStep: false,
      message: `Thanks for confirming that bug! +${DUPLICATE_BUG_XP} XP`,
    };
  }
  return {
    xp: BUG_REWARD_XP,
    trackStep: true,
    message: `Your bug report helped! +${BUG_REWARD_XP} XP`,
  };
}
