import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** Fails on any WCAG 2.2 A or AA problem axe can find on the current page. */
async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

/** The page fits the screen: no sideways scrolling at this size. */
async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test('the welcome page opens and is accessible', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'RevisionDen' })).toBeVisible();
  await expectNoSidewaysScroll(page);
  await expectAccessible(page);
});

test('the policies list links to every policy and is accessible', async ({ page }) => {
  await page.goto('/legal');
  await expect(page.getByRole('heading', { level: 1, name: 'Policies' })).toBeVisible();
  await expect(page.getByRole('link', { name: /privacy notice/i }).first()).toBeVisible();
  await expectNoSidewaysScroll(page);
  await expectAccessible(page);
});

test('the privacy notice opens from a direct link and is accessible', async ({ page }) => {
  await page.goto('/legal/privacy-notice');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/privacy/i);
  await expectNoSidewaysScroll(page);
  await expectAccessible(page);
});

test('the About page shows the version and is accessible', async ({ page }) => {
  await page.goto('/about');
  await expect(page.getByRole('heading', { level: 1, name: 'About RevisionDen' })).toBeVisible();
  await expect(page.getByText(/\d{2}\.\d{2}\.\d{3}/).first()).toBeVisible();
  await expectNoSidewaysScroll(page);
  await expectAccessible(page);
});

for (const path of ['/legal', '/about']) {
  test(`the footer on ${path} shows the version and is not hidden by the navigation`, async ({
    page,
  }) => {
    await page.goto(path);
    const footer = page.getByRole('contentinfo');
    await expect(footer).toContainText(/RevisionDen version \d{2}\.\d{2}\.\d{3}/);
    await footer.scrollIntoViewIfNeeded();
    const link = footer.getByRole('link');
    const box = await link.boundingBox();
    expect(box).not.toBeNull();
    // Whatever is on top at the middle of the link must be the link itself.
    const onTop = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x!, y!)?.closest('footer') !== null,
      [box!.x + box!.width / 2, box!.y + box!.height / 2],
    );
    expect(onTop).toBe(true);
  });
}
