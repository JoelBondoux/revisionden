import worker from './worker.ts';

const assets = {
  fetch: vi.fn(
    async () => new Response('<h1>page</h1>', { headers: { 'content-type': 'text/html' } }),
  ),
};

describe('site worker', () => {
  beforeEach(() => assets.fetch.mockClear());

  it('sends www.revisionden.com to the apex domain, keeping the path and query', async () => {
    const response = await worker.fetch(new Request('https://www.revisionden.com/pricing?x=1'), {
      ASSETS: assets,
    });
    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe('https://revisionden.com/pricing?x=1');
    expect(assets.fetch).not.toHaveBeenCalled();
  });

  it('serves the static page for every other host', async () => {
    const response = await worker.fetch(new Request('https://revisionden.com/'), {
      ASSETS: assets,
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('<h1>page</h1>');
  });

  it('adds a strict content security policy that allows only this site', async () => {
    const response = await worker.fetch(new Request('https://revisionden.com/'), {
      ASSETS: assets,
    });
    const csp = response.headers.get('content-security-policy') ?? '';
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(response.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('keeps the staging host out of search engines', async () => {
    const response = await worker.fetch(new Request('https://www-staging.revisionden.com/'), {
      ASSETS: assets,
    });
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });

  it('lets search engines index the live site', async () => {
    const response = await worker.fetch(new Request('https://revisionden.com/'), {
      ASSETS: assets,
    });
    expect(response.headers.get('x-robots-tag')).toBeNull();
  });
});
