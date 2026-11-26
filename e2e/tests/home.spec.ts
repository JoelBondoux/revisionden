import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import topicMap from './fixtures/topic-map-gcse-maths.json' with { type: 'json' };

// J15b (owner, 2026-11-26): Home, the screen Pip takes you to, fits one phone screen with one big
// call to action; Pip sits top left on every student screen and, in a lesson, asks before leaving.

const STUDENT_ID = '00000000-0000-4000-8000-0000000000a1';
const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

async function asStudent(page: Page, { reducedMotion = false } = {}) {
  if (reducedMotion) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/v1/**', (route) => route.fulfill({ status: 404, json: { error: 'none' } }));
  await page.route('**/v1/student/map**', (route) => route.fulfill({ json: topicMap }));
  await page.route('**/v1/student/cards/due', (route) => route.fulfill({ json: { due: 3 } }));
  await page.route('**/v1/student/daily', (route) =>
    route.fulfill({
      json: {
        day: '2026-11-26',
        items: [],
        draftContent: false,
        answeredItemIds: [],
        answered: 1,
        total: 2,
        done: false,
      },
    }),
  );
  await page.route('**/v1/student/stats**', (route) =>
    route.fulfill({
      json: {
        period: 'week',
        range: { start: '2026-11-23', end: '2026-11-30', label: 'Week of 23 Nov' },
        tiles: {
          xp: { value: 95, previous: 80 },
          answered: { value: 14, correct: 11, previous: 16 },
          accuracy: { value: 79, previous: 79 },
          streak: { current: 3 },
        },
        chart: {
          buckets: days.map((label, i) => ({
            start: `2026-11-${23 + i}`,
            label,
            value: [60, 35, 0, 40, 0, 0, 0][i],
          })),
          goal: 50,
        },
        mastery: [],
        personalBests: { longestStreak: 9, longestCorrectRun: 12, bestWeek: null },
        targets: [],
        level: { level: 7, xpIntoLevel: 120, xpForNextLevel: 300 },
      },
    }),
  );
  await page.addInitScript((id) => localStorage.setItem('revisionden.studentId', id), STUDENT_ID);
}

async function settle(page: Page) {
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
}

test.beforeEach(async ({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== 'phone', 'Home layout checks are phone checks');
});

test('at 390 × 844 Home fits one screen, with its one big button in view', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await asStudent(page);
  await page.goto('/home');
  const go = page.getByRole('link', { name: /^Go:/ });
  await expect(go).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('list', { name: 'This week' })).toBeVisible();
  const nav = (await page.locator('.main-nav').boundingBox())!;
  const week = (await page.getByRole('list', { name: 'This week' }).boundingBox())!;
  expect(week.y + week.height).toBeLessThanOrEqual(nav.y);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0);
});

test('Home never scrolls sideways at 320px with text at 200%', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await asStudent(page);
  await page.goto('/home');
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await expect(page.getByRole('link', { name: /^Go:/ })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0);
});

for (const scheme of ['light', 'dark'] as const) {
  test(`Home is accessible in ${scheme} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await asStudent(page);
    await page.goto('/home');
    await expect(page.getByRole('link', { name: /^Go:/ })).toBeVisible();
    await settle(page);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(
      results.violations.map(
        (v) =>
          `${v.id}: ${v.nodes.map((n) => `${n.target.join(' ')} ${n.any[0]?.message ?? n.all[0]?.message ?? ''}`).join(' | ')}`,
      ),
    ).toEqual([]);
  });
}

test('Pip sits top left on the map, never covers the header buttons, and goes Home', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await asStudent(page);
  await page.goto('/map');
  const pip = page.getByRole('button', { name: 'Home' });
  const box = (await pip.boundingBox())!;
  expect(box.x).toBeLessThan(40);
  expect(box.width).toBeGreaterThanOrEqual(44);
  // Pip's head leans out above the button but stays on screen and clear of the sound button.
  const figure = (await pip.locator('svg').boundingBox())!;
  expect(figure.y).toBeGreaterThanOrEqual(0);
  const sound = (await page.getByRole('button', { name: /sound/i }).boundingBox())!;
  expect(figure.x + figure.width).toBeLessThan(sound.x);
  await pip.click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeAttached();
});

test('in a lesson, Pip asks "Leave this lesson?" and Keep going stays', async ({ page }) => {
  await asStudent(page);
  await page.goto('/learn/topic/surds');
  const pip = page.getByRole('button', { name: 'Home' });
  await pip.click();
  const dialog = page.getByRole('dialog', { name: 'Leave this lesson?' });
  await expect(dialog).toBeVisible();
  await page.getByRole('button', { name: 'Keep going' }).click();
  await expect(dialog).toBeHidden();
  await pip.click();
  await page.getByRole('button', { name: 'Leave' }).click();
  await expect(page).toHaveURL(/\/home$/);
});

test('with reduced motion Pip holds a still pose', async ({ page }) => {
  await asStudent(page, { reducedMotion: true });
  await page.goto('/home');
  const figure = page.getByRole('button', { name: 'Home' }).locator('svg');
  await page.waitForTimeout(9500);
  await expect(figure).toHaveClass(/pip-figure--rest/);
  expect(await figure.evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
});
