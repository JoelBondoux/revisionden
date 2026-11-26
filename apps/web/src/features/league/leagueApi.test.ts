import { describe, expect, it } from 'vitest';
import { createLeagueApi } from './leagueApi';
import { sampleFriends, sampleLeague, sampleParentFriends } from './fixtures';

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(body === undefined ? null : JSON.stringify(body), { status });
  };
  return { calls, fetch: fetch as typeof globalThis.fetch };
}

const base = 'https://api.example.com';

describe('league API client', () => {
  it('loads the league and the friends list with the session cookie', async () => {
    const { calls, fetch } = fakeFetch(200, sampleLeague());
    const api = createLeagueApi({ baseUrl: base, fetch });
    expect((await api.getLeague()).entries).toHaveLength(3);
    expect(calls[0]!.url).toBe(`${base}/v1/student/league`);
    expect(calls[0]!.init.credentials).toBe('include');
    const friends = createLeagueApi({
      baseUrl: base,
      fetch: fakeFetch(200, sampleFriends()).fetch,
    });
    expect((await friends.getFriends()).friends).toHaveLength(2);
  });

  it('sends the student actions to the right routes', async () => {
    const { calls, fetch } = fakeFetch(200, {
      requestId: 'r',
      friend: { nickname: 'A', avatarCode: 'a', title: null },
      code: 'ABCD-2345',
      expiresAt: 'x',
      hidden: true,
      status: 'parents',
    });
    const api = createLeagueApi({ baseUrl: base, fetch });
    await api.makeCode();
    await api.redeem('abcd-2345');
    await api.confirm('r 1');
    await api.cancel('r1');
    await api.setHidden(true);
    expect(calls.map((c) => [c.init.method, c.url.replace(base, '')])).toEqual([
      ['POST', '/v1/student/friends/codes'],
      ['POST', '/v1/student/friends/redeem'],
      ['POST', '/v1/student/friends/requests/r%201/confirm'],
      ['POST', '/v1/student/friends/requests/r1/cancel'],
      ['PUT', '/v1/student/league/hidden'],
    ]);
    expect(JSON.parse(String(calls[1]!.init.body))).toEqual({ code: 'abcd-2345' });
  });

  it('removes, blocks and reports a friend', async () => {
    const { calls, fetch } = fakeFetch(204, undefined);
    const api = createLeagueApi({ baseUrl: base, fetch });
    await api.removeFriend('f1');
    await api.blockFriend('f1');
    await api.reportFriend('f1', 'pressured');
    expect(calls.map((c) => [c.init.method, c.url.replace(base, '')])).toEqual([
      ['DELETE', '/v1/student/friends/f1'],
      ['POST', '/v1/student/friends/f1/block'],
      ['POST', '/v1/student/friends/f1/report'],
    ]);
    expect(JSON.parse(String(calls[2]!.init.body))).toEqual({ reason: 'pressured' });
  });

  it('runs the parent actions for one child', async () => {
    const { calls, fetch } = fakeFetch(200, sampleParentFriends());
    const api = createLeagueApi({ baseUrl: base, fetch });
    expect((await api.getChildFriends('s1')).blocked).toHaveLength(1);
    await api.setAllowed('s1', true);
    await api.approve('s1', 'r1');
    await api.decline('s1', 'r1');
    await api.parentRemove('s1', 'f1');
    await api.parentBlock('s1', 'f1');
    await api.unblock('s1', 'b1');
    await api.setLabel('s1', 'f1', 'from chess');
    await api.closeReport('s1', 'rep 1');
    expect(calls.map((c) => [c.init.method, c.url.replace(base, '')])).toEqual([
      [undefined, '/v1/students/s1/friends'],
      ['PUT', '/v1/students/s1/friends/allowed'],
      ['POST', '/v1/students/s1/friends/requests/r1/approve'],
      ['POST', '/v1/students/s1/friends/requests/r1/decline'],
      ['DELETE', '/v1/students/s1/friends/f1'],
      ['POST', '/v1/students/s1/friends/f1/block'],
      ['DELETE', '/v1/students/s1/friends/blocks/b1'],
      ['PUT', '/v1/students/s1/friends/f1/label'],
      ['POST', '/v1/students/s1/friends/reports/rep%201/close'],
    ]);
  });

  it('throws an ApiError with the status when the server refuses', async () => {
    const api = createLeagueApi({
      baseUrl: base,
      fetch: fakeFetch(404, { error: { code: 'code_not_valid', message: 'x' } }).fetch,
    });
    await expect(api.redeem('nope')).rejects.toMatchObject({ status: 404 });
  });
});
