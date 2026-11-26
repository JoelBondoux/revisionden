import { vi } from 'vitest';
import type { LeagueApi } from './leagueApi';
import { sampleFriends, sampleLeague, sampleParentFriends } from './fixtures';

/** A LeagueApi for tests: sample data, every action a spy. */
export function fakeLeagueApi(over: Partial<LeagueApi> = {}): LeagueApi {
  return {
    getLeague: vi.fn(async () => sampleLeague()),
    getFriends: vi.fn(async () => sampleFriends()),
    makeCode: vi.fn(async () => ({ code: 'ABCD-2345', expiresAt: '2026-11-28T10:00:00.000Z' })),
    redeem: vi.fn(async () => ({
      requestId: 'r-new',
      friend: { nickname: 'Nova_7', avatarCode: 'x', title: 'Swift Thinker' },
    })),
    confirm: vi.fn(async () => undefined),
    cancel: vi.fn(async () => undefined),
    removeFriend: vi.fn(async () => undefined),
    blockFriend: vi.fn(async () => undefined),
    reportFriend: vi.fn(async () => undefined),
    setHidden: vi.fn(async () => undefined),
    getChildFriends: vi.fn(async () => sampleParentFriends()),
    setAllowed: vi.fn(async () => undefined),
    approve: vi.fn(async () => undefined),
    decline: vi.fn(async () => undefined),
    parentRemove: vi.fn(async () => undefined),
    parentBlock: vi.fn(async () => undefined),
    unblock: vi.fn(async () => undefined),
    setLabel: vi.fn(async () => undefined),
    closeReport: vi.fn(async () => undefined),
    ...over,
  };
}
