import {
  ComplaintsApiError,
  createComplaintRequestSender,
  createComplaintsApi,
} from './complaintsApi';

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

describe("escalation and children's requests in the client", () => {
  it('escalates, lists and dismisses requests, and sends a student request', async () => {
    const calls: string[] = [];
    const fetch = vi.fn(async (url: URL | RequestInfo, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${String(url)}`);
      if (String(url).endsWith('/complaint-requests') && !init?.method)
        return reply(200, { requests: [] });
      return reply(204);
    });
    const api = createComplaintsApi({ baseUrl: 'https://api.example.test', fetch });
    await api.escalate('c1');
    expect(await api.listRequests()).toEqual([]);
    await api.dismissRequest('r1');
    await createComplaintRequestSender({ baseUrl: 'https://api.example.test', fetch })({
      topic: 'unfair',
    });
    expect(calls).toEqual([
      'POST https://api.example.test/v1/complaints/c1/escalate',
      'GET https://api.example.test/v1/complaint-requests',
      'DELETE https://api.example.test/v1/complaint-requests/r1',
      'POST https://api.example.test/v1/student/complaint-requests',
    ]);
  });

  it("turns a refused student request into the API's message", async () => {
    const send = createComplaintRequestSender({
      baseUrl: 'https://api.example.test',
      fetch: async () => reply(429, { error: { code: 'limit_reached', message: 'Tomorrow.' } }),
    });
    await expect(send({ topic: 'unfair' })).rejects.toMatchObject({ code: 'limit_reached' });
    const offline = createComplaintRequestSender({
      baseUrl: 'https://api.example.test',
      fetch: async () => {
        throw new TypeError('offline');
      },
    });
    await expect(offline({ topic: 'unfair' })).rejects.toBeInstanceOf(ComplaintsApiError);
  });
});
