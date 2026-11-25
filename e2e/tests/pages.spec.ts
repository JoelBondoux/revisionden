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

test('a signed-out parent on /family is asked to sign in, accessibly', async ({ page }) => {
  await page.route('**/v1/onboarding/family', (route) =>
    route.fulfill({
      status: 401,
      json: { error: { code: 'unauthorized', message: 'Sign in to continue', ref: 'RD-7K2M9Q' } },
    }),
  );
  await page.goto('/family');
  await expect(page.getByRole('heading', { name: 'Please sign in' })).toBeVisible();
  await expectNoSidewaysScroll(page);
  await expectAccessible(page);
});

test('a server error on /family shows a reference code, accessibly', async ({ page }) => {
  await page.route('**/v1/onboarding/family', (route) =>
    route.fulfill({
      status: 500,
      json: {
        error: { code: 'internal_error', message: 'Something went wrong', ref: 'RD-7K2M9Q' },
      },
    }),
  );
  await page.goto('/family');
  await expect(page.getByRole('heading', { name: 'Something went wrong' })).toBeVisible();
  await expect(page.getByText('RD-7K2M9Q')).toBeVisible();
  await expectAccessible(page);
});

test("a parent's family list links to each child's parent view, accessibly", async ({ page }) => {
  const id = '8f6d2b1e-4c3a-4d5e-9f00-000000000001';
  await page.route('**/v1/onboarding/family', (route) =>
    route.fulfill({
      json: {
        children: [
          {
            student: {
              id,
              nickname: 'NovaFox',
              avatarCode: '10000000000000000000000000000',
              yearGroup: 11,
            },
            enrolments: [],
            level: 'gcse',
            examSeason: { season: 'summer', year: 2027 },
            toCheckLater: 0,
            linkedDevices: 0,
          },
        ],
      },
    }),
  );
  await page.goto('/family');
  await expect(page.getByRole('link', { name: /^NovaFox/ })).toHaveAttribute(
    'href',
    `/parent/stats?student=${id}`,
  );
  await expect(page.getByRole('link', { name: 'Link a device for NovaFox' })).toBeVisible();
  await expectNoSidewaysScroll(page);
  await expectAccessible(page);
});

test('the build publishes its id for update checks', async ({ request }) => {
  const res = await request.get('/version.json');
  expect(res.ok()).toBe(true);
  expect(((await res.json()) as { build: string }).build).toMatch(/^\d{2}\.\d{2}\.\d{3}-/);
});

test('offers a refresh, accessibly, when a newer version has been deployed', async ({ page }) => {
  await page.route('**/version.json', (route) => route.fulfill({ json: { build: 'newer-build' } }));
  await page.goto('/legal');
  await expect(page.getByText('A new version of RevisionDen is ready.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible();
  await expectNoSidewaysScroll(page);
  await expectAccessible(page);
});

for (const path of ['/', '/legal', '/about']) {
  test(`${path} loads nothing from third parties`, async ({ page, baseURL }) => {
    const own = new URL(baseURL!).host;
    const foreign: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (['http:', 'https:'].includes(url.protocol) && url.host !== own) foreign.push(url.host);
    });
    await page.goto(path, { waitUntil: 'networkidle' });
    expect(foreign).toEqual([]);
  });
}

test('signed-out public pages show the small site header, accessibly', async ({ page }) => {
  await page.goto('/about');
  const site = page.getByRole('navigation', { name: 'Site' });
  await expect(site.getByRole('link', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
  await expectNoSidewaysScroll(page);
  await expectAccessible(page);
});

test("the young people's notice shows cards, expands its parts and is accessible", async ({
  page,
}) => {
  await page.goto('/legal/privacy-for-young-people');
  await expect(page.getByRole('list', { name: 'The short version' })).toBeVisible();
  const more = page.getByRole('button', { name: /^Read more about What we keep about you/ });
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await more.click();
  await expect(
    page.getByRole('button', { name: /^Show less about What we keep about you/ }),
  ).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: 'Expand all' }).click();
  await expect(page.getByRole('button', { name: 'Collapse all' })).toBeVisible();
  await expectNoSidewaysScroll(page);
  await expectAccessible(page);
});
