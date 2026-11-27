import { expect, test, type Browser, type Page, type Route } from '@playwright/test';
import { axeWhenSettled } from './support/axe';
import topicMap from './fixtures/topic-map-gcse-maths.json' with { type: 'json' };

/*
 * W20: parent settings that change what a pupil sees (docs/TESTING.md section 6, gap 3). A parent
 * on one phone and their child on another share one family, kept in memory for the test: the
 * parent's changes are what the child's next screen is built from.
 *
 * - Subjects: the parent moves Maths from Higher to Foundation and adds Physics; the child's map
 *   then says GCSE Foundation and offers Physics in Subject selection.
 * - Friends: the parent turns friends on; the child's league page stops saying "Ask a parent".
 * - Reminders: the parent changes the times and they are saved. The child sees reminders only as
 *   phone notifications, which this suite cannot show, so only the parent's side is checked.
 *
 * The stubs stand in for the API (its own tests cover how it stores these); this checks that both
 * apps send and show the right thing. Everything is made up: an invented child, no real names,
 * no emails, and no sign-in provider is called.
 */

const CHILD = { id: '00000000-0000-4000-8000-0000000000b1', nickname: 'TestOwl' };

test.skip(({ isMobile }) => !isMobile, 'a phone journey (the phone project)');

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, json: body });

type Enrolment = { subjectId: string; board: string; tier: string };

/** One family's settings, shared by the parent's phone and the child's. */
function family() {
  return {
    enrolments: [{ subjectId: 'gcse-maths', board: 'not_sure', tier: 'higher' }] as Enrolment[],
    friendsAllowed: false,
    reminders: {
      enabled: true,
      streakReminders: true,
      sessionReminders: true,
      quietStart: '21:00',
      quietEnd: '07:00',
      weekdayQuietStart: '08:30',
      weekdayQuietEnd: '15:30',
      sessionReminderTime: '17:00',
      streakReminderTime: '19:00',
      timeZone: 'Europe/London',
      maxPerDay: 2,
    },
    saves: [] as { what: string; body: unknown }[],
  };
}
type Family = ReturnType<typeof family>;

const SUBJECT_NAMES: Record<string, string> = { 'gcse-maths': 'Maths', 'gcse-physics': 'Physics' };
const TIER_WORD: Record<string, string> = {
  higher: 'Higher',
  foundation: 'Foundation',
  not_sure: '',
};

async function notStubbed(page: Page) {
  await page.route('**/v1/**', (route) =>
    json(route, { error: { code: 'not_found', message: 'Not stubbed', ref: 'RD-E2E000' } }, 404),
  );
  await page.route('**/v1/client-errors', (route) => route.fulfill({ status: 204 }));
}

