import { defineConfig } from '@playwright/test';

/**
 * Runs against E2E_BASE_URL when set (for example https://dev.revisionden.com); otherwise it
 * builds nothing itself and serves the already-built web app (apps/web/dist) with `vite preview`.
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:4173';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL, trace: 'off' },
  projects: [
    {
      name: 'phone',
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
    { name: 'tablet', use: { viewport: { width: 820, height: 1180 }, hasTouch: true } },
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'pnpm --filter @revisionden/web exec vite preview --port 4173 --strictPort',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
      },
});
