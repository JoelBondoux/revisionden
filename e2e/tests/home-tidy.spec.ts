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

  test('the "Fix these" topics wrap onto new lines, all on screen', async ({ page }) => {
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
                weak('w1', 'Simultaneous equations'),
                weak('w2', 'Rearranging formulae'),
                weak('w3', 'Bearings and scale drawings'),
                weak('w4', 'Circle theorems'),
              ],
            },
          ],
        },
      }),
    );
    await page.goto('/home');
    const chips = page.getByRole('list', { name: 'Fix these' }).getByRole('link');
    await expect(chips).toHaveCount(4);
    const boxes = await chips.evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { top: r.top, right: r.right };
      }),
    );
    const width = await page.evaluate(() => document.documentElement.clientWidth);
    expect(boxes.every((b) => b.right <= width + 0.5)).toBe(true);
    expect(new Set(boxes.map((b) => Math.round(b.top))).size).toBeGreaterThan(1);
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
