import { describe, expect, it } from 'vitest';
import { DAILY_REWARD_XP_CAP, isLateNight, rewardableXp, rewardableXpByDay } from './reward-xp';

// November is GMT, so UK time equals UTC; July is BST (UTC + 1).
const at = (iso: string) => new Date(iso);

describe('late night study never counts towards rewards', () => {
  it('treats 22:00 to 05:59 UK time as late night', () => {
    expect(isLateNight(at('2026-11-24T21:59:00Z'))).toBe(false);
    expect(isLateNight(at('2026-11-24T22:00:00Z'))).toBe(true);
    expect(isLateNight(at('2026-11-25T03:00:00Z'))).toBe(true);
    expect(isLateNight(at('2026-11-25T05:59:00Z'))).toBe(true);
    expect(isLateNight(at('2026-11-25T06:00:00Z'))).toBe(false);
  });

  it('uses UK time in summer, not UTC', () => {
    // 21:30 UTC is 22:30 BST: late night.
    expect(isLateNight(at('2027-07-01T21:30:00Z'))).toBe(true);
    // 05:30 UTC is 06:30 BST: fine.
    expect(isLateNight(at('2027-07-01T05:30:00Z'))).toBe(false);
  });

  it('drops late-night XP from reward XP', () => {
    expect(
      rewardableXp([
        { at: at('2026-11-24T17:00:00Z'), xp: 40 },
        { at: at('2026-11-24T23:30:00Z'), xp: 100 },
      ]),
    ).toBe(40);
  });
});

describe('daily reward XP cap', () => {
  it('counts at most the cap per UK day towards rewards', () => {
    const events = [
      { at: at('2026-11-24T10:00:00Z'), xp: DAILY_REWARD_XP_CAP - 10 },
      { at: at('2026-11-24T11:00:00Z'), xp: 50 },
      { at: at('2026-11-25T10:00:00Z'), xp: 30 },
    ];
    expect(rewardableXpByDay(events)).toEqual([
      { day: '2026-11-24', xp: DAILY_REWARD_XP_CAP },
      { day: '2026-11-25', xp: 30 },
    ]);
    expect(rewardableXp(events)).toBe(DAILY_REWARD_XP_CAP + 30);
  });

  it('sorts days and ignores zero or negative XP', () => {
    expect(
      rewardableXpByDay([
        { at: at('2026-11-26T10:00:00Z'), xp: 10 },
        { at: at('2026-11-24T10:00:00Z'), xp: 0 },
        { at: at('2026-11-25T10:00:00Z'), xp: -5 },
        { at: at('2026-11-25T12:00:00Z'), xp: 5 },
      ]),
    ).toEqual([
      { day: '2026-11-25', xp: 5 },
      { day: '2026-11-26', xp: 10 },
    ]);
  });

  it('is generous enough that a normal day is never capped', () => {
    expect(DAILY_REWARD_XP_CAP).toBeGreaterThanOrEqual(5 * 50);
  });
});
