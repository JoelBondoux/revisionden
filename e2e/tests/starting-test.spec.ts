import { expect, test, type Page, type Route } from '@playwright/test';
import { axeWhenSettled } from './support/axe';

/*
 * W19: the starting test walked to its result on a phone (docs/TESTING.md section 6, gap 2).
 * A pupil starts it, answers one question, skips one and finishes on the last, then sees their
 * starting point and goes on to learn. A second walk runs the timer down with Playwright's clock
 * (no real waiting): the one-minute warning, then time up, which marks what was answered.
 *
 * Test mode stays quiet until the end: no marks while answering, and the bug button is hidden.
 * The API is stubbed and kept in memory for one test. Everything is made up: a made-up pupil and
 * made-up questions and topics (not educational content), no real names.
 */

const STUDENT_ID = '00000000-0000-4000-8000-0000000000f1';
const SUBJECT = 'gcse-maths';
const TEST_ID = '00000000-0000-4000-8000-0000000000f2';
const TIME_LIMIT = 300;

test.skip(({ isMobile }) => !isMobile, 'a phone journey (the phone project)');

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, json: body });

const ITEMS = [1, 2, 3].map((n) => ({
  id: `00000000-0000-4000-8000-0000000001f${n}`,
  topicId: `demo-topic-${n}`,
  topicTitle: `Demo topic ${n}`,
  draft: false,
  type: 'short_answer' as const,
  prompt: `Demo starting question ${n}`,
}));

