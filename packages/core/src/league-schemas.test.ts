import { describe, expect, it } from 'vitest';
import { LeagueResponseSchema, StudentFriendsResponseSchema, ordinal } from './league-schemas';

describe('league shapes', () => {
  it('refuse anything about another child beyond nickname, avatar and title', () => {
    const parsed = StudentFriendsResponseSchema.parse({
      allowed: true,
      hidden: false,
      friends: [
        {
          id: 'x',
          nickname: 'Nova_7',
          avatarCode: 'a',
          title: null,
          sibling: false,
          yearGroup: 10,
        },
      ],
      waiting: [],
    });
    expect(parsed.friends[0]).not.toHaveProperty('yearGroup');
  });

  it('accept a league with places and no place yet', () => {
    expect(
      LeagueResponseSchema.parse({
        week: { start: '2026-11-23', end: '2026-11-29' },
        hidden: false,
        lastWeek: { xp: 120, place: 1, won: true },
        entries: [
          {
            nickname: 'A',
            avatarCode: 'a',
            title: 'Cosmic Scholar',
            xp: 90,
            place: 1,
            winning: true,
            you: true,
          },
          {
            nickname: 'B',
            avatarCode: 'b',
            title: null,
            xp: 0,
            place: null,
            winning: false,
            you: false,
          },
        ],
      }).entries,
    ).toHaveLength(2);
  });
});

describe('ordinal', () => {
  it('says 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st and 22nd', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
    ]);
  });
});
