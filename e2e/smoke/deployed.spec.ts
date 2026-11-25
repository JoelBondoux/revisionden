import { expect, test } from '@playwright/test';
import { apiUrlFor } from './apiUrl';

const web = process.env.E2E_BASE_URL!;
const api = apiUrlFor(web, process.env.E2E_API_URL);
const REF = /^RD-[0-9A-Z]{6}$/;

test.describe('deployed API', () => {
  test('answers health with ok and a version', async ({ request }) => {
    const res = await request.get(`${api}/health`);
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({
      status: 'ok',
      version: expect.stringMatching(/^\d{2}\.\d{2}\.\d{3}$/),
    });
  });

  test('offers Google sign-in', async ({ request }) => {
    const res = await request.get(`${api}/v1/auth/providers`);
    expect(((await res.json()) as { providers: string[] }).providers).toContain('google');
  });

  test('starts Google sign-in for the web app (stops before Google, no account used)', async ({
    request,
  }) => {
    const res = await request.post(`${api}/api/auth/sign-in/social`, {
      headers: { origin: new URL(web).origin },
      data: {
        provider: 'google',
        callbackURL: `${new URL(web).origin}/family`,
        errorCallbackURL: `${new URL(web).origin}/`,
      },
    });
    expect(res.status()).toBe(200);
    const { url } = (await res.json()) as { url: string };
    expect(new URL(url).hostname).toBe('accounts.google.com');
    expect(new URL(url).searchParams.get('redirect_uri')).toBe(`${api}/api/auth/callback/google`);
  });

  test('has the parent family route the "Who\'s revising?" page reads, and refuses it signed out', async ({
    request,
  }) => {
    const res = await request.get(`${api}/v1/onboarding/family`);
    expect(res.status()).toBe(401);
    const body = (await res.json()) as { error: { code: string; ref?: string } };
    expect(body.error.code).toBe('unauthorized');
    expect(body.error.ref).toMatch(REF);
  });
});

test.describe('deployed web app', () => {
  test('shows the policies to anyone', async ({ page }) => {
    await page.goto('/legal');
    await expect(page.getByRole('heading', { level: 1, name: 'Policies' })).toBeVisible();
    await page.goto('/legal/privacy-notice');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/privacy/i);
  });

  test('shows the Google button on the welcome page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'RevisionDen' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  });

  test('asks a signed-out visitor on /family to sign in instead of showing an error', async ({
    page,
  }) => {
    await page.goto('/family');
    await expect(page.getByRole('heading', { name: 'Please sign in' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
    await expect(page.getByText('Something went wrong')).toHaveCount(0);
  });
});
