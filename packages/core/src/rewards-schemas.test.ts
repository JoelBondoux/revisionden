import { describe, expect, it } from 'vitest';
import {
  CreateParentRewardRequestSchema,
  RewardsOverviewSchema,
  parentRewardProgress,
  parentTargetLabel,
} from './rewards-schemas';
import { REWARD_STAT_KEYS, rewardsOverview } from './rewards';

describe('CreateParentRewardRequestSchema', () => {
  it('accepts a reward tied to a catalogue reward or to a stat target', () => {
    expect(
      CreateParentRewardRequestSchema.parse({
        title: '  Cinema trip ',
        target: { kind: 'reward', rewardId: 'streak-100' },
      }),
    ).toEqual({ title: 'Cinema trip', target: { kind: 'reward', rewardId: 'streak-100' } });
    expect(
      CreateParentRewardRequestSchema.safeParse({
        title: 'New game',
        target: { kind: 'stat', stat: 'level', atLeast: 20 },
      }).success,
    ).toBe(true);
  });

  it('rejects unknown rewards, unknown stats, unreachable targets, and long or empty titles', () => {
    const bad = [
      { title: 'x', target: { kind: 'reward', rewardId: 'made-up' } },
      { title: 'x', target: { kind: 'stat', stat: 'minutesSpent', atLeast: 10 } },
      { title: 'x', target: { kind: 'stat', stat: 'level', atLeast: 101 } },
      { title: 'x', target: { kind: 'stat', stat: 'level', atLeast: 0 } },
      { title: ' ', target: { kind: 'reward', rewardId: 'streak-7' } },
      { title: 'a'.repeat(61), target: { kind: 'reward', rewardId: 'streak-7' } },
      { title: 'x', target: { kind: 'reward', rewardId: 'streak-7' }, extra: 1 },
    ];
    for (const body of bad)
      expect(CreateParentRewardRequestSchema.safeParse(body).success).toBe(false);
  });
});

describe('parentRewardProgress', () => {
  it('is reached when the catalogue reward is earned', () => {
    const target = { kind: 'reward', rewardId: 'streak-30' } as const;
    expect(parentRewardProgress(target, { bestStreak: 12 }, [])).toEqual({
      reached: false,
      current: 12,
      target: 30,
    });
    expect(parentRewardProgress(target, {}, ['streak-30'])).toMatchObject({ reached: true });
  });

  it('is reached when the stat gets to the number', () => {
    const target = { kind: 'stat', stat: 'level', atLeast: 20 } as const;
    expect(parentRewardProgress(target, { level: 21 }, [])).toEqual({
      reached: true,
      current: 20,
      target: 20,
    });
    expect(parentRewardProgress(target, {}, [])).toEqual({
      reached: false,
      current: 0,
      target: 20,
    });
  });

  it('treats a reward that left the catalogue as not reached', () => {
    expect(parentRewardProgress({ kind: 'reward', rewardId: 'gone' }, {}, [])).toEqual({
      reached: false,
      current: 0,
      target: 1,
    });
  });
});

describe('RewardsOverviewSchema', () => {
  it('matches what rewardsOverview returns', () => {
    const view = rewardsOverview({
      stats: { level: 2 },
      earnedIds: ['level-2'],
      totalRewardXp: 400,
      yearGroup: 11,
      now: new Date('2026-11-24T12:00:00Z'),
    });
    expect(RewardsOverviewSchema.parse(view)).toEqual(view);
  });
});

describe('parentTargetLabel', () => {
  it('names a catalogue reward or a stat target in words', () => {
    expect(parentTargetLabel({ kind: 'reward', rewardId: 'streak-100' })).toBe('100-day streak');
    expect(parentTargetLabel({ kind: 'reward', rewardId: 'gone' })).toBe('gone');
    expect(parentTargetLabel({ kind: 'stat', stat: 'level', atLeast: 20 })).toBe('Level 20');
    expect(parentTargetLabel({ kind: 'stat', stat: 'bestStreak', atLeast: 50 })).toBe(
      '50-day streak',
    );
    expect(parentTargetLabel({ kind: 'stat', stat: 'chapter2Xp', atLeast: 400 })).toBe(
      '400 chapter 2 XP',
    );
  });

  it('has words for every stat', () => {
    for (const stat of REWARD_STAT_KEYS) {
      expect(parentTargetLabel({ kind: 'stat', stat, atLeast: 1 })).not.toContain(stat);
    }
  });
});
