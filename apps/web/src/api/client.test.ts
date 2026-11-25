import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { ApiError, createApiClient } from './client';
import { STALE_BUILD_EVENT } from '../pwa/updates';

const reports: unknown[] = [];
const client = createApiClient({ baseUrl: 'http://api.test', random: () => 0 });

beforeEach(() => {
  reports.length = 0;
  server.use(
    http.post('*/v1/client-errors', async ({ request }) => {
      reports.push(await request.json());
      return new HttpResponse(null, { status: 204 });
    }),
  );
});

describe('API client', () => {
  it("reads the parent's family from GET /v1/onboarding/family with the session cookie", async () => {
    let seen: Request | undefined;
    server.use(
      http.get('*/v1/onboarding/family', ({ request }) => {
        seen = request;
        return HttpResponse.json({ children: [] });
      }),
    );
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await client.getFamily();
    expect(new URL(seen!.url).pathname).toBe('/v1/onboarding/family');
    expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({ credentials: 'include' });
    fetchSpy.mockRestore();
  });

  it('returns the family when the response matches the shared schema', async () => {
    const family = await client.getFamily();
    expect(family.children.length).toBeGreaterThan(0);
    expect(family.children[0]?.student).toEqual(
      expect.objectContaining({ id: expect.any(String), nickname: expect.any(String) }),
    );
  });

  it('rejects a response that fails the schema with a reference code, and reports it', async () => {
    server.use(http.get('*/v1/onboarding/family', () => HttpResponse.json({ students: [] })));
    const error = await client.getFamily().catch((e: unknown) => e);
    expect(error).toMatchObject({ kind: 'schema', ref: 'RD-000000' });
    await vi.waitFor(() =>
      expect(reports).toEqual([
        { ref: 'RD-000000', kind: 'schema', status: 200, path: '/v1/onboarding/family' },
      ]),
    );
  });

  it("keeps the API's reference code and error code when the server returns an error", async () => {
    server.use(
      http.get('*/v1/onboarding/family', () =>
        HttpResponse.json(
          { error: { code: 'internal_error', message: 'Something went wrong', ref: 'RD-7K2M9Q' } },
          { status: 500 },
        ),
      ),
    );
    const error = await client.getFamily().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      kind: 'http',
      status: 500,
      code: 'internal_error',
      ref: 'RD-7K2M9Q',
    });
    expect(reports).toEqual([]);
  });

  it('makes and reports a reference code for an error with no JSON body', async () => {
    server.use(http.get('*/v1/onboarding/family', () => new HttpResponse(null, { status: 502 })));
    const error = await client.getFamily().catch((e: unknown) => e);
    expect(error).toMatchObject({ kind: 'http', status: 502, ref: 'RD-000000' });
    await vi.waitFor(() => expect(reports).toHaveLength(1));
  });

  it('rejects with a network error (no reference) when the request cannot be made', async () => {
    server.use(http.get('*/v1/onboarding/family', () => HttpResponse.error()));
    const error = await client.getFamily().catch((e: unknown) => e);
    expect(error).toMatchObject({ kind: 'network' });
    expect((error as ApiError).ref).toBeUndefined();
  });

  it("fetches the student device's topic map", async () => {
    const map = await client.getTopicMap();
    expect(map.units.length).toBeGreaterThan(0);
  });

  it('fetches how many flashcards are due on the student device', async () => {
    const cards = await client.getCardsDue();
    expect(cards.due).toBeGreaterThanOrEqual(0);
  });

  it('signals a possibly out-of-date app when a route is missing or a reply has the wrong shape', async () => {
    const seen: string[] = [];
    const listener = () => seen.push('stale');
    window.addEventListener(STALE_BUILD_EVENT, listener);
    server.use(
      http.get('*/v1/onboarding/family', () =>
        HttpResponse.json(
          { error: { code: 'not_found', message: 'Not found', ref: 'RD-7K2M9Q' } },
          { status: 404 },
        ),
      ),
    );
    await client.getFamily().catch(() => undefined);
    server.use(http.get('*/v1/onboarding/family', () => HttpResponse.json({ students: [] })));
    await client.getFamily().catch(() => undefined);
    server.use(http.get('*/v1/onboarding/family', () => new HttpResponse(null, { status: 500 })));
    await client.getFamily().catch(() => undefined);
    window.removeEventListener(STALE_BUILD_EVENT, listener);
    expect(seen).toEqual(['stale', 'stale']);
  });
});
