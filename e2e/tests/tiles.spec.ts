import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// J15a (owner, 2026-11-26): the parent and policy pages show their links as button tiles in the
// effect style's own look, and a tile opens its page with the style's page transition (Back plays
// it in reverse). These tests run the real build in a browser.

const STYLES = [
  ['doodle-diary', 'dd-page-turn'],
  ['sticker-book', 'sb-peel-in'],
  ['pop-burst', 'pb-pop-in'],
  ['starlight', 'sl-twinkle-in'],
  ['comic-pop', 'cp-panel-zoom'],
  ['garden-grow', 'gg-grow-in'],
  ['pixel-arcade', 'px-slide-in'],
] as const;

/** A made-up family with one child, for the parent home page. */
const CHILD_ID = '00000000-0000-4000-8000-0000000000a1';
async function routeDemoFamily(page: Page) {
  await page.route('**/v1/onboarding/family', (route) =>
    route.fulfill({
      json: {
        children: [
          {
            student: {
              id: CHILD_ID,
              nickname: 'NovaFox',
              avatarCode: '10000000000000000000000000000',
              yearGroup: 11,
            },
            enrolments: [],
            level: 'gcse',
            examSeason: { season: 'summer', year: 2027 },
            toCheckLater: 0,
            linkedDevices: 1,
          },
        ],
      },
    }),
  );
}

async function useStyle(page: Page, style: string) {
  await page.evaluate((s) => (document.documentElement.dataset.effectStyle = s), style);
}

/** Records every page transition the main area starts, with the animation it runs. */
async function watchTransitions(page: Page) {
  await page.evaluate(() => {
    const seen: string[] = [];
    (window as unknown as { transitions: string[] }).transitions = seen;
    const main = document.getElementById('main')!;
    new MutationObserver(() => {
      if (main.classList.contains('page-enter')) {
        const back = main.classList.contains('page-enter--back') ? ' back' : '';
        seen.push(getComputedStyle(main).animationName + back);
      }
    }).observe(main, { attributes: true, attributeFilter: ['class'] });
  });
}

const transitions = (page: Page) =>
  page.evaluate(() => (window as unknown as { transitions: string[] }).transitions);

async function settle(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished),
    ),
  );
}

async function expectAccessible(page: Page) {
  await settle(page);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    results.violations.map(
      (v) =>
        `${v.id}: ${v.nodes.map((n) => n.target.join(' ') + ' ' + (n.any[0]?.message ?? '')).join(' | ')}`,
    ),
  ).toEqual([]);
}

for (const [style, keyframes] of STYLES) {
  test(`a policy tile opens its page with the ${style} transition, reversed on Back`, async ({
    page,
  }) => {
    await page.goto('/legal');
    await expect(page.getByRole('heading', { level: 1, name: 'Policies' })).toBeVisible();
    await useStyle(page, style);
    await watchTransitions(page);
    await page.getByRole('link', { name: /^Privacy notice Parents/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: /^Privacy notice/ })).toBeVisible();
    await expect.poll(() => transitions(page)).toEqual([keyframes]);
    // The page is never blocked: it can be scrolled and tapped straight away.
    await page.goBack();
    await expect(page.getByRole('heading', { level: 1, name: 'Policies' })).toBeVisible();
    await expect.poll(() => transitions(page)).toHaveLength(2);
    expect((await transitions(page))[1]).toMatch(/ back$/);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`the policy and parent tiles are accessible in ${style}, ${scheme} mode`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/legal');
      await expect(page.getByRole('heading', { level: 1, name: 'Policies' })).toBeVisible();
      await useStyle(page, style);
      await expectAccessible(page);

      await routeDemoFamily(page);
      await page.goto('/parent');
      await expect(page.getByRole('link', { name: 'Stats dashboard' })).toBeVisible();
      await useStyle(page, style);
      await expectAccessible(page);
    });
  }
}

test('with reduced motion, a tile swaps the page at once, both ways', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/legal');
  await expect(page.getByRole('heading', { level: 1, name: 'Policies' })).toBeVisible();
  await watchTransitions(page);
  await page.getByRole('link', { name: /^Privacy notice Parents/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: /^Privacy notice/ })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1, name: 'Policies' })).toBeVisible();
  expect(await transitions(page)).toEqual([]);
});

test('the parent tiles fit a 320px screen with text at 200%, two to a row', async ({ page }) => {
  await routeDemoFamily(page);
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/parent');
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await expect(page.getByRole('link', { name: 'Stats dashboard' })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  const tops = await page
    .getByRole('link', { name: /^(Children|Family feedback)$/ })
    .evaluateAll((links) => links.map((l) => Math.round(l.getBoundingClientRect().top)));
  expect(tops[0]).toBe(tops[1]);
});

test('Get help on parent home opens calmly, with no transition', async ({ page }) => {
  await routeDemoFamily(page);
  await page.goto('/parent');
  await expect(page.getByRole('link', { name: 'Stats dashboard' })).toBeVisible();
  await watchTransitions(page);
  await page.getByRole('link', { name: 'Get help' }).click();
  await expect(page).toHaveURL(/\/parent\/help$/);
  expect(await transitions(page)).toEqual([]);
});
