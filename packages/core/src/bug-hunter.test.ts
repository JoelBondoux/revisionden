import { describe, expect, it } from 'vitest';
import { BUG_REWARD_XP, DUPLICATE_BUG_XP, MAX_BUG_REWARDS_PER_WEEK, bugReward } from './bug-hunter';

describe('bugReward', () => {
  it('gives a student +50 XP and a Bug Hunter step for a confirmed bug', () => {
    expect(BUG_REWARD_XP).toBe(50);
    expect(bugReward({ senderRole: 'student', duplicate: false, rewardsThisWeek: 0 })).toEqual({
      xp: 50,
      trackStep: true,
      message: 'Your bug report helped! +50 XP',
    });
  });

  it('gives +10 XP and no track step for a duplicate of a bug already confirmed', () => {
    expect(DUPLICATE_BUG_XP).toBe(10);
    expect(bugReward({ senderRole: 'student', duplicate: true, rewardsThisWeek: 1 })).toEqual({
      xp: 10,
      trackStep: false,
      message: 'Thanks for confirming that bug! +10 XP',
    });
  });

  it('thanks the student without a reward after 3 rewards in the same week', () => {
    expect(MAX_BUG_REWARDS_PER_WEEK).toBe(3);
    expect(bugReward({ senderRole: 'student', duplicate: false, rewardsThisWeek: 3 })).toEqual({
      xp: 0,
      trackStep: false,
      message: 'Your bug report helped! Thank you.',
    });
    expect(bugReward({ senderRole: 'student', duplicate: true, rewardsThisWeek: 3 }).xp).toBe(0);
  });

  it('thanks parents but never rewards them', () => {
    expect(bugReward({ senderRole: 'parent', duplicate: false, rewardsThisWeek: 0 })).toEqual({
      xp: 0,
      trackStep: false,
      message: 'Thank you for reporting this bug.',
    });
  });

  it('records a tester account report as helped, with no XP and no track step (L13)', () => {
    expect(
      bugReward({ senderRole: 'student', duplicate: false, rewardsThisWeek: 0, tester: true }),
    ).toEqual({
      xp: 0,
      trackStep: false,
      message: 'Thanks, tester! This bug is confirmed (tester accounts earn no rewards).',
    });
    expect(
      bugReward({ senderRole: 'student', duplicate: true, rewardsThisWeek: 0, tester: true }).xp,
    ).toBe(0);
  });
});
