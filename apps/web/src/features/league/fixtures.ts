/** Made-up league data for tests and the mock API (no real names). */
import type {
  LeagueResponse,
  ParentFriendsResponse,
  StudentFriendsResponse,
} from '@revisionden/core';

export const AVATAR = '10000000000000000000000000000';

export const sampleLeague = (over: Partial<LeagueResponse> = {}): LeagueResponse => ({
  week: { start: '2026-11-23', end: '2026-11-29' },
  hidden: false,
  lastWeek: null,
  entries: [
    {
      nickname: 'Wren_2',
      avatarCode: AVATAR,
      title: 'Bright Explorer',
      xp: 240,
      place: 1,
      winning: true,
      you: false,
    },
    {
      nickname: 'Lark_1',
      avatarCode: AVATAR,
      title: 'Cosmic Scholar',
      xp: 180,
      place: 2,
      winning: false,
      you: true,
    },
    {
      nickname: 'Comet_3',
      avatarCode: AVATAR,
      title: null,
      xp: 0,
      place: null,
      winning: false,
      you: false,
    },
  ],
  ...over,
});

export const sampleFriends = (
  over: Partial<StudentFriendsResponse> = {},
): StudentFriendsResponse => ({
  allowed: true,
  hidden: false,
  friends: [
    {
      id: 'f-wren',
      nickname: 'Wren_2',
      avatarCode: AVATAR,
      title: 'Bright Explorer',
      sibling: false,
    },
    { id: 'f-comet', nickname: 'Comet_3', avatarCode: AVATAR, title: null, sibling: true },
  ],
  waiting: [{ requestId: 'r-1', nickname: 'Orbit_9', avatarCode: AVATAR, status: 'parents' }],
  ...over,
});

export const sampleParentFriends = (
  over: Partial<ParentFriendsResponse> = {},
): ParentFriendsResponse => ({
  allowed: true,
  hidden: false,
  friends: [
    {
      id: 'f-wren',
      nickname: 'Wren_2',
      avatarCode: AVATAR,
      title: null,
      sibling: false,
      since: '2026-11-20T10:00:00.000Z',
      label: 'from football',
    },
  ],
  waitingForYou: [{ requestId: 'r-1', nickname: 'Orbit_9', avatarCode: AVATAR, title: null }],
  waitingForOther: [],
  blocked: [{ id: 'b-1', nickname: 'Ember_8' }],
  reports: [
    {
      direction: 'made',
      reason: 'pressured',
      reporter: 'Lark_1',
      reported: 'Ember_8',
      at: '2026-11-21T10:00:00.000Z',
    },
  ],
  ...over,
});
