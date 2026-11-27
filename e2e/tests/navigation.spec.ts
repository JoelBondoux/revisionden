import { expect, test } from '@playwright/test';
import { seedApp } from './support/seed';

/*
 * UX-1 (owner approved the UX report, 2026-11-27): the main navigation, phone width first. The
 * bottom bar is Home · Learn (the map) · Cards · Me; Plan and Papers stay out of it while they
 * are only "Coming soon", though their pages still open by address. Home has its own tab, so it
 * no longer takes a tap on Pip to find.
 */

test('the main navigation is Home, Learn, Cards and Me, in that order', async ({ page }) => {
  await seedApp(page, 'pupil');
  await page.goto('/home');
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link')).toHaveText([/^Home/, /^Learn/, /^Cards/, /^Me/]);
  await expect(nav.getByRole('link', { name: /Plan|Papers/ })).toHaveCount(0);
});

test('each tab opens its screen and is marked as the current page', async ({ page }) => {
  await seedApp(page, 'pupil');
  await page.goto('/map');
  const nav = page.getByRole('navigation', { name: 'Main' });

  await nav.getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(nav.getByRole('link', { name: 'Home', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );

  await nav.getByRole('link', { name: 'Learn', exact: true }).click();
  await expect(page).toHaveURL(/\/map$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Topic map' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Learn', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(nav.getByRole('link', { name: 'Home', exact: true })).not.toHaveAttribute(
    'aria-current',
  );
});

test('Plan and Papers still open by address while they are coming soon', async ({ page }) => {
  await seedApp(page, 'pupil');
  for (const [path, title] of [
    ['/plan', 'Plan'],
    ['/papers', 'Papers'],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  }
});
