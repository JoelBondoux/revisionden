import { createParentsApi, ParentsApiError } from './parentsApi';

describe('two-parent client', () => {
  it('sends the parent cookie and reads the parents list', async () => {
    const body = { parents: [], canInvite: true, deletionRequest: null };
    const fetch = vi.fn(async () => Response.json(body));
    const api = createParentsApi({ baseUrl: 'https://api.test', fetch });
    expect(await api.parents()).toEqual(body);
    expect(fetch).toHaveBeenCalledWith(
      new URL('https://api.test/v1/family/parents'),
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    );
  });

  it('posts the code to join and removes a parent by number', async () => {
    const calls: [string, string][] = [];
    const fetch = vi.fn(async (url: URL | RequestInfo, init?: RequestInit) => {
      calls.push([String(url), init?.method ?? 'GET']);
      if (String(url).endsWith('/join')) return Response.json({ familyId: 'f', position: 2 });
      return new Response(null, { status: 204 });
    });
    const api = createParentsApi({ baseUrl: 'https://api.test/', fetch });
    expect(await api.join('ABC')).toEqual({ familyId: 'f', position: 2 });
    await api.removeParent(2);
    await api.cancelDeletion();
    await api.markSeen();
    await api.seenRemovalNotice();
    expect(calls).toEqual([
      ['https://api.test/v1/family/join', 'POST'],
      ['https://api.test/v1/family/parents/2', 'DELETE'],
      ['https://api.test/v1/family/deletion', 'DELETE'],
      ['https://api.test/v1/family/events/seen', 'POST'],
      ['https://api.test/v1/removal-notice/seen', 'POST'],
    ]);
  });

  it('turns an API error into a typed error with its code and reference', async () => {
    const fetch = vi.fn(async () =>
      Response.json(
        {
          error: {
            code: 'family_full',
            message: 'This family already has two parents.',
            ref: 'RD-ABC123',
          },
        },
        { status: 409 },
      ),
    );
    const api = createParentsApi({ baseUrl: 'https://api.test', fetch });
    const err = await api.invite().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ParentsApiError);
    expect(err).toMatchObject({ code: 'family_full', status: 409, ref: 'RD-ABC123' });
  });

  it('copes with an error that has no body', async () => {
    const api = createParentsApi({
      baseUrl: 'https://api.test',
      fetch: async () => new Response('', { status: 500 }),
    });
    await expect(api.events()).rejects.toMatchObject({ code: 'http_error', status: 500 });
  });
});
