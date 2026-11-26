import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import topicMap from './fixtures/topic-map-gcse-maths.json' with { type: 'json' };

// J15s (owner, 2026-11-26): each effect style is a full look that restyles the whole app. The map
// and the Me page stay accessible (WCAG 2.2 AA, axe) in every style, in light and dark.

const STYLES = [
  'doodle-diary',
  'sticker-book',
  'pop-burst',
  'starlight',
  'comic-pop',
  'garden-grow',
  'pixel-arcade',
] as const;

const STUDENT_ID = '00000000-0000-4000-8000-0000000000a1';

async function asStudent(page: Page) {
  await page.route('**/v1/**', (route) => route.fulfill({ status: 404, json: { error: 'none' } }));
  await page.route('**/v1/student/map**', (route) => route.fulfill({ json: topicMap }));
  await page.route('**/v1/student/cards/due', (route) => route.fulfill({ json: { due: 2 } }));
  await page.addInitScript((id) => localStorage.setItem('revisionden.studentId', id), STUDENT_ID);
}

async function expectAccessible(page: Page) {
  // A style change starts its transitions on the next frames; let them start, then finish.
  await page.evaluate(
    () =>
      new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))),
  );
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished),
    ),
  );
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    results.violations.map(
      (v) =>
        `${v.id}: ${v.nodes.map((n) => `${n.target.join(' ')} ${n.any[0]?.message ?? ''}`).join(' | ')}`,
    ),
  ).toEqual([]);
}

test.beforeEach(async ({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== 'phone', 'The look checks run on the phone');
});

for (const style of STYLES) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`the map and Me are accessible in ${style}, ${scheme} mode`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await asStudent(page);
      for (const path of ['/map', '/settings']) {
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await page.evaluate((s) => (document.documentElement.dataset.effectStyle = s), style);
        await expectAccessible(page);
      }
    });
  }
}

test('changing the style restyles the page itself, not just the accents', async ({ page }) => {
  await asStudent(page);
  await page.goto('/settings');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const look = () =>
    page.evaluate(() => {
      const card = document.querySelector('.card') ?? document.body;
      const s = getComputedStyle(card);
      return {
        page: getComputedStyle(document.body).backgroundColor,
        card: s.backgroundColor,
        corners: s.borderTopLeftRadius,
      };
    });
  const before = await look();
  await page.evaluate(() => (document.documentElement.dataset.effectStyle = 'pixel-arcade'));
  const after = await look();
  expect(after.page).not.toBe(before.page);
  expect(after.card).not.toBe(before.card);
  expect(after.corners).toBe('0px');
});
