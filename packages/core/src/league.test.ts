import { describe, expect, it } from 'vitest';
import {
  FRIEND_CODE_LENGTH,
  MAX_FRIENDS,
  WIN_MIN_XP,
  formatFriendCode,
  leagueWeek,
  leagueWeekEndsAt,
  previousLeagueWeeks,
  leagueXp,
  newFriendCode,
  normaliseFriendCode,
  rankLeague,
  validFriendLabel,
} from './league';

const at = (iso: string) => new Date(iso);

describe('the league week', () => {
  it('runs Monday to Sunday in UK time', () => {
    // Wednesday 26 November 2026.
    expect(leagueWeek(at('2026-11-26T12:00:00Z'))).toEqual({
      start: '2026-11-23',
      end: '2026-11-29',
    });
  });

  it('starts at midnight UK time, not UTC, in summer time', () => {
    // 23:30 UTC on Sunday 28 June 2026 is 00:30 on Monday 29 June in London.
    expect(leagueWeek(at('2026-06-28T23:30:00Z')).start).toBe('2026-06-29');
  });
});

describe('league XP', () => {
  const week = { start: '2026-11-23', end: '2026-11-29' };

  it('adds up reward XP from this week only', () => {
    const events = [
      { at: at('2026-11-22T12:00:00Z'), xp: 40 }, // last Sunday
      { at: at('2026-11-23T09:00:00Z'), xp: 30 },
      { at: at('2026-11-25T16:00:00Z'), xp: 20 },
    ];
    expect(leagueXp(events, week)).toBe(50);
  });

  it('keeps the reward caps: nothing late at night and at most 300 a day', () => {
    const events = [
      { at: at('2026-11-24T22:30:00Z'), xp: 100 }, // late night
      { at: at('2026-11-25T10:00:00Z'), xp: 250 },
      { at: at('2026-11-25T11:00:00Z'), xp: 250 },
    ];
    expect(leagueXp(events, week)).toBe(300);
  });

  it('can stop before a given day, so friends see only finished days', () => {
    const events = [
      { at: at('2026-11-24T10:00:00Z'), xp: 30 },
      { at: at('2026-11-26T10:00:00Z'), xp: 70 }, // today
    ];
    expect(leagueXp(events, week, { before: '2026-11-26' })).toBe(30);
  });
});

describe('places in the league', () => {
  it('orders by XP and shares a place on equal XP', () => {
    const ranked = rankLeague([
      { id: 'a', xp: 120 },
      { id: 'b', xp: 300 },
      { id: 'c', xp: 120 },
      { id: 'd', xp: 40 },
    ]);
    expect(ranked.map((r) => [r.id, r.place])).toEqual([
      ['b', 1],
      ['a', 2],
      ['c', 2],
      ['d', 4],
    ]);
  });

  it('lists people with no XP last without a place, so nobody is shown as last', () => {
    const ranked = rankLeague([
      { id: 'a', xp: 0 },
      { id: 'b', xp: 60 },
    ]);
    expect(ranked).toEqual([
      // Not a win: nobody else has XP yet.
      { id: 'b', xp: 60, place: 1, winning: false },
      { id: 'a', xp: 0, place: null, winning: false },
    ]);
  });

  it('marks a winner only with at least one daily goal of XP', () => {
    const ranked = rankLeague([
      { id: 'a', xp: WIN_MIN_XP - 1 },
      { id: 'b', xp: 10 },
    ]);
    expect(ranked.some((r) => r.winning)).toBe(false);
  });

  it('needs someone else with XP, so a league of one cannot be won', () => {
    expect(rankLeague([{ id: 'a', xp: 500 }])[0]!.winning).toBe(false);
    expect(
      rankLeague([
        { id: 'a', xp: 500 },
        { id: 'b', xp: 0 },
      ])[0]!.winning,
    ).toBe(false);
  });

  it('lets a tie for first share the win', () => {
    const ranked = rankLeague([
      { id: 'a', xp: 200 },
      { id: 'b', xp: 200 },
      { id: 'c', xp: 90 },
    ]);
    expect(ranked.filter((r) => r.winning).map((r) => r.id)).toEqual(['a', 'b']);
  });
});

describe('friend codes', () => {
  it('are 8 easy-to-read characters, shown in two halves', () => {
    const code = newFriendCode(() => Uint8Array.from({ length: 8 }, (_, i) => i * 7));
    expect(code).toMatch(/^[A-HJ-KM-NP-Z2-9]{8}$/);
    expect(code).toHaveLength(FRIEND_CODE_LENGTH);
    expect(formatFriendCode('ABCD2345')).toBe('ABCD-2345');
  });

  it('accept lower case, spaces and the dash when typed', () => {
    expect(normaliseFriendCode(' abcd-2345 ')).toBe('ABCD2345');
  });
});

describe('a parent label for a friend', () => {
  it('is short plain text', () => {
    expect(validFriendLabel('from football')).toBe(true);
    expect(validFriendLabel('')).toBe(false);
    expect(validFriendLabel('x'.repeat(31))).toBe(false);
    expect(validFriendLabel('line\nbreak')).toBe(false);
  });
});

it('caps friends at 10', () => {
  expect(MAX_FRIENDS).toBe(10);
});

describe('earlier weeks to settle', () => {
  it('lists the finished weeks before this one, most recent first', () => {
    expect(previousLeagueWeeks(at('2026-11-26T12:00:00Z'), 2)).toEqual([
      { start: '2026-11-16', end: '2026-11-22' },
      { start: '2026-11-09', end: '2026-11-15' },
    ]);
  });

  it('gives the moment a week ends in UK time, for "friends by then"', () => {
    // Sunday 22 November 2026 ends at midnight GMT.
    expect(leagueWeekEndsAt({ start: '2026-11-16', end: '2026-11-22' }).toISOString()).toBe(
      '2026-11-23T00:00:00.000Z',
    );
    // In summer time it ends at 23:00 UTC on the Sunday.
    expect(leagueWeekEndsAt({ start: '2026-06-22', end: '2026-06-28' }).toISOString()).toBe(
      '2026-06-28T23:00:00.000Z',
    );
  });
});