/** A pupil on this phone, with the starting test's side of the API; the rest answers 404. */
async function stubStartingTest(page: Page) {
  const state = {
    started: 0,
    attempts: [] as { itemId: string; mode: string; startingTestId: string }[],
    finished: 0,
  };
  await page.addInitScript(
    (id) => window.localStorage.setItem('revisionden.studentId', id),
    STUDENT_ID,
  );
  await page.route('**/v1/**', (route) =>
    json(route, { error: { code: 'not_found', message: 'Not stubbed', ref: 'RD-E2E000' } }, 404),
  );
  await page.route('**/v1/client-errors', (route) => route.fulfill({ status: 204 }));
  await page.route('**/v1/student/avatar', (route) =>
    json(route, { avatarCode: '1' + '0'.repeat(28), earnedRewardIds: [] }),
  );
  await page.route('**/v1/student/learn/starting-tests', (route) => {
    state.started += 1;
    return json(
      route,
      {
        id: TEST_ID,
        subjectId: SUBJECT,
        timeLimitSeconds: TIME_LIMIT,
        items: ITEMS,
        draftContent: false,
      },
      201,
    );
  });
  await page.route('**/v1/student/learn/attempts', (route) => {
    const body = route.request().postDataJSON() as {
      itemId: string;
      mode: string;
      startingTestId: string;
    };
    state.attempts.push({
      itemId: body.itemId,
      mode: body.mode,
      startingTestId: body.startingTestId,
    });
    return json(route, {
      id: `00000000-0000-4000-8000-0000000002f${state.attempts.length}`,
      itemId: body.itemId,
      correct: state.attempts.length === 1,
      score: state.attempts.length === 1 ? 1 : 0,
      xpEarned: 0,
      createdAt: '2026-11-26T10:00:00.000Z',
      feedback: { correctAnswer: 'demo' },
      progress: {
        xpToday: 0,
        totalXp: 0,
        dailyGoalXp: 50,
        goalMet: false,
        streak: { current: 0, best: 0, skipDays: 0 },
      },
      flashcardAdded: false,
      combo: 0,
      comboBonusXp: 0,
      newlyEarned: [],
    });
  });
  await page.route(`**/v1/student/learn/starting-tests/${TEST_ID}/finish`, (route) => {
    state.finished += 1;
    const answered = state.attempts.length;
    return json(route, {
      id: TEST_ID,
      correct: Math.min(answered, 1),
      answered,
      total: ITEMS.length,
      topics: ITEMS.map((item, i) => ({
        topicId: item.topicId,
        title: item.topicTitle,
        mastery: i === 0 && answered > 0 ? 60 : 0,
      })),
    });
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

const timer = (page: Page) => page.locator('.lesson__top .timer');

test('a pupil takes the starting test, answering, skipping and finishing, then starts learning', async ({
  page,
}) => {
  const state = await stubStartingTest(page);
  await page.goto(`/learn/subject/${SUBJECT}/start`);
  await expect(page.getByRole('heading', { level: 1, name: 'Starting test' })).toBeVisible();
  await expect(page.getByText('This takes about 5 minutes.')).toBeVisible();
  await expectAccessible(page, 'the starting test intro');
  await page.getByRole('button', { name: 'Start' }).click();

  // Question 1: answered. Test mode says nothing about it being right or wrong.
  await expect(page.getByText(ITEMS[0]!.prompt)).toBeVisible();
  await expect(timer(page)).toHaveText(/^[45]:\d\d left$/);
  await expect(page.getByRole('button', { name: 'Report a bug' })).toHaveCount(0);
  await expectAccessible(page, 'the first question');
  await page.getByLabel('Your answer').fill('demo');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect.poll(() => state.attempts.length).toBe(1);
  await expect(page.locator('.feedback')).toHaveCount(0);

  // Question 2: skipped, so nothing is sent for it.
  await expect(page.getByText(ITEMS[1]!.prompt)).toBeVisible();
  await page.getByRole('button', { name: 'Skip' }).click();

  // Question 3, the last: Finish.
  await expect(page.getByText(ITEMS[2]!.prompt)).toBeVisible();
  await page.getByLabel('Your answer').fill('demo');
  await page.getByRole('button', { name: 'Finish' }).click();

  const result = page.locator('.complete');
  await expect(result.getByRole('heading', { name: 'Your starting point' })).toBeVisible();
  await expect(result.getByText('You got 1 of 3 right.')).toBeVisible();
  await expect(result.getByText('Time is up')).toHaveCount(0);
  await expect(result.getByRole('progressbar', { name: 'Demo topic 1 mastery' })).toHaveAttribute(
    'aria-valuetext',
    '60%',
  );
  // The bug button is back once the results are shown.
  await expect(page.getByRole('button', { name: 'Report a bug' })).toBeVisible();
  await expectAccessible(page, 'the starting point');
  expect(state).toEqual({
    started: 1,
    attempts: [ITEMS[0]!, ITEMS[2]!].map((item) => ({
      itemId: item.id,
      mode: 'test',
      startingTestId: TEST_ID,
    })),
    finished: 1,
  });

  await result.getByRole('link', { name: 'Start learning' }).click();
  await expect(page).toHaveURL(new RegExp(`/learn/subject/${SUBJECT}$`));
});

test('the starting test warns at one minute left and, at time up, marks what was answered', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-11-26T10:00:00Z') });
  const state = await stubStartingTest(page);
  await page.goto(`/learn/subject/${SUBJECT}/start`);
  // W19b (Codex, train #378): hold the clock still before the countdown starts, so the clicks
  // below take no test time on a slow machine; only runFor moves it.
  await page.clock.pauseAt(new Date('2026-11-26T10:00:30Z'));
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByText(ITEMS[0]!.prompt)).toBeVisible();
  await expect(timer(page)).toHaveText('5:00 left');
  await expect(timer(page)).not.toHaveClass(/timer--warning/);

  await page.getByLabel('Your answer').fill('demo');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect.poll(() => state.attempts.length).toBe(1);

  // Four minutes in: still calm at 1:01.
  await page.clock.runFor('03:59');
  await expect(timer(page)).toHaveText('1:01 left');
  await expect(timer(page)).not.toHaveClass(/timer--warning/);

  // At one minute left the clock turns to its warning look.
  await page.clock.runFor('00:01');
  await expect(timer(page)).toHaveText('1:00 left');
  await expect(timer(page)).toHaveClass(/timer--warning/);
  // The clock runs again from here: axe waits for animations, which a paused clock holds still.
  await page.clock.resume();
  await expectAccessible(page, 'the one-minute warning');

  // Time up: the test ends by itself and marks the one answer given.
  await page.clock.runFor('01:00');
  const result = page.locator('.complete');
  await expect(result.getByRole('heading', { name: 'Your starting point' })).toBeVisible();
  await expect(result.getByText('Time is up, so we marked what you answered.')).toBeVisible();
  await expect(result.getByText('You got 1 of 3 right.')).toBeVisible();
  expect(state.finished).toBe(1);
  expect(state.attempts).toHaveLength(1);
  await expectAccessible(page, 'the starting point after time up');
});
