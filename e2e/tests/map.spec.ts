import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import topicMap from './fixtures/topic-map-gcse-maths.json' with { type: 'json' };

/*
 * The topic map, design C "Your path" (J12b). The data is made up: the real GCSE Maths Higher
 * topic tree (6 units, 97 topics) with a made-up student part-way through Number and Algebra.
 */

const STUDENT_ID = '00000000-0000-4000-8000-0000000000a1';

async function openMap(page: Page, { textScale = 1 } = {}) {
  await page.route('**/v1/**', (route) => route.fulfill({ status: 404, json: { error: 'none' } }));
  await page.route('**/v1/student/map**', (route) => route.fulfill({ json: topicMap }));
  await page.route('**/v1/student/daily', (route) =>
    route.fulfill({
      json: {
        day: '2026-11-26',
        items: [],
        draftContent: false,
        answeredItemIds: [],
        answered: 0,
        total: 2,
        done: false,
      },
    }),
  );
  await page.route('**/v1/student/cards/due', (route) => route.fulfill({ json: { due: 0 } }));
  await page.addInitScript(
    ([id, scale]) => {
      localStorage.setItem('revisionden.studentId', id as string);
      if (scale !== 1) {
        document.addEventListener('DOMContentLoaded', () => {
          const style = document.createElement('style');
          style.textContent = `html { font-size: ${(scale as number) * 100}% !important; }`;
          document.head.appendChild(style);
        });
      }
    },
    [STUDENT_ID, textScale],
  );
  await page.goto('/map');
  await expect(page.getByRole('region', { name: 'Algebra topics' })).toBeVisible();
  // Wait for the 5-a-day row, which loads after the map and moves the path down.
  await expect(page.getByRole('link', { name: 'Start your 5-a-day' })).toBeVisible();
}

async function sidewaysScroll(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

test.beforeEach(async ({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== 'phone', 'The map layout checks are phone checks');
});

test('at 390 × 844 the whole map fits one screen, with Go and the current topic in view', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openMap(page);
  const nav = (await page.locator('.main-nav').boundingBox())!;
  // The map ends above the tab bar, with the page at the top.
  const card = (await page.locator('.unit-card').boundingBox())!;
  expect(card.y + card.height).toBeLessThanOrEqual(nav.y);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  // The main call to action is on screen and not under the tab bar.
  const go = page.getByRole('link', { name: /^Go:/ });
  await expect(go).toBeInViewport({ ratio: 1 });
  const goBox = (await go.boundingBox())!;
  expect(goBox.y + goBox.height).toBeLessThanOrEqual(nav.y);
  // All 25 Algebra topics are on the path, which scrolls inside its card ...
  const path = page.getByRole('region', { name: 'Algebra topics' });
  await expect(path.getByRole('listitem')).toHaveCount(26);
  expect(await path.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  // ... and opens on the next mission's topic.
  const current = path.getByRole('link', { name: /^Simplifying, expanding and factorising/ });
  const box = (await current.boundingBox())!;
  const view = (await path.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(view.y - 1);
  expect(box.y + box.height).toBeLessThanOrEqual(view.y + view.height + 1);
  expect(await sidewaysScroll(page)).toBeLessThanOrEqual(0);
});

for (const [label, textScale] of [
  ['320 × 568', 1],
  ['320 × 568 with text at 200%', 2],
] as const) {
  test(`at ${label} the page never scrolls sideways and the path scrolls with the page`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await openMap(page, { textScale });
    // No scroll inside a scroll on a small screen: the page scrolls instead.
    const path = page.getByRole('region', { name: 'Algebra topics' });
    expect(await path.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
    await expect(path.getByRole('listitem')).toHaveCount(26);
    // Nothing in the page is wider than the screen, outside the rows that scroll on purpose.
    const wide = await page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      return Array.from(document.querySelectorAll('main *'))
        .filter((el) => !el.closest('.hscroll__track') && !el.closest('.main-nav'))
        .filter((el) => el.getBoundingClientRect().right > width + 1)
        .map((el) => el.className || el.tagName);
    });
    expect(wide).toEqual([]);
  });
}

test('the subject chips and unit badges stay on one line and scroll sideways', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openMap(page);
  const rowTops = async (name: string) =>
    page
      .getByRole('group', { name })
      .getByRole('button')
      .evaluateAll((items) => [
        ...new Set(items.map((el) => Math.round(el.getBoundingClientRect().top))),
      ]);
  expect(await rowTops('Subject')).toHaveLength(1);
  expect(await rowTops('Units')).toHaveLength(1);
  const units = page.getByRole('group', { name: 'Units' });
  expect(await units.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  // Every badge is at least 44px tall for touch.
  for (const height of await units
    .getByRole('button')
    .evaluateAll((items) => items.map((el) => el.getBoundingClientRect().height))) {
    expect(height).toBeGreaterThanOrEqual(44);
  }
});

test('the keyboard reaches every chip, badge and topic, and focus scrolls each into view', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openMap(page);
  const units = page.getByRole('group', { name: 'Units' });
  const badges = units.getByRole('button');
  await expect(badges).toHaveCount(6);
  // Tab through both subject chips, the Today strip's Go and Start, See all, then all six badges.
  const subjects = page.getByRole('group', { name: 'Subject' });
  await subjects.getByRole('button', { name: 'Maths' }).focus();
  await page.keyboard.press('Tab');
  await expect(subjects.getByRole('button', { name: /Physics/ })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: /^Go:/ })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Start your 5-a-day' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'See all units' })).toBeFocused();
  for (let i = 0; i < 6; i += 1) {
    await page.keyboard.press('Tab');
    await expect(badges.nth(i)).toBeFocused();
    // The focused badge is scrolled into the row's view.
    await expect
      .poll(async () => {
        const row = (await units.boundingBox())!;
        const badge = (await badges.nth(i).boundingBox())!;
        return badge.x >= row.x - 1 && badge.x + badge.width <= row.x + row.width + 1;
      })
      .toBe(true);
  }
  // Enter chooses the last badge (Statistics, locked) and the card says how it unlocks.
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: 'Statistics', exact: true })).toContainText(
    "It unlocks as soon as they're ready",
  );
  // The path is the next stop (it scrolls with the keyboard), then its first topic.
  await page.keyboard.press('Tab');
  await expect(page.getByRole('region', { name: 'Statistics topics' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('region', { name: 'Statistics topics' }).getByRole('button').first(),
  ).toBeFocused();
});

for (const scheme of ['light', 'dark'] as const) {
  test(`the map is accessible in ${scheme} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width: 390, height: 844 });
    await openMap(page);
    // Let the entrance animations finish: axe would measure contrast mid-fade.
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
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
}
