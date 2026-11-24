import { describe, expect, it } from 'vitest';
import {
  earnGiftDays,
  giftDay,
  newStreak,
  recordDay,
  settleWeek,
  type StreakState,
} from './streaks';

const met = (date: string) => ({ date, goalMet: true });
const missed = (date: string) => ({ date, goalMet: false });

function play(state: StreakState, days: { date: string; goalMet: boolean }[]) {
  return days.reduce((s, day) => recordDay(s, day).state, state);
}

describe('recordDay', () => {
  it('adds a streak day when the daily goal is met', () => {
    const state = play(newStreak(), [met('2026-11-01'), met('2026-11-02'), met('2026-11-03')]);
    expect(state.current).toBe(3);
    expect(state.best).toBe(3);
  });

  it('breaks the streak on a missed day with no skip days', () => {
    const state = play(newStreak(), [met('2026-11-01'), met('2026-11-02')]);
    const { state: after, events } = recordDay(state, missed('2026-11-03'));
    expect(after.current).toBe(0);
    expect(after.best).toBe(2);
    expect(events).toEqual([
      { date: '2026-11-03', outcome: 'streak_broken', reason: 'no_skip_days' },
    ]);
  });

  it('uses a skip day to protect the streak without adding to it', () => {
    const state = { ...play(newStreak(), [met('2026-11-01')]), skipDays: 1 };
    const { state: after, events } = recordDay(state, missed('2026-11-02'));
    expect(after.current).toBe(1);
    expect(after.skipDays).toBe(0);
    expect(events).toEqual([{ date: '2026-11-02', outcome: 'skip_used' }]);
  });

  it('refuses a third skip day in a row', () => {
    const state = { ...play(newStreak(), [met('2026-11-01')]), skipDays: 3 };
    const after2 = play(state, [missed('2026-11-02'), missed('2026-11-03')]);
    expect(after2.current).toBe(1);
    const { state: after3, events } = recordDay(after2, missed('2026-11-04'));
    expect(after3.current).toBe(0);
    expect(after3.skipDays).toBe(1);
    expect(events[0]).toEqual({
      date: '2026-11-04',
      outcome: 'streak_broken',
      reason: 'skip_limit',
    });
  });

  it('allows skips again after a day with the goal met', () => {
    const state = { ...play(newStreak(), [met('2026-11-01')]), skipDays: 4 };
    const after = play(state, [
      missed('2026-11-02'),
      missed('2026-11-03'),
      met('2026-11-04'),
      missed('2026-11-05'),
      missed('2026-11-06'),
    ]);
    expect(after.current).toBe(2);
    expect(after.skipDays).toBe(0);
  });

  it('never uses gift days on the student’s own streak', () => {
    const state = { ...play(newStreak(), [met('2026-11-01')]), giftDays: 5 };
    const { state: after } = recordDay(state, missed('2026-11-02'));
    expect(after.current).toBe(0);
    expect(after.giftDays).toBe(5);
  });

  it('counts days with no activity at all as missed', () => {
    const state = { ...play(newStreak(), [met('2026-11-01')]), skipDays: 1 };
    const { state: after, events } = recordDay(state, met('2026-11-04'));
    expect(events.map((e) => e.outcome)).toEqual(['skip_used', 'streak_broken', 'goal_met']);
    expect(after.current).toBe(1);
  });

  it('works across month ends', () => {
    const state = play(newStreak(), [met('2026-11-30'), met('2026-12-01')]);
    expect(state.current).toBe(2);
  });

  it('refuses a day that is not after the last one recorded, or a bad date', () => {
    const state = play(newStreak(), [met('2026-11-02')]);
    expect(() => recordDay(state, met('2026-11-02'))).toThrow(/after/);
    expect(() => recordDay(state, met('02/11/2026'))).toThrow(/date/);
  });
});

describe('settleWeek', () => {
  it('earns a skip day when the weekly goal is hit', () => {
    const state = settleWeek(newStreak(), { weekStart: '2026-11-02', daysGoalMet: 5 });
    expect(state.skipDays).toBe(1);
  });

  it('earns nothing when the weekly goal is missed', () => {
    expect(settleWeek(newStreak(), { weekStart: '2026-11-02', daysGoalMet: 4 }).skipDays).toBe(0);
    expect(
      settleWeek(newStreak(), { weekStart: '2026-11-02', daysGoalMet: 3, targetDays: 3 }).skipDays,
    ).toBe(1);
  });

  it('only pays out once per week', () => {
    let state = settleWeek(newStreak(), { weekStart: '2026-11-02', daysGoalMet: 7 });
    state = settleWeek(state, { weekStart: '2026-11-02', daysGoalMet: 7 });
    expect(state.skipDays).toBe(1);
    state = settleWeek(state, { weekStart: '2026-11-09', daysGoalMet: 7 });
    expect(state.skipDays).toBe(2);
  });
});

describe('gift days', () => {
  const giver = earnGiftDays(newStreak(), 2);
  const receiver = newStreak();

  it('come with rewards', () => {
    expect(giver.giftDays).toBe(2);
  });

  it('can be given to a friend, who gets a skip day, and the giver earns 20 XP', () => {
    const result = giftDay({ giverId: 'a', receiverId: 'b', areFriends: true, giver, receiver });
    expect(result).toEqual({
      ok: true,
      giver: { ...giver, giftDays: 1 },
      receiver: { ...receiver, skipDays: 1 },
      xpEarned: 20,
    });
  });

  it('cannot be applied to the student’s own streak', () => {
    expect(
      giftDay({ giverId: 'a', receiverId: 'a', areFriends: true, giver, receiver: giver }),
    ).toEqual({
      ok: false,
      reason: 'own_streak',
    });
  });

  it('can only go to a friend', () => {
    expect(giftDay({ giverId: 'a', receiverId: 'b', areFriends: false, giver, receiver })).toEqual({
      ok: false,
      reason: 'not_friends',
    });
  });

  it('needs a gift day to give', () => {
    expect(
      giftDay({ giverId: 'a', receiverId: 'b', areFriends: true, giver: newStreak(), receiver }),
    ).toEqual({ ok: false, reason: 'no_gift_days' });
  });
});
