import { expect, test } from '@playwright/test';

// The public website (apps/www, decision 0005). Runs when E2E_WWW_URL is set, e.g.
//   E2E_WWW_URL=https://www-staging.revisionden.com
const www = process.env.E2E_WWW_URL;

test.describe('deployed public site privacy', () => {
  test.skip(!www, 'Set E2E_WWW_URL to check the public site');

  // Only the site's own origin: no fonts, analytics, trackers, embeds or CDN scripts.
  for (const path of ['/', '/404-check']) {
    test(`${path} makes no requests to third parties`, async ({ page }) => {
      const own = new URL(www!).host;
      const foreign: string[] = [];
      page.on('request', (request) => {
        const url = new URL(request.url());
        if (!['http:', 'https:'].includes(url.protocol)) return;
        if (url.host !== own) foreign.push(`${url.host}${url.pathname}`);
      });
      await page.goto(new URL(path, www).toString(), { waitUntil: 'networkidle' });
      expect(foreign).toEqual([]);
    });
  }

  test('sends a content security policy that allows only the site itself', async ({ request }) => {
    const res = await request.get(www!);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-security-policy']).toContain("default-src 'self'");
  });
});
