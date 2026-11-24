import { describe, expect, it } from 'vitest';
import { AVATAR_CATALOGUE, AVATAR_LAYERS } from './avatar';
import { REWARDS, evaluateRewards, giftDaysFor, rewardProgress, type RewardStats } from './rewards';

const ids = (stats: Partial<RewardStats>, earned: string[] = []) =>
  evaluateRewards(stats, earned).map((r) => r.id);

describe('rewards catalogue', () => {
  it('covers every agreed target type', () => {
    expect(REWARDS.map((r) => [r.id, r.category, r.target.stat, r.target.atLeast])).toEqual([
      ['streak-7', 'streak', 'bestStreak', 7],
      ['streak-30', 'streak', 'bestStreak', 30],
      ['streak-100', 'streak', 'bestStreak', 100],
      ['mock-target-hit', 'grade', 'mocksWithTargetHit', 1],
      ['assessment-all-targets', 'grade', 'assessmentsWithAllTargetsHit', 1],
      ['full-past-paper', 'practice', 'fullPastPapers', 1],
      ['weak-spots-10', 'practice', 'weakSpotsFixed', 10],
      ['topics-mastered-10', 'practice', 'topicsMastered', 10],
      ['perfect-set', 'practice', 'perfectSets', 1],
      ['gift-3-days', 'friendship', 'daysGifted', 3],
      ['gift-5-friends', 'friendship', 'friendsGiftedTo', 5],
      ['league-top', 'competition', 'weeksTopOfLeague', 1],
      ['starting-test', 'early_win', 'startingTestsCompleted', 1],
      ['correct-25-in-a-row', 'early_win', 'bestCorrectRun', 25],
    ]);
  });

  it('links every reward to an avatar item, and every locked item to a real reward', () => {
    const lockedBy = AVATAR_LAYERS.flatMap((layer) =>
      AVATAR_CATALOGUE[layer].flatMap((item) => (item.unlockedBy ? [item.unlockedBy] : [])),
    );
    expect([...new Set(lockedBy)].sort()).toEqual(REWARDS.map((r) => r.id).sort());
  });

  it('unlocks one item per reward, except the 100-day streak, which unlocks two', () => {
    const counts = new Map<string, number>();
    for (const layer of AVATAR_LAYERS) {
      for (const item of AVATAR_CATALOGUE[layer]) {
        if (item.unlockedBy) counts.set(item.unlockedBy, (counts.get(item.unlockedBy) ?? 0) + 1);
      }
    }
    for (const r of REWARDS) expect(counts.get(r.id)).toBe(r.id === 'streak-100' ? 2 : 1);
  });

  it('gives gift days with streak badges', () => {
    expect(giftDaysFor(REWARDS.filter((r) => r.category === 'streak'))).toBe(6);
    expect(giftDaysFor(REWARDS.filter((r) => r.category !== 'streak'))).toBe(0);
  });
});

describe('evaluateRewards', () => {
  it('unlocks streak rewards at 7, 30 and 100 days', () => {
    expect(ids({ bestStreak: 6 })).toEqual([]);
    expect(ids({ bestStreak: 7 })).toEqual(['streak-7']);
    expect(ids({ bestStreak: 30 }, ['streak-7'])).toEqual(['streak-30']);
    expect(ids({ bestStreak: 100 }, ['streak-7', 'streak-30'])).toEqual(['streak-100']);
  });

  it('unlocks grade rewards for a target hit in a mock and every target at an assessment', () => {
    expect(ids({ mocksWithTargetHit: 1 })).toEqual(['mock-target-hit']);
    expect(ids({ assessmentsWithAllTargetsHit: 1 })).toEqual(['assessment-all-targets']);
  });

  it('unlocks practice rewards', () => {
    expect(ids({ fullPastPapers: 1 })).toEqual(['full-past-paper']);
    expect(ids({ weakSpotsFixed: 9 })).toEqual([]);
    expect(ids({ weakSpotsFixed: 10 })).toEqual(['weak-spots-10']);
    expect(ids({ topicsMastered: 10 })).toEqual(['topics-mastered-10']);
    expect(ids({ perfectSets: 1 })).toEqual(['perfect-set']);
  });

  it('unlocks friendship rewards for gifting 3 days and gifting to 5 different friends', () => {
    expect(ids({ daysGifted: 3, friendsGiftedTo: 1 })).toEqual(['gift-3-days']);
    expect(ids({ daysGifted: 5, friendsGiftedTo: 5 }, ['gift-3-days'])).toEqual(['gift-5-friends']);
  });

  it('unlocks the competition reward for a week at the top of the friends league', () => {
    expect(ids({ weeksTopOfLeague: 1 })).toEqual(['league-top']);
  });

  it('unlocks easy early wins', () => {
    expect(ids({ startingTestsCompleted: 1 })).toEqual(['starting-test']);
    expect(ids({ bestCorrectRun: 24 })).toEqual([]);
    expect(ids({ bestCorrectRun: 25 })).toEqual(['correct-25-in-a-row']);
  });

  it('returns several rewards at once and never one already earned', () => {
    expect(ids({ bestStreak: 40, perfectSets: 2 })).toEqual([
      'streak-7',
      'streak-30',
      'perfect-set',
    ]);
    expect(ids({ bestStreak: 40 }, ['streak-7', 'streak-30'])).toEqual([]);
  });
});

describe('rewardProgress', () => {
  it('shows how close the student is, capped at the target', () => {
    const streak30 = REWARDS.find((r) => r.id === 'streak-30')!;
    expect(rewardProgress(streak30, { bestStreak: 12 })).toEqual({ current: 12, target: 30 });
    expect(rewardProgress(streak30, { bestStreak: 45 })).toEqual({ current: 30, target: 30 });
    expect(rewardProgress(streak30, {})).toEqual({ current: 0, target: 30 });
  });
});
