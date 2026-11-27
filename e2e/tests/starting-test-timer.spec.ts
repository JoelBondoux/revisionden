import { expect, test, type Page, type Route } from '@playwright/test';

/*
 * F14: the starting test's one-minute warning and time up reach screen readers. The visible clock
 * stays quiet (aria-live off) so it never reads every second; a polite live region says "One
 * minute left." once and "Time is up." at the end. The clock is fast-forwarded, and the API is
 * stubbed with a made-up pupil and a made-up question (not educational content).
 */

const STUDENT_ID = '00000000-0000-4000-8000-0000000000e1';
const TEST_ID = '00000000-0000-4000-8000-0000000000e2';

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, json: body });

async function stubStartingTest(page: Page) {
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
  await page.route('**/v1/student/learn/starting-tests', (route) =>
    json(
      route,
      {
        id: TEST_ID,
        subjectId: 'gcse-maths',
        timeLimitSeconds: 300,
        items: [
          {
            id: '00000000-0000-4000-8000-0000000000e3',
            topicId: 'demo-topic',
            topicTitle: 'Demo topic',
            draft: false,
            type: 'short_answer',
            prompt: 'Demo starting question',
          },
        ],
        draftContent: false,
      },
      201,
    ),
  );
  await page.route(`**/v1/student/learn/starting-tests/${TEST_ID}/finish`, (route) =>
    json(route, { id: TEST_ID, correct: 0, answered: 0, total: 1, topics: [] }),
  );
}

test('the starting test tells screen readers at one minute left and when time is up', async ({
  page,
}) => {
  await page.clock.install();
  await stubStartingTest(page);
  await page.goto('/learn/subject/gcse-maths/start');
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByText('Demo starting question')).toBeVisible();

  const announcer = page.getByTestId('timer-announcer');
  await expect(announcer).toHaveAttribute('aria-live', 'polite');
  await expect(announcer).toHaveText('');
  await expect(page.locator('.timer')).toHaveAttribute('aria-live', 'off');

  await page.clock.fastForward('04:01');
  await expect(announcer).toHaveText('One minute left.');

  await page.clock.fastForward('01:00');
  await expect(page.getByRole('heading', { name: 'Your starting point' })).toBeVisible();
  // F14b: the same live region is still there on the results, now saying "Time is up."
  await expect(announcer).toHaveText('Time is up.');
});

// F17 (WCAG 2.2.1 extend): in the last minute a pupil can add two minutes, up to ten times, and
// the button fits beside the clock on a small phone with text at 200%.
test('the starting test offers more time in the last minute, and it fits a small phone at 200% text', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.clock.install();
  await stubStartingTest(page);
  await page.goto('/learn/subject/gcse-maths/start');
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByText('Demo starting question')).toBeVisible();
  const more = page.getByRole('button', { name: 'More time' });
  await expect(more).toHaveCount(0);

  await page.clock.fastForward('04:01');
  await expect(more).toBeVisible();
  const box = await more.boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await more.click();
  await expect(page.getByTestId('timer-announcer')).toHaveText('2 more minutes added.');
  await expect(page.locator('.timer')).toHaveText(/^2:5\d left$/);
  await expect(more).toHaveCount(0);
});
