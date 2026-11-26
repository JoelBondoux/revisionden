import { readFileSync } from 'node:fs';
import { expect, test, type Page, type Route } from '@playwright/test';
import { axeWhenSettled } from './support/axe';
import { allowedOrigins, isElsewhere } from './support/origins';

/*
 * W16: one whole parent session on a phone, as a smoke test of the pieces working together. A new
 * parent signs in, confirms the terms, adds a child, links the child's device with the QR code,
 * finishes, opens the family screen and Parent home, and reads the stats dashboard. Every screen
 * passes axe (WCAG 2.2 A and AA) once its animations settle.
 *
 * Everything outside the browser is stubbed here with page.route, and only here: no production
 * code path or flag exists for it. Sign-in never reaches Google: the stubbed sign-in call sends the
 * parent straight back to the app, as the provider would after consent, and the session check then
 * says a parent is signed in. The data is made up (an invented child, no email), and the stats come
 * from the existing demo fixture.
 */

const CHILD = {
  id: '00000000-0000-4000-8000-0000000000a1',
  nickname: 'TestOwl',
};
const NOW = '2026-11-26T10:00:00.000Z';

test.skip(({ isMobile }) => !isMobile, 'a phone smoke test (the phone project)');

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, json: body });

/** The parent's side of the API, stubbed and kept in memory for this one test. */
async function stubParentApi(page: Page) {
  const state = {
    signedIn: false,
    accepted: [] as { policy: string; version: string; acceptedAt: string }[],
    children: [] as Record<string, unknown>[],
    statusChecks: 0,
  };
  const demo = JSON.parse(
    readFileSync(new URL('./fixtures/stats-demo.json', import.meta.url), 'utf8'),
  ) as Record<string, unknown>;

  await page.route('**/v1/**', (route) =>
    json(route, { error: { code: 'not_found', message: 'Not stubbed', ref: 'RD-E2E000' } }, 404),
  );
  await page.route('**/v1/client-errors', (route) => route.fulfill({ status: 204 }));

  // Sign-in: no provider is called. The stub answers with the callback URL the app asked for.
  await page.route('**/api/auth/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/sign-in/social')) {
      state.signedIn = true;
      const { callbackURL } = route.request().postDataJSON() as { callbackURL: string };
      return json(route, { url: callbackURL });
    }
    if (path.endsWith('/get-session')) {
      return json(route, state.signedIn ? { user: { id: 'parent-e2e' }, session: {} } : null);
    }
    return json(route, {});
  });

  await page.route('**/v1/policy-acceptances', (route) => {
    if (route.request().method() === 'PUT') {
      const { acceptances } = route.request().postDataJSON() as {
        acceptances: { policy: string; version: string }[];
      };
      state.accepted = acceptances.map((a) => ({ ...a, acceptedAt: NOW }));
    }
    return json(route, { acceptances: state.accepted });
  });

  await page.route('**/v1/onboarding/family', (route) => json(route, { children: state.children }));
  await page.route('**/v1/onboarding/children', (route) => {
    const body = route.request().postDataJSON() as {
      nickname: string;
      avatarCode: string;
      yearGroup: number;
      subjects: { subjectId: string; board: string; tier: string }[];
    };
    const child = {
      student: {
        id: CHILD.id,
        nickname: body.nickname,
        avatarCode: body.avatarCode,
        yearGroup: body.yearGroup,
      },
      enrolments: body.subjects.map((s) => ({ studentId: CHILD.id, ...s })),
      level: 'gcse',
      examSeason: { season: 'summer', year: 2027 },
      toCheckLater: 0,
      linkedDevices: 0,
    };
    state.children = [child];
    return json(route, child, 201);
  });

  // The QR code, then the child's device using it on the second status check.
  await page.route(/\/v1\/students\/[^/]+\/link-tokens(\/[^/]+)?$/, (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'POST') {
      const token = 't'.repeat(32);
      return json(
        route,
        {
          tokenId: 'token-e2e',
          kind: 'qr',
          token,
          familyId: 'family-e2e',
          studentId: CHILD.id,
          expiresAt: '2030-01-01T00:00:00.000Z',
          linkUrl: `${url.origin}/link?token=${token}&family=family-e2e`,
          code: 'ABCD-EFGH',
        },
        201,
      );
    }
    if (route.request().method() === 'GET') {
      state.statusChecks += 1;
      if (state.statusChecks >= 2) {
        for (const c of state.children) c.linkedDevices = 1;
        return json(route, { status: 'linked' });
      }
      return json(route, { status: 'waiting' });
    }
    return route.fulfill({ status: 204 });
  });
  await page.route(`**/v1/students/${CHILD.id}/devices`, (route) =>
    json(route, {
      devices:
        state.statusChecks >= 2
          ? [{ id: 'device-e2e', deviceType: 'phone', linkedAt: NOW, lastUsedAt: null }]
          : [],
    }),
  );
  await page.route(`**/v1/students/${CHILD.id}/subjects`, (route) =>
    json(route, {
      subjects:
        (state.children[0]?.enrolments as object[] | undefined)?.map((e) => ({
          ...e,
          hasQuestions: false,
        })) ?? [],
    }),
  );

  // The rest of the parent area, as a new single-parent family.
  await page.route('**/v1/family/activity', (route) =>
    json(route, {
      lastUsedAt: NOW,
      deletedIfUnusedAfter: '2027-11-26T10:00:00.000Z',
      warning: null,
    }),
  );
  await page.route('**/v1/family/parents', (route) =>
    json(route, {
      parents: [{ position: 1, label: 'Parent 1', you: true, joinedAt: NOW }],
      canInvite: true,
      deletionRequest: null,
    }),
  );
  await page.route('**/v1/family/events', (route) =>
    json(route, { events: [], newFromOtherParent: 0 }),
  );
  await page.route('**/v1/removal-notice', (route) => json(route, { removed: false }));
  await page.route('**/v1/family/programmes', (route) => json(route, { beta: false }));

  // The stats dashboard, from the demo fixture, for this one child.
  await page.route(/\/v1\/students?(\/|\?|$)/, (route) => {
    const path = new URL(route.request().url()).pathname
      .replace(/^.*\/v1\//, '')
      .replace(CHILD.id, ':child');
    if (path === 'students') {
      return json(route, { students: [{ id: CHILD.id, nickname: CHILD.nickname }] });
    }
    const body = demo[path];
    return body === undefined ? route.fallback() : json(route, body);
  });

  return state;
}

