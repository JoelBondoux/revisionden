import { defineConfig } from '@playwright/test';

/**
 * Smoke test of a deployed environment (dev or staging): run with
 *   E2E_BASE_URL=https://staging.revisionden.com pnpm --filter @revisionden/e2e smoke
 * The API address is worked out from the web address (staging. → api-staging.) unless
 * E2E_API_URL is set. Signs nobody in: Google sign-in needs a person (see docs/TESTING.md).
 */
const baseURL = process.env.E2E_BASE_URL;
if (!baseURL)
  throw new Error('Set E2E_BASE_URL to the deployed web app, e.g. https://dev.revisionden.com');

export default defineConfig({
  testDir: './smoke',
  retries: 1,
  reporter: 'list',
  use: { baseURL, trace: 'off' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    {
      name: 'phone',
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
  ],
});
