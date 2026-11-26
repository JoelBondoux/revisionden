import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import topicMap from './fixtures/topic-map-gcse-maths.json' with { type: 'json' };

/*
 * The friends league (FL, docs/FRIENDS_LEAGUE.md). Made-up nicknames only; the API is served by
 * page.route. The league table and its main action fit one phone screen, and the Map still fits
 * one screen with the rank chip in its header.
 */

const STUDENT_ID = '00000000-0000-4000-8000-0000000000a1';
const AVATAR = '10000000000000000000000000000';

const entry = (nickname: string, xp: number, place: number | null, you = false) => ({
  nickname,
  avatarCode: AVATAR,
  title: place === 1 ? 'Bright Explorer' : null,
  xp,
  place,
  winning: place === 1,
  you,
});

const league = {
  week: { start: '2026-11-23', end: '2026-11-29' },
  hidden: false,
  lastWeek: { xp: 200, place: 1, won: true },
  entries: [
    entry('Wren_2', 240, 1),
    entry('Lark_1', 180, 2, true),
    ...Array.from({ length: 8 }, (_, i) => entry(`Pal_${i + 3}`, 150 - i * 10, i + 3)),
    entry('Comet_9', 0, null),
  ],
};

const friends = {
  allowed: true,
  hidden: false,
  friends: league.entries
    .filter((e) => !e.you)
    .map((e, i) => ({
      id: `00000000-0000-4000-8000-00000000f0${String(i).padStart(2, '0')}`,
      nickname: e.nickname,
      avatarCode: AVATAR,
      title: e.title,
      sibling: false,
    })),
  waiting: [],
};

async function serveLeague(page: Page) {
  await page.route('**/v1/**', (route) => route.fulfill({ status: 404, json: { error: 'none' } }));
  await page.route('**/v1/student/league', (route) => route.fulfill({ json: league }));
  await page.route('**/v1/student/friends', (route) => route.fulfill({ json: friends }));
  await page.route('**/v1/student/friends/codes', (route) =>
    route.fulfill({ status: 201, json: { code: 'ABCD-2345', expiresAt: '2026-11-28T10:00:00Z' } }),
  );
  await page.route('**/v1/student/friends/redeem', (route) =>
    route.fulfill({
      status: 201,
      json: { requestId: 'r-1', friend: { nickname: 'Nova_7', avatarCode: AVATAR, title: null } },
    }),
  );
  await page.route('**/v1/student/friends/requests/*/confirm', (route) =>
    route.fulfill({ json: { status: 'parents' } }),
  );
  await page.addInitScript((id) => localStorage.setItem('revisionden.studentId', id), STUDENT_ID);
}

test.beforeEach(async ({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== 'phone', 'The league layout checks are phone checks');
});

test('at 390 × 844 the league of 11 and its buttons fit one screen, with no sideways scroll', async ({
  page,
}) => {
  await serveLeague(page);
  await page.goto('/league');
  const table = page.getByRole('list', { name: 'This week' });
  await expect(table.getByRole('listitem')).toHaveCount(11);
  await expect(page.getByRole('button', { name: 'Add a friend' })).toBeInViewport({ ratio: 1 });
  const nav = (await page.locator('.main-nav').boundingBox())!;
  const add = (await page.getByRole('button', { name: 'Add a friend' }).boundingBox())!;
  expect(add.y + add.height).toBeLessThanOrEqual(nav.y);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBe(0);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});

test('adds a friend: show my code, type a code, check who it is, then wait for parents', async ({
  page,
}) => {
  await serveLeague(page);
  await page.goto('/league');
  await page.getByRole('button', { name: 'Add a friend' }).click();
  await page.getByRole('button', { name: 'Show my code' }).click();
  await expect(page.getByText('ABCD-2345')).toBeVisible();
  await page.getByLabel("Friend's code").fill('wxyz 2345');
  await page.getByRole('button', { name: 'Check code' }).click();
  await expect(page.getByText('Is this your friend?')).toBeVisible();
  await page.getByRole('button', { name: 'Yes, this is my friend' }).click();
  await expect(page.getByText(/a parent in each family needs to say yes/)).toBeVisible();
});

test('Home still fits one screen with the league chip in place of "Soon"', async ({ page }) => {
  await serveLeague(page);
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
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
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
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/home');
  await expect(page.getByRole('link', { name: "You're 2nd this week" })).toBeVisible();
  await expect(page.getByText('Soon')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /^Go:/ })).toBeInViewport({ ratio: 1 });
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
