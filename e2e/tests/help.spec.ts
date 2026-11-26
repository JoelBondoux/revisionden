import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/** Get help (workstream W): private, accessible and request-free. */

for (const path of ['/help', '/parent/help']) {
  test(`${path} is accessible and fits the screen`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: 'Get help' })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
}

test('opening Get help makes no API calls and no requests to other sites', async ({ page }) => {
  // Arrive from another page first, so the app has already loaded; then watch only what the
  // visit to Get help itself asks for.
  await page.goto('/legal');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.getByRole('link', { name: 'Get help' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Get help' })).toBeVisible();
  await page.waitForTimeout(1000);
  const origin = new URL(page.url()).origin;
  const offending = requests.filter((url) => {
    const u = new URL(url);
    return u.origin !== origin || u.pathname.startsWith('/api/') || u.pathname.startsWith('/v1/');
  });
  expect(offending).toEqual([]);
});

test('loading Get help directly fetches nothing from other sites or the API', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.goto('/help');
  await expect(page.getByRole('heading', { level: 1, name: 'Get help' })).toBeVisible();
  await page.waitForTimeout(1000);
  const origin = new URL(page.url()).origin;
  const offending = requests.filter((url) => {
    const u = new URL(url);
    return u.origin !== origin || u.pathname.startsWith('/api/') || u.pathname.startsWith('/v1/');
  });
  expect(offending).toEqual([]);
});

test('Quick exit leaves Get help and Back does not return to it', async ({ page }) => {
  await page.goto('/about');
  await page.goto('/help');
  await page.getByRole('button', { name: 'Quick exit' }).click();
  // The topic map; signed out, the map sends you on to sign in.
  await expect(page).not.toHaveURL(/\/help$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/about$/);
});

test('phone and text links are tap-to-call and tap-to-text', async ({ page }) => {
  await page.goto('/help');
  await expect(page.getByRole('link', { name: '999', exact: true })).toHaveAttribute(
    'href',
    'tel:999',
  );
  await expect(page.getByRole('link', { name: 'Call 0800 1111' }).first()).toHaveAttribute(
    'href',
    'tel:08001111',
  );
  await expect(page.getByRole('link', { name: 'Text SHOUT to 85258' }).first()).toHaveAttribute(
    'href',
    'sms:85258?&body=SHOUT',
  );
});

test('Quick exit stays on screen while scrolling to the bottom of Get help', async ({ page }) => {
  await page.goto('/help');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const exit = page.getByRole('button', { name: 'Quick exit' });
  await expect(exit).toBeInViewport();
  const box = await exit.boundingBox();
  expect(box!.y).toBeLessThan(80);
});

test('the topic filter narrows the list, makes no requests and stays accessible', async ({
  page,
}) => {
  await page.goto('/help');
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.getByRole('searchbox', { name: 'Find a topic' }).fill('bully');
  await expect(page.getByRole('status')).toHaveText('1 topic matches');
  await expect(page.getByRole('heading', { name: 'Bullying, online or in person' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'In danger right now' })).toBeVisible();
  const origin = new URL(page.url()).origin;
  const offending = requests.filter((url) => {
    const u = new URL(url);
    return u.origin !== origin || u.pathname.startsWith('/api/') || u.pathname.startsWith('/v1/');
  });
  expect(offending).toEqual([]);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

const APPEARANCES = [
  { name: 'dark', settings: { theme: 'dark' } },
  { name: 'colour-blind', settings: { theme: 'light', palette: 'colourblind' } },
  { name: 'dark colour-blind', settings: { theme: 'dark', palette: 'colourblind' } },
];

for (const { name, settings } of APPEARANCES) {
  test(`Get help follows the ${name} theme and stays accessible`, async ({ page }) => {
    await page.addInitScript((saved) => {
      window.localStorage.setItem('revisionden.appearance', JSON.stringify(saved));
    }, settings);
    await page.goto('/help');
    await expect(page.getByRole('heading', { level: 1, name: 'Get help' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(settings.theme);
    const pageBg = await page
      .locator('.help-main')
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(pageBg).toBe(settings.theme === 'dark' ? 'rgb(31, 27, 51)' : 'rgb(255, 255, 255)');
    // Open every category so axe checks every topic and service.
    for (const summary of await page.locator('summary').all()) {
      if (!(await summary.evaluate((el) => (el.parentElement as HTMLDetailsElement).open)))
        await summary.click();
    }
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
}

test.describe('on a 320px screen with text at 200%', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  for (const path of ['/help', '/parent/help']) {
    test(`${path} has no sideways scroll and every button fits`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: 'Get help' })).toBeVisible();
      // Text resized to 200% (WCAG 1.4.4, 1.4.10), with every category opened.
      await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
      await page.evaluate(() => {
        document.querySelectorAll('details').forEach((d) => (d.open = true));
      });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      const tooWide = await page
        .locator('.help-button')
        .evaluateAll((els) =>
          els
            .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 0.5)
            .map((el) => el.textContent?.trim()),
        );
      expect(tooWide).toEqual([]);
    });
  }
});

/** A student uses this device; their avatar is a made-up code (the default look). */
async function asStudent(page: import('@playwright/test').Page) {
  await page.addInitScript(() => localStorage.setItem('revisionden.studentId', 'student-e2e'));
  await page.route('**/v1/student/avatar', (route) =>
    route.fulfill({ json: { avatarCode: '1' + '0'.repeat(28), earnedRewardIds: [] } }),
  );
}

test.describe('students find Get help on Settings, through Me (owner, 2026-11-26)', () => {
  test('student screens show no Get help link; Me opens Settings, where Get help comes first', async ({
    page,
  }) => {
    await asStudent(page);
    await page.goto('/map');
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav).toBeVisible();
    await expect(page.getByRole('link', { name: 'Get help' })).toHaveCount(0);
    const me = nav.getByRole('link', { name: 'Me, settings and personalisation' });
    await expect(nav.getByRole('link').last()).toHaveAccessibleName(
      'Me, settings and personalisation',
    );
    await expect(me.locator('svg.avatar-svg')).toBeVisible();
    await me.click();
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    await expect(me).toHaveAttribute('aria-current', 'page');
    const pageLinks = page.locator('main > :not(header) a');
    await expect(pageLinks.first()).toHaveAttribute('href', '/help');
    await expect(pageLinks.first()).toHaveAccessibleName(/^Get help/);
    // Progress lives on Me now, right after Get help, and Me stays marked there.
    await expect(pageLinks.nth(1)).toHaveAttribute('href', '/progress');
    await expect(nav.getByRole('link', { name: 'Progress' })).toHaveCount(0);
    await pageLinks.nth(1).click();
    await expect(page).toHaveURL(/\/progress$/);
    await expect(me).toHaveAttribute('aria-current', 'page');
    await page.goBack();
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  test.describe('on a 320px screen with text at 200%', () => {
    test.use({ viewport: { width: 320, height: 640 } });

    // J found the bottom nav wider than the screen at 320px/200%, so check the nav's own width
    // on several student pages, not just Settings. (On phones, anything wider than the screen
    // widens the page and the fixed nav with it; /progress's period toggle does that today and
    // is reported to its workstream, K.)
    for (const path of ['/map', '/cards', '/plan', '/papers', '/settings']) {
      test(`${path}: the five nav items fit and nothing scrolls sideways`, async ({ page }) => {
        await asStudent(page);
        await page.goto(path);
        const nav = page.getByRole('navigation', { name: 'Main' });
        await expect(nav).toBeVisible();
        await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
        const links = nav.getByRole('link');
        await expect(links).toHaveCount(5);
        const sizes = await nav.evaluate((el) => {
          const list = el.querySelector('ul')!;
          return {
            navRight: el.getBoundingClientRect().right,
            navScroll: el.scrollWidth - el.clientWidth,
            listScroll: list.scrollWidth - list.clientWidth,
            viewport: document.documentElement.clientWidth,
            page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          };
        });
        expect(sizes.navRight).toBeLessThanOrEqual(sizes.viewport + 0.5);
        expect(sizes.navScroll).toBeLessThanOrEqual(0);
        expect(sizes.listScroll).toBeLessThanOrEqual(0);
        expect(sizes.page).toBeLessThanOrEqual(0);
        const offScreen = await links.evaluateAll((els) =>
          els
            .filter((el) => {
              const r = el.getBoundingClientRect();
              return r.left < -0.5 || r.right > window.innerWidth + 0.5;
            })
            .map((el) => el.textContent?.trim()),
        );
        expect(offScreen).toEqual([]);
      });
    }
  });

  test.describe('on a tablet, the side rail', () => {
    test.use({ viewport: { width: 820, height: 1180 } });

    test('ends with Me, fully on screen', async ({ page }) => {
      await asStudent(page);
      await page.goto('/map');
      const links = page.getByRole('navigation', { name: 'Main' }).getByRole('link');
      await expect(links).toHaveCount(5);
      const me = links.last();
      await expect(me).toHaveAccessibleName('Me, settings and personalisation');
      await expect(me).toBeInViewport({ ratio: 1 });
      const boxes = await links.evaluateAll((els) =>
        els.map((el) => el.getBoundingClientRect().top),
      );
      expect(boxes).toEqual([...boxes].sort((a, b) => a - b));
    });
  });
});
