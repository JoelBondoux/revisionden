import {
  rewardsOverview,
  StudentRewardsResponseSchema,
  type ParentReward,
  type StudentRewardsResponse,
} from '@revisionden/core';

/** A realistic rewards view built with the real core rules (Year 10, mid-November 2026). */
export function sampleRewards(over: Partial<StudentRewardsResponse> = {}): StudentRewardsResponse {
  const overview = rewardsOverview({
    stats: { level: 4, chapter2Xp: 1210, bestStreak: 5, correctAnswers: 80 },
    earnedIds: ['level-2', 'level-3', 'level-4', 'chapter-2-1', 'chapter-2-2', 'chapter-2-3'],
    totalRewardXp: 1100,
    yearGroup: 10,
    now: new Date('2026-11-24T12:00:00Z'),
    seasonProgress: { 'autumn-2-2026': 30 },
  });
  return StudentRewardsResponseSchema.parse({
    overview,
    newlyEarned: [],
    parentRewards: [],
    ...over,
  });
}

export const cinemaTrip: ParentReward = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Cinema trip',
  note: 'You pick the film',
  target: { kind: 'reward', rewardId: 'streak-100' },
  targetLabel: '100-day streak',
  reached: false,
  current: 5,
  goal: 100,
  givenAt: null,
};