/** The parent's phone: signed in (no provider called) with one child. */
async function parentPhone(browser: Browser, fam: Family) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
  });
  const page = await context.newPage();
  await notStubbed(page);
  await page.route('**/api/auth/**', (route) =>
    new URL(route.request().url()).pathname.endsWith('/get-session')
      ? json(route, { user: { id: 'parent-e2e' }, session: {} })
      : json(route, {}),
  );
  const child = () => ({
    student: {
      id: CHILD.id,
      nickname: CHILD.nickname,
      avatarCode: '1' + '0'.repeat(28),
      yearGroup: 11,
    },
    enrolments: fam.enrolments.map((e) => ({ studentId: CHILD.id, ...e })),
    level: 'gcse',
    examSeason: { season: 'summer', year: 2027 },
    toCheckLater: 0,
    linkedDevices: 1,
  });
  await page.route('**/v1/onboarding/family', (route) => json(route, { children: [child()] }));
  await page.route('**/v1/students', (route) =>
    json(route, { students: [{ id: CHILD.id, nickname: CHILD.nickname }] }),
  );

  // Subjects: the list, one subject's board or tier, adding and removing.
  const base = `**/v1/students/${CHILD.id}`;
  await page.route(`${base}/subjects`, (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Enrolment;
      fam.saves.push({ what: 'add subject', body });
      fam.enrolments.push({ subjectId: body.subjectId, board: body.board, tier: body.tier });
      return json(route, { studentId: CHILD.id, ...body }, 201);
    }
    return json(route, {
      subjects: fam.enrolments.map((e) => ({
        studentId: CHILD.id,
        ...e,
        hasQuestions: e.subjectId === 'gcse-maths',
      })),
    });
  });
  await page.route(`${base}/enrolments/*`, (route) => {
    const subjectId = decodeURIComponent(
      new URL(route.request().url()).pathname.split('/').at(-1)!,
    );
    const change = route.request().postDataJSON() as Partial<Enrolment>;
    fam.saves.push({ what: `change ${subjectId}`, body: change });
    const e = fam.enrolments.find((x) => x.subjectId === subjectId)!;
    Object.assign(e, change);
    return json(route, { studentId: CHILD.id, ...e });
  });

  // Friends: the child's friends card.
  await page.route(`${base}/friends`, (route) =>
    json(route, {
      allowed: fam.friendsAllowed,
      hidden: false,
      friends: [],
      waitingForYou: [],
      waitingForOther: [],
      blocked: [],
      reports: [],
    }),
  );
  await page.route(`${base}/friends/allowed`, (route) => {
    const { allowed } = route.request().postDataJSON() as { allowed: boolean };
    fam.saves.push({ what: 'friends allowed', body: { allowed } });
    fam.friendsAllowed = allowed;
    return route.fulfill({ status: 204 });
  });

  // Reminders.
  await page.route(`${base}/reminder-settings`, (route) => {
    if (route.request().method() !== 'GET') {
      const update = route.request().postDataJSON() as Partial<Family['reminders']>;
      fam.saves.push({ what: 'reminders', body: update });
      Object.assign(fam.reminders, update);
    }
    return json(route, fam.reminders);
  });
  return { context, page };
}

/** The child's phone: this device is theirs, and their map and league follow the family. */
async function childPhone(browser: Browser, fam: Family) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
  });
  const page = await context.newPage();
  await page.addInitScript((id) => localStorage.setItem('revisionden.studentId', id), CHILD.id);
  await notStubbed(page);
  await page.route('**/v1/student/avatar', (route) =>
    json(route, { avatarCode: '1' + '0'.repeat(28), earnedRewardIds: [] }),
  );
  await page.route('**/v1/student/cards/due', (route) => json(route, { due: 0 }));
  await page.route('**/v1/student/map**', (route) => {
    const maths = fam.enrolments.find((e) => e.subjectId === 'gcse-maths')!;
    return json(route, {
      ...topicMap,
      qualification: `GCSE ${TIER_WORD[maths.tier]}`.trim(),
      subjects: fam.enrolments.map((e) => ({
        subjectId: e.subjectId,
        subject: SUBJECT_NAMES[e.subjectId] ?? e.subjectId,
        hasContent: e.subjectId === 'gcse-maths',
      })),
    });
  });
  await page.route('**/v1/student/friends', (route) =>
    json(route, { allowed: fam.friendsAllowed, hidden: false, friends: [], waiting: [] }),
  );
  await page.route('**/v1/student/league', (route) =>
    json(route, {
      week: { start: '2026-11-23', end: '2026-11-29' },
      hidden: false,
      lastWeek: null,
      entries: [],
    }),
  );
  return { context, page };
}

/** No WCAG 2.2 A or AA problem axe can find, once the screen's animations have settled. */
async function expectAccessible(page: Page, where: string) {
  const results = await axeWhenSettled(page);
  expect(
    results.violations.map(
      (v) => `${v.id}: ${v.help} [${v.nodes.map((n) => n.target.join(' ')).join(', ')}]`,
    ),
    `axe on ${where}`,
  ).toEqual([]);
}