/** No WCAG 2.2 A or AA problem axe can find, once the screen's animations have settled. */
async function expectAccessible(page: Page, where: string) {
  const results = await axeWhenSettled(page);
  expect(
    results.violations.map((v) => `${v.id}: ${v.help}`),
    `axe on ${where}`,
  ).toEqual([]);
}

test('a new parent signs in, adds a child, links their device and reads the stats', async ({
  page,
  baseURL,
}) => {
  test.setTimeout(60_000);
  const state = await stubParentApi(page);
  // Nothing leaves the app: no Google, no other site (the API's own host is fine when deployed).
  const allowed = allowedOrigins(baseURL!);
  const elsewhere: string[] = [];
  page.on('request', (request) => {
    if (isElsewhere(request.url(), allowed)) elsewhere.push(new URL(request.url()).origin);
  });

  // Sign in: the welcome page's Google button comes straight back, signed in, to the family.
  await page.goto('/');
  await expectAccessible(page, 'the welcome page');
  await page.getByRole('button', { name: /continue with google/i }).click();
  await expect.poll(() => state.signedIn).toBe(true);

  // A new parent has no children yet, so the family screen sends them to confirm the terms.
  await expect(page.getByRole('heading', { level: 1, name: 'Before you start' })).toBeVisible();
  await expectAccessible(page, 'the terms');
  await page
    .getByRole('checkbox', { name: /I have read the Terms of use and Privacy notice/ })
    .check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect.poll(() => state.accepted.length).toBeGreaterThan(0);

  // Add a child: a nickname, a school year and a subject (board and tier left as Not sure).
  await expect(page.getByRole('heading', { level: 1, name: "Who's studying?" })).toBeVisible();
  await expectAccessible(page, "Who's studying (empty)");
  await page.getByRole('button', { name: 'Add a child' }).click();
  await page.getByRole('textbox', { name: 'Nickname' }).fill(CHILD.nickname);
  await page.getByRole('radio', { name: 'Year 11' }).check();
  await page.getByRole('button', { name: 'Maths' }).click();
  await expectAccessible(page, 'Add a child');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect.poll(() => state.children.length).toBe(1);

  // The school report can wait.
  await expect(
    page.getByRole('heading', { level: 1, name: `School report for ${CHILD.nickname}` }),
  ).toBeVisible();
  await expectAccessible(page, 'the school report step');
  await page.getByRole('button', { name: 'Skip for now' }).click();

  // Link the child's device: the QR code shows, and the page notices when the device uses it.
  await expect(
    page.getByRole('img', { name: `QR code to link ${CHILD.nickname}'s device` }),
  ).toBeVisible();
  await expectAccessible(page, 'the QR code');
  await expect(
    page.getByRole('heading', { level: 1, name: `${CHILD.nickname}'s device is set up` }),
  ).toBeVisible({ timeout: 15_000 });
  await expectAccessible(page, 'the device set up');
  await page.getByRole('button', { name: 'Done' }).click();

  // Finish, then the family screen ("Who's revising?") lists the child.
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'All set!' })).toBeVisible();
  await expectAccessible(page, 'All set');
  await page.getByRole('link', { name: 'Go to the family screen' }).click();
  await expect(page.getByRole('heading', { level: 1, name: "Who's revising?" })).toBeVisible();
  await expectAccessible(page, "Who's revising");

  // The child's Parent home, then the stats dashboard.
  await page.getByRole('link', { name: new RegExp(`^${CHILD.nickname}'s avatar`) }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Parent home' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expectAccessible(page, 'Parent home');
  await page.getByRole('link', { name: 'Stats dashboard' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Stats dashboard' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Active study time' })).toBeVisible();
  await expectAccessible(page, 'the stats dashboard');
  expect(elsewhere, 'requests that left the app').toEqual([]);
});
