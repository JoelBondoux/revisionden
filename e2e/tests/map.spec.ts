import { expect, test, type Page } from '@playwright/test';
import { axeWhenSettled } from './support/axe';
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

test('at 390 × 844 the whole map fits one screen, with the current topic in view', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openMap(page);
  const nav = (await page.locator('.main-nav').boundingBox())!;
  // The map ends above the tab bar, with the page at the top.
  const card = (await page.locator('.unit-card').boundingBox())!;
  expect(card.y + card.height).toBeLessThanOrEqual(nav.y);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
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

// J12d (owner, 2026-11-26): the subject row opened scrolled so the chip on the left was cut
// mid-word. Each row now opens showing the chosen item whole, lined up on an item's edge.
test('each sideways row opens with the chosen item whole and no item cut at the left edge', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const many = {
    ...topicMap,
    subjects: [
      { subjectId: 'gcse-physics', subject: 'Physics', hasContent: false },
      { subjectId: 'gcse-chemistry', subject: 'Chemistry', hasContent: false },
      { subjectId: 'gcse-english-literature', subject: 'English Literature', hasContent: false },
      { subjectId: 'gcse-maths', subject: 'Maths', hasContent: true },
      { subjectId: 'gcse-biology', subject: 'Biology', hasContent: false },
    ],
  };
  await openMap(page);
  await page.route('**/v1/student/map**', (route) => route.fulfill({ json: many }));
  await page.reload();
  await expect(page.getByRole('region', { name: 'Algebra topics' })).toBeVisible();
  // The rows line up again once the web font has loaded (it changes every item's width).
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  for (const name of ['Subject', 'Units']) {
    const row = page.getByRole('group', { name });
    await expect
      .poll(
        () =>
          row.evaluate((track) => {
            const edge = track.getBoundingClientRect();
            return Array.from(track.children)
              .map((el) => el.getBoundingClientRect())
              .filter((box) => box.left < edge.left - 1 && box.right > edge.left + 1).length;
          }),
        { message: name },
      )
      .toBe(0);
  }
  const maths = page.getByRole('group', { name: 'Subject' }).getByRole('button', { name: 'Maths' });
  const inView = await maths.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const track = el.parentElement!.getBoundingClientRect();
    return box.left >= track.left - 1 && box.right <= track.right + 1;
  });
  expect(inView).toBe(true);
});

test('the keyboard reaches every chip, badge and topic, and focus scrolls each into view', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openMap(page);
  const units = page.getByRole('group', { name: 'Units' });
  const badges = units.getByRole('button');
  await expect(badges).toHaveCount(6);
  // Tab through both subject chips, See all, then all six badges (the Today strip is on Home).
  const subjects = page.getByRole('group', { name: 'Subject' });
  await subjects.getByRole('button', { name: 'Maths' }).focus();
  await page.keyboard.press('Tab');
  await expect(subjects.getByRole('button', { name: /Physics/ })).toBeFocused();
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
    const results = await axeWhenSettled(page);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
}
