import { describe, expect, it } from 'vitest';
import { createRewardsApi } from './rewardsApi';
import { cinemaTrip, sampleRewards } from './fixtures';

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(body === undefined ? null : JSON.stringify(body), { status });
  };
  return { calls, fetch: fetch as typeof globalThis.fetch };
}

describe('rewards API client', () => {
  it('loads the student rewards view with the session cookie', async () => {
    const { calls, fetch } = fakeFetch(200, sampleRewards());
    const api = createRewardsApi({ baseUrl: 'https://api.example.com', fetch });
    const view = await api.getMyRewards();
    expect(view.overview.level.level).toBe(4);
    expect(calls[0]!.url).toBe('https://api.example.com/v1/student/rewards');
    expect(calls[0]!.init.credentials).toBe('include');
  });

  it('loads, adds, marks given and removes parent rewards for a child', async () => {
    const { calls, fetch } = fakeFetch(200, cinemaTrip);
    const api = createRewardsApi({ baseUrl: 'https://api.example.com/', fetch });
    await api.addParentReward('s 1', { title: 'Cinema trip', target: cinemaTrip.target });
    await api.markGiven('s 1', cinemaTrip.id);
    expect(calls.map((c) => [c.init.method, c.url])).toEqual([
      ['POST', 'https://api.example.com/v1/students/s%201/parent-rewards'],
      ['POST', `https://api.example.com/v1/students/s%201/parent-rewards/${cinemaTrip.id}/given`],
    ]);
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({
      title: 'Cinema trip',
      target: cinemaTrip.target,
    });
  });

  it("loads a child's rewards and removes a parent reward", async () => {
    const view = fakeFetch(200, sampleRewards());
    expect(
      (
        await createRewardsApi({ baseUrl: 'https://a.example', fetch: view.fetch }).getChildRewards(
          's1',
        )
      ).overview.chapter!.number,
    ).toBe(2);
    expect(view.calls[0]!.url).toBe('https://a.example/v1/students/s1/rewards');
    const del = fakeFetch(204, undefined);
    await createRewardsApi({ baseUrl: 'https://a.example', fetch: del.fetch }).removeParentReward(
      's1',
      'r1',
    );
    expect(del.calls[0]!.init.method).toBe('DELETE');
  });

  it('throws on an error status or a bad response', async () => {
    const failing = createRewardsApi({
      baseUrl: 'https://a.example',
      fetch: fakeFetch(500, {}).fetch,
    });
    await expect(failing.getMyRewards()).rejects.toThrow('500');
    const odd = createRewardsApi({
      baseUrl: 'https://a.example',
      fetch: fakeFetch(200, { nope: 1 }).fetch,
    });
    await expect(odd.getMyRewards()).rejects.toThrow();
  });
});
