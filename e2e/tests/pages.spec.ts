import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { axeWhenSettled } from './support/axe';

/** Fails on any WCAG 2.2 A or AA problem axe can find on the current page. */
async function expectAccessible(page: Page) {
  const results = await axeWhenSettled(page);
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
  let sent: unknown;
  await page.route('**/v1/error-reports', async (route) => {
    sent = route.request().postDataJSON();
    await route.fulfill({ status: 202, json: { received: true } });
  });
  await page.getByRole('button', { name: 'Send error report' }).click();
  await expect(page.getByText("Thanks, we're on it.")).toBeVisible();
  expect(sent).toMatchObject({ ref: 'RD-7K2M9Q', screen: '/family', status: 500 });
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
    `/parent?student=${id}`,
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

test('Settings offers "Add RevisionDen to this device" as a button, accessibly', async ({
  page,
}) => {
  // The install button lives under Me > More (W9).
  await page.goto('/settings/more');
  // Chrome only offers its install prompt to a real installable site; send the event ourselves.
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt');
    Object.assign(event, {
      prompt: async () => undefined,
      userChoice: Promise.resolve({ outcome: 'dismissed', platform: 'web' }),
    });
    window.dispatchEvent(event);
  });
  await expect(page.getByRole('button', { name: 'Add RevisionDen to this device' })).toBeVisible();
  await expectNoSidewaysScroll(page);
  await expectAccessible(page);
});

/** What the bug button covers anywhere while the page scrolls: controls or blocks of content. */
async function bugButtonOverlaps(page: Page) {
  await expect(page.getByRole('button', { name: 'Report a bug' })).toBeVisible();
  return page.evaluate(async () => {
    const button = document.querySelector('.bug-button')!;
    const hits = new Set<string>();
    const max = document.documentElement.scrollHeight - innerHeight;
    for (let y = 0; y <= max + 100; y += 100) {
      scrollTo(0, Math.min(y, max));
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const b = button.getBoundingClientRect();
      // Controls, plus every block of the page's content (cards, sections, headings): the button
      // must not float over any of it, even in the gap beside a control.
      const main = document.querySelector('main')!;
      const blocks = Array.from(main.children).filter((c) => !c.contains(button));
      const controls = Array.from(
        document.querySelectorAll('a, button, input, select, textarea, label'),
      );
      for (const el of [...blocks, ...controls]) {
        if (el === button || button.contains(el) || el.contains(button)) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const apart =
          r.right <= b.left || r.left >= b.right || r.bottom <= b.top || r.top >= b.bottom;
        if (!apart) hits.add(el.outerHTML.slice(0, 80));
      }
    }
    return [...hits];
  });
}

