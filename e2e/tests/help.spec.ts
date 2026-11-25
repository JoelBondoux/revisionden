import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/** Get help (workstream W): private, accessible and request-free. */

for (const path of ['/help', '/parent/help']) {
  test(`${path} is accessible and fits the screen`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: 'Get help' })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
}

test('opening Get help makes no API calls and no requests to other sites', async ({ page }) => {
  // Arrive from another page first, so the app has already loaded; then watch only what the
  // visit to Get help itself asks for.
  await page.goto('/legal');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.getByRole('link', { name: 'Get help' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Get help' })).toBeVisible();
  await page.waitForTimeout(1000);
  const origin = new URL(page.url()).origin;
  const offending = requests.filter((url) => {
    const u = new URL(url);
    return u.origin !== origin || u.pathname.startsWith('/api/') || u.pathname.startsWith('/v1/');
  });
  expect(offending).toEqual([]);
});

test('loading Get help directly fetches nothing from other sites or the API', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.goto('/help');
  await expect(page.getByRole('heading', { level: 1, name: 'Get help' })).toBeVisible();
  await page.waitForTimeout(1000);
  const origin = new URL(page.url()).origin;
  const offending = requests.filter((url) => {
    const u = new URL(url);
    return u.origin !== origin || u.pathname.startsWith('/api/') || u.pathname.startsWith('/v1/');
  });
  expect(offending).toEqual([]);
});

test('Quick exit leaves Get help and Back does not return to it', async ({ page }) => {
  await page.goto('/about');
  await page.goto('/help');
  await page.getByRole('button', { name: 'Quick exit' }).click();
  // The topic map; signed out, the map sends you on to sign in.
  await expect(page).not.toHaveURL(/\/help$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/about$/);
});

test('phone and text links are tap-to-call and tap-to-text', async ({ page }) => {
  await page.goto('/help');
  await expect(page.getByRole('link', { name: '999', exact: true })).toHaveAttribute(
    'href',
    'tel:999',
  );
  await expect(page.getByRole('link', { name: 'Call 0800 1111' }).first()).toHaveAttribute(
    'href',
    'tel:08001111',
  );
  await expect(page.getByRole('link', { name: 'Text SHOUT to 85258' }).first()).toHaveAttribute(
    'href',
    'sms:85258?&body=SHOUT',
  );
});
