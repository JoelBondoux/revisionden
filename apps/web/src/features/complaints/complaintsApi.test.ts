import { ComplaintsApiError, createComplaintsApi } from './complaintsApi';

const reply = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status });

describe('complaints API client', () => {
  it('lists, creates and adds messages on the real API paths with the session cookie', async () => {
    const calls: [string, RequestInit][] = [];
    const fetch = vi.fn(async (url: URL | RequestInfo, init?: RequestInit) => {
      calls.push([String(url), init!]);
      if (String(url).endsWith('/messages')) return reply(201);
      if (init?.method === 'POST')
        return reply(201, { id: 'c1', acknowledgeDueAt: 'a', resolveDueAt: 'b' });
      return reply(200, { complaints: [] });
    });
    const api = createComplaintsApi({ baseUrl: 'https://api.example.test', fetch });
    expect(await api.list()).toEqual([]);
    expect(await api.create({ summary: 'Hello there', aboutPersonalData: false })).toEqual({
      id: 'c1',
      acknowledgeDueAt: 'a',
      resolveDueAt: 'b',
    });
    await api.addMessage('c1', 'More');
    expect(calls.map(([url, init]) => [init.method ?? 'GET', url])).toEqual([
      ['GET', 'https://api.example.test/v1/complaints'],
      ['POST', 'https://api.example.test/v1/complaints'],
      ['POST', 'https://api.example.test/v1/complaints/c1/messages'],
    ]);
    expect(calls.every(([, init]) => init.credentials === 'include')).toBe(true);
  });

  it("turns an error answer into a ComplaintsApiError with the API's message", async () => {
    const api = createComplaintsApi({
      baseUrl: 'https://api.example.test/',
      fetch: async () => reply(429, { error: { code: 'limit_reached', message: 'Try tomorrow.' } }),
    });
    await expect(api.create({ summary: 'Hello', aboutPersonalData: false })).rejects.toMatchObject({
      status: 429,
      code: 'limit_reached',
      message: 'Try tomorrow.',
    });
    const offline = createComplaintsApi({
      baseUrl: 'https://api.example.test',
      fetch: async () => {
        throw new TypeError('offline');
      },
    });
    await expect(offline.list()).rejects.toBeInstanceOf(ComplaintsApiError);
  });
});
