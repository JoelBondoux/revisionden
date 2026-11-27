import { expect, test } from '@playwright/test';
import { topicMap } from '../../apps/web/src/mocks/data';
import { seedApp } from './support/seed';

/*
 * UX-1 (owner approved the UX report, 2026-11-27): Home and the clutter around it, phone width
 * first. The "Fix these" chips wrap instead of running off the screen; the goals say in words
 * what they count; the "Friends league · Soon" pill is gone; Cards shows a small draft tag, not a
 * big banner; the version line lives on About only; and Me's last tile says what it opens.
 * Topic names here are made up.
 */

const weak = (id: string, title: string) => ({
  id,
  title,
  lessonId: id,
  status: 'weak' as const,
  mastery: 20,
});

test.describe('at 320px wide', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  // Lead's ruling (UX-1): the weakest few as wrapping chips, each at most two lines with its full
  // name kept for screen readers, then "See all N" on the map; Home still fits one screen.
  test('the "Fix these" topics wrap, each at most two lines, then "See all"', async ({ page }) => {
    await seedApp(page, 'pupil');
    const unit = topicMap.units[0]!;
    await page.route('**/v1/student/map**', (route) =>
      route.fulfill({
        json: {
          ...topicMap,
          units: [
            {
              ...unit,
              topics: [
                weak('w1', 'Calculating with roots and integer and fractional indices'),
                weak('w2', 'Rearranging formulae'),
                weak('w3', 'Bearings and scale drawings'),
                weak('w4', 'Circle theorems'),
                weak('w5', 'Expressions, equations, formulae, identities and inequalities'),
              ],
            },
          ],
        },
      }),
    );
    await page.goto('/home');
    const fix = page.getByRole('list', { name: 'Fix these' });
    const chips = fix.getByRole('link').filter({ hasNotText: /^See all/ });
    await expect(chips.first()).toBeVisible();
    const shown = await chips.count();
    expect(shown).toBeGreaterThanOrEqual(2);
    expect(shown).toBeLessThanOrEqual(3);
    await expect(chips.first()).toHaveAccessibleName(
      'Calculating with roots and integer and fractional indices',
    );
    await expect(chips.first()).toHaveAttribute(
      'title',
      'Calculating with roots and integer and fractional indices',
    );
    const boxes = await chips.evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        const lineHeight = parseFloat(getComputedStyle(el.firstElementChild ?? el).lineHeight);
        return {
          right: r.right,
          lines: Math.round((el.firstElementChild ?? el).clientHeight / lineHeight),
        };
      }),
    );
    const width = await page.evaluate(() => document.documentElement.clientWidth);
    expect(boxes.every((b) => b.right <= width + 0.5)).toBe(true);
    expect(boxes.every((b) => b.lines <= 2)).toBe(true);
    const all = page.getByRole('link', { name: 'See all 5' });
    await expect(all).toHaveAttribute('href', '/map');
  });
});

test("Home's goals say what they count, and there is no friends league pill", async ({ page }) => {
  await seedApp(page, 'pupil');
  await page.goto('/home');
  const goals = page.getByRole('list', { name: "Today's goals" });
  await expect(goals).toContainText(/Daily goal: \d+ of \d+ XP/);
  await expect(goals).toContainText(/\d+ of \d+ questions today/);
  await expect(goals).toContainText(/\d+ cards? to review/);
  await expect(page.getByText('Friends league')).toHaveCount(0);
});

test('Cards marks draft questions with a small tag, not a big banner', async ({ page }) => {
  await seedApp(page, 'pupil');
  await page.goto('/cards');
  const note = page.getByRole('note');
  await expect(note).toHaveText('Draft: not checked yet');
  await expect(page.locator('.draft-banner')).toHaveCount(0);
  const height = await note.evaluate((el) => el.getBoundingClientRect().height);
  expect(height).toBeLessThan(40);
});

test('the version line is on About only, not on every page', async ({ page }) => {
  await seedApp(page, 'pupil');
  for (const path of ['/home', '/map', '/cards', '/settings']) {
    await page.goto(path);
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
    await expect(page.getByText(/RevisionDen version/)).toHaveCount(0);
  }
  await page.goto('/about');
  await expect(page.getByRole('heading', { name: 'This version' })).toBeVisible();
});

test("Me's last tile says what it opens", async ({ page }) => {
  await seedApp(page, 'pupil');
  await page.goto('/settings');
  await expect(page.getByRole('link', { name: 'More', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Subjects, family and feedback' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Subjects, family and feedback' }),
  ).toBeVisible();
});