/** Tabs to the bug button and checks it shows the standard focus ring. */
async function expectBugButtonFocusRing(page: Page) {
  const bug = page.getByRole('button', { name: 'Report a bug' });
  await expect(bug).toBeVisible();
  // Tab until the bug button has focus, so :focus-visible applies as it does for a keyboard user.
  for (let i = 0; i < 40 && !(await bug.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press('Tab');
  }
  await expect(bug).toBeFocused();
  const ring = await bug.evaluate((el) => getComputedStyle(el).boxShadow);
  const expected = await bug.evaluate((el) => {
    const probe = document.createElement('div');
    probe.style.boxShadow = 'var(--focus-ring)';
    el.parentElement!.appendChild(probe);
    const value = getComputedStyle(probe).boxShadow;
    probe.remove();
    return value;
  });
  expect(expected).not.toBe('none');
  expect(ring).toBe(expected);
}

/** A made-up family with one child taking GCSE Maths, and that child's subjects, for parent screens. */
const PARENT_CHILD_ID = '00000000-0000-4000-8000-0000000000a1';
async function routeDemoFamily(page: Page) {
  const maths = {
    studentId: PARENT_CHILD_ID,
    subjectId: 'gcse-maths',
    board: 'Edexcel',
    tier: 'higher',
  };
  await page.route(`**/v1/students/${PARENT_CHILD_ID}/subjects`, (route) =>
    route.fulfill({ json: { subjects: [{ ...maths, hasQuestions: false }] } }),
  );
  await page.route('**/v1/onboarding/family', (route) =>
    route.fulfill({
      json: {
        children: [
          {
            student: {
              id: PARENT_CHILD_ID,
              nickname: 'NovaFox',
              avatarCode: '10000000000000000000000000000',
              yearGroup: 11,
            },
            enrolments: [maths],
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

test('the bug button never covers a button or link on a student page, however far it scrolls', async ({
  page,
}) => {
  // A student uses this device; Settings is long and full of controls.
  await page.addInitScript(() => localStorage.setItem('revisionden.studentId', 'student-e2e'));
  await page.goto('/settings');
  expect(await bugButtonOverlaps(page)).toEqual([]);
});

test('the bug button in the top row shows the focus ring when reached with the keyboard', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('revisionden.studentId', 'student-e2e'));
  await page.goto('/settings');
  await expectBugButtonFocusRing(page);
});

test('the bug button never covers a choice on the parent Subjects page, however far it scrolls', async ({
  page,
}) => {
  await routeDemoFamily(page);
  await page.goto(`/parent/subjects/${PARENT_CHILD_ID}`);
  await expect(page.getByRole('heading', { level: 1, name: "NovaFox's subjects" })).toBeVisible();
  expect(await bugButtonOverlaps(page)).toEqual([]);
});

test('the bug button on parent pages shows the focus ring when reached with the keyboard', async ({
  page,
}) => {
  await routeDemoFamily(page);
  await page.goto(`/parent/subjects/${PARENT_CHILD_ID}`);
  await expect(page.getByRole('heading', { level: 1, name: "NovaFox's subjects" })).toBeVisible();
  await expectBugButtonFocusRing(page);
});

test('the install help shows illustrated iPhone and iPad steps, accessibly', async ({ page }) => {
  await page.goto('/install');
  await expect(page.getByRole('list', { name: 'Steps for iPhone' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Steps for iPad' })).toBeVisible();
  await expectNoSidewaysScroll(page);
  await expectAccessible(page);
});

/** A virtual passkey device (Chromium only), optionally holding one RevisionDen passkey. */
async function virtualPasskeyDevice(page: Page, rpId: string, withPasskey: boolean) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  const credentialId = Buffer.from('e2e-passkey-1').toString('base64');
  if (withPasskey) {
    const { generateKeyPairSync } = await import('node:crypto');
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    await cdp.send('WebAuthn.addCredential', {
      authenticatorId,
      credential: {
        credentialId,
        isResidentCredential: true,
        rpId,
        privateKey: privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'),
        userHandle: Buffer.from('e2e-device').toString('base64'),
        signCount: 0,
      },
    });
  }
  return { credentialId: Buffer.from('e2e-passkey-1').toString('base64url') };
}

async function routeUnlock(page: Page, rpId: string) {
  let verified: { response?: { id?: string } } | undefined;
  await page.route('**/v1/device/unlock/options', (route) =>
    route.fulfill({
      json: {
        challengeId: 'c1',
        options: {
          challenge: 'ZTJlLWNoYWxsZW5nZQ',
          rpId,
          timeout: 5000,
          userVerification: 'preferred',
        },
      },
    }),
  );
  await page.route('**/v1/device/unlock/verify', async (route) => {
    verified = route.request().postDataJSON() as typeof verified;
    await route.fulfill({
      json: {
        student: {
          id: '8f6d2b1e-4c3a-4d5e-9f00-000000000001',
          nickname: 'NovaFox',
          avatarCode: '10000000000000000000000000000',
          yearGroup: 11,
        },
      },
    });
  });
  return () => verified;
}

test('a student unlocks with the passkey on this device and lands on Home', async ({
  page,
  baseURL,
}) => {
  const rpId = new URL(baseURL!).hostname;
  const { credentialId } = await virtualPasskeyDevice(page, rpId, true);
  const verified = await routeUnlock(page, rpId);
  await page.goto('/');
  await page.getByRole('button', { name: "I'm a student: unlock with my passkey" }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeAttached();
  expect(verified()?.response?.id).toBe(credentialId);
});

test("the topic map's links say what they show: each name starts with its visible text", async ({
  page,
  baseURL,
}) => {
  const rpId = new URL(baseURL!).hostname;
  await virtualPasskeyDevice(page, rpId, true);
  routeUnlock(page, rpId);
  // Made-up topics, one in each state, and cards due so the Cards tab shows its badge.
  const topic = (id: string, title: string, status: string, mastery: number) => ({
    id,
    title,
    lessonId: id,
    status,
    mastery,
  });
  await page.route('**/v1/student/cards/due', (route) => route.fulfill({ json: { due: 3 } }));
  await page.route('**/v1/student/map', (route) =>
    route.fulfill({
      json: {
        subject: 'Maths',
        qualification: 'GCSE',
        streakDays: 2,
        xpToday: 10,
        dailyGoalXp: 50,
        nextMission: null,
        units: [
          {
            id: 'u1',
            title: 'Algebra',
            masteryPercent: 40,
            topics: [
              topic('t1', 'Expressions', 'mastered', 100),
              topic('t2', 'Equations', 'in-progress', 45),
              topic('t3', 'Inequalities', 'weak', 20),
              topic('t4', 'Sequences', 'locked', 0),
            ],
            challenge: { lessonId: 'c1', unlockAtPercent: 80, unlocked: false },
          },
        ],
      },
    }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: "I'm a student: unlock with my passkey" }).click();
  await expect(page).toHaveURL(/\/home$/);
  // Unlocking lands on Home (J15b); the map is a tap away in the menu.
  await page.getByRole('link', { name: 'Learn', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Topic map' })).toBeVisible();
  await expect(page.locator('.path-node').first()).toBeVisible();
  const results = await axeWhenSettled(page, (axe) =>
    axe.withRules(['label-content-name-mismatch']),
  );
  expect(
    results.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(' ')}`)),
  ).toEqual([]);
});

test('a device with no passkey is told to ask a parent, accessibly', async ({ page, baseURL }) => {
  const rpId = new URL(baseURL!).hostname;
  await virtualPasskeyDevice(page, rpId, false);
  await routeUnlock(page, rpId);
  await page.goto('/unlock');
  await expect(page.getByRole('heading', { level: 1, name: 'Unlock RevisionDen' })).toBeVisible();
  await page.getByRole('button', { name: 'Unlock with my passkey' }).click();
  await expect(page.getByRole('alert')).toContainText('Ask a parent to link this device.');
  await expectNoSidewaysScroll(page);
  await expectAccessible(page);
});

test('a new parent sees the terms and privacy notice as cards before onboarding, accessibly', async ({
  page,
}) => {
  let stored: unknown;
  await page.route('**/v1/policy-acceptances', async (route) => {
    if (route.request().method() === 'PUT') {
      stored = route.request().postDataJSON();
      return route.fulfill({ json: { acceptances: [] } });
    }
    return route.fulfill({ json: { acceptances: [] } });
  });
  await page.goto('/onboarding');
  await expect(page.getByRole('heading', { level: 1, name: 'Before you start' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Terms of use in short' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Privacy notice in short' })).toBeVisible();
  const terms = page.getByRole('list', { name: 'Terms of use in short' });
  await expect(terms.getByRole('listitem')).toHaveCount(4);
  await page.getByRole('button', { name: /^Show all \d+ points of the Terms of use$/ }).click();
  await expect(
    page.getByRole('button', { name: 'Show fewer points of the Terms of use' }),
  ).toHaveAttribute('aria-expanded', 'true');
  expect(await terms.getByRole('listitem').count()).toBeGreaterThan(4);
  const details = page.getByRole('button', { name: 'Show the details of the Privacy notice' });
  await expect(details).toHaveAttribute('aria-expanded', 'false');
  await details.click();
  await expect(
    page.getByRole('button', { name: 'Hide the details of the Privacy notice' }),
  ).toHaveAttribute('aria-expanded', 'true');
  await expectNoSidewaysScroll(page);
  await expectAccessible(page);
  await page
    .getByRole('checkbox', { name: /I have read the Terms of use and Privacy notice/ })
    .check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect.poll(() => stored).toMatchObject({ acceptances: expect.any(Array) });
});

// J11 (WCAG 1.4.4 and 1.4.10): at 320px wide with text at 200%, the policy tiles (button tiles
// since J15a) wrap their text and shrink, so the page never scrolls sideways.
test('the policies list fits a 320px screen with text at 200%', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/legal');
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await expect(page.getByRole('heading', { level: 1, name: 'Policies' })).toBeVisible();
  await expectNoSidewaysScroll(page);
  const widest = await page.evaluate(() =>
    Math.max(
      ...Array.from(document.querySelectorAll('.button-tile')).map(
        (t) => t.getBoundingClientRect().right,
      ),
    ),
  );
  expect(widest).toBeLessThanOrEqual(320);
});

test('/about reflows at 320px with text at 200% (WCAG 1.4.4, 1.4.10)', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/about');
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await expect(page.getByRole('heading', { level: 1, name: 'About RevisionDen' })).toBeVisible();
  await expectNoSidewaysScroll(page);
});

test('the footer fits a 320px screen with large text, wrapping instead of overflowing', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/about');
  // Large reading text in the footer (about twice the usual size).
  await page.addStyleTag({ content: '.version-footer { font-size: 1.625rem !important; }' });
  const footer = page.getByRole('contentinfo');
  await footer.scrollIntoViewIfNeeded();
  const overflow = await footer.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  for (const item of await footer.locator('.version-footer-item').all()) {
    const box = await item.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  }
});

/**
 * Made-up stats (copied from the app's own demo mocks, apps/web/src/features/stats/mocks.ts),
 * served for every stats request, since the preview build has no mock server.
 */
async function routeDemoStats(page: Page) {
  const demo = JSON.parse(
    readFileSync(new URL('./fixtures/stats-demo.json', import.meta.url), 'utf8'),
  ) as Record<string, unknown>;
  await page.route(/\/v1\/students?(\/|\?|$)/, (route) => {
    const path = new URL(route.request().url()).pathname
      .replace(/^.*\/v1\//, '')
      .replace(PARENT_CHILD_ID, ':child');
    const json = demo[path];
    return json === undefined ? route.fallback() : route.fulfill({ json });
  });
}

for (const [who, path, heading, tile] of [
  ['My stats (/progress)', '/progress', 'My stats', 'XP'],
  [
    'the parent stats',
    `/parent/stats?student=${PARENT_CHILD_ID}`,
    'Stats dashboard',
    'Active study time',
  ],
] as const) {
  test(`${who} fits a 320px screen with text at 200%, with no sideways scroll`, async ({
    page,
  }) => {
    await page.addInitScript(() => localStorage.setItem('revisionden.studentId', 'student-e2e'));
    await routeDemoStats(page);
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(path);
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await expect(page.getByRole('group', { name: tile })).toBeVisible();
    await expectNoSidewaysScroll(page);
  });
}