test("a parent's subject changes reach the child's map", async ({ browser }) => {
  test.setTimeout(60_000);
  const fam = family();
  const parent = await parentPhone(browser, fam);
  const child = await childPhone(browser, fam);

  // Before: the child's map says GCSE Higher and only Maths.
  await child.page.goto('/map');
  await expect(child.page.getByText('GCSE Higher')).toBeVisible();

  // The parent moves Maths to Foundation and adds Physics (board left as Not sure).
  await parent.page.goto(`/parent/subjects/${CHILD.id}`);
  await expect(
    parent.page.getByRole('heading', { level: 1, name: `${CHILD.nickname}'s subjects` }),
  ).toBeVisible();
  await expectAccessible(parent.page, 'Subjects');
  // The choice is saved, then shown as chosen once the list reloads.
  const foundation = parent.page
    .getByRole('radiogroup', { name: 'Maths tier' })
    .getByRole('radio', { name: 'Foundation' });
  await foundation.click();
  await expect.poll(() => fam.enrolments[0]!.tier).toBe('foundation');
  await expect(foundation).toBeChecked();
  await parent.page
    .getByRole('group', { name: 'Add a subject' })
    .getByRole('button', { name: 'Physics' })
    .click();
  await parent.page.getByRole('button', { name: 'Add Physics' }).click();
  await expect(parent.page.getByRole('heading', { name: 'Physics' })).toBeVisible();
  await expectAccessible(parent.page, 'Subjects, after the changes');
  expect(fam.saves).toEqual([
    { what: 'change gcse-maths', body: { tier: 'foundation' } },
    {
      what: 'add subject',
      body: expect.objectContaining({ subjectId: 'gcse-physics', board: 'not_sure' }),
    },
  ]);

  // After: the child's map says GCSE Foundation, and Subject selection offers Physics.
  await child.page.reload();
  await expect(child.page.getByText('GCSE Foundation')).toBeVisible();
  await child.page.getByRole('button', { name: /^Your subject Maths Change$/ }).click();
  const pick = child.page.getByRole('region', { name: 'Pick a subject' });
  // UX-1: Physics has no questions yet, so it sits in the folded coming-soon line.
  await pick.getByText(/more subjects? coming soon$/).click();
  await expect(pick.getByText('Physics')).toBeVisible();
  await expectAccessible(child.page, 'Subject selection');

  await parent.context.close();
  await child.context.close();
});

test("a parent turning friends on opens the child's friends league", async ({ browser }) => {
  const fam = family();
  const parent = await parentPhone(browser, fam);
  const child = await childPhone(browser, fam);

  await child.page.goto('/league');
  await expect(child.page.getByText(/Ask a parent to turn on friends/)).toBeVisible();

  await parent.page.goto(`/parent/friends/${CHILD.id}?name=${CHILD.nickname}`);
  await expect(parent.page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible();
  await expectAccessible(parent.page, 'Friends (off)');
  const allow = parent.page.getByRole('checkbox');
  await expect(allow).not.toBeChecked();
  await allow.click();
  await expect.poll(() => fam.friendsAllowed).toBe(true);
  await expect(allow).toBeChecked();
  await expectAccessible(parent.page, 'Friends (on)');

  await child.page.reload();
  await expect(child.page.getByRole('heading', { level: 1, name: 'Friends league' })).toBeVisible();
  await expect(child.page.getByText(/Ask a parent to turn on friends/)).toHaveCount(0);
  await expectAccessible(child.page, 'the friends league, on');

  await parent.context.close();
  await child.context.close();
});

test("a parent's reminder times are saved and still there when they come back", async ({
  browser,
}) => {
  const fam = family();
  const parent = await parentPhone(browser, fam);
  const page = parent.page;

  await page.goto(`/parent/reminders/${CHILD.id}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Reminder times' })).toBeVisible();
  await expect(page.getByLabel('Session reminder at')).toHaveValue('17:00');
  await expectAccessible(page, 'Reminder times');

  await page.getByLabel('Session reminder at').fill('16:30');
  await page.getByRole('checkbox', { name: 'Streak reminders' }).uncheck();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();
  expect(fam.saves.at(-1)).toEqual({
    what: 'reminders',
    body: expect.objectContaining({ sessionReminderTime: '16:30', streakReminders: false }),
  });

  await page.reload();
  await expect(page.getByLabel('Session reminder at')).toHaveValue('16:30');
  await expect(page.getByRole('checkbox', { name: 'Streak reminders' })).not.toBeChecked();
  await expectAccessible(page, 'Reminder times, after saving');

  await parent.context.close();
});
