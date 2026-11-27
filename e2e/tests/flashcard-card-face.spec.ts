import { expect, test, type Page, type Route } from '@playwright/test';
import { axeWhenSettled } from './support/axe';

/*
 * F21: Explain sits on the turned-over card face, so revealing the answer moves nothing below the
 * card. F20: a card made from a multiple choice question shows its choices; tapping one is the
 * answer and sets the rating. Phone size 412x915. Made-up cards only (not educational content).
 */

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, json: body });
const STUDENT_ID = '00000000-0000-4000-8000-0000000002f1';
const base = {
  topicId: 'demo-topic-a',
  topicTitle: 'Demo topic A',
  subjectId: 'gcse-maths',
  draft: false,
  dueAt: '2026-11-25T10:00:00.000Z',
  nextReviewMs: { again: 600_000, hard: 86_400_000, good: 518_400_000, easy: 864_000_000 },
};
const plain = {
  ...base,
  id: '00000000-0000-4000-8000-0000000002a1',
  origin: 'deck',
  front: 'Demo front 1',
  back: 'Demo back 1',
  explain: ['Demo step one', 'Answer: Demo back 1'],
};
const choice = {
  ...base,
  id: '00000000-0000-4000-8000-0000000002a2',
  origin: 'wrong_answer',
  front: 'Demo choice question',
  back: 'Demo option B',
  options: ['Demo option A', 'Demo option B', 'Demo option C'],
  answerOption: 1,
  explain: ['Demo choice step', 'Answer: Demo option B'],
};

async function stub(page: Page, due: unknown[]) {
  const ratings: string[] = [];
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
  await page.route('**/v1/student/cards/due', (route) => json(route, { due: due.length }));
  await page.route(/\/v1\/student\/flashcards(\?extra=\d+)?$/, (route) =>
    json(route, {
      due,
      decks: [
        {
          topicId: 'demo-topic-a',
          title: 'Demo topic A',
          subjectId: 'gcse-maths',
          total: 2,
          due: 2,
        },
      ],
      mine: [],
      draftContent: false,
      dueToday: due.length,
      backlog: due.length,
      doneToday: false,
    }),
  );
  await page.route('**/v1/student/flashcards/sessions', (route) =>
    json(
      route,
      {
        id: '00000000-0000-4000-8000-0000000007a1',
        maxCards: 20,
        minCards: 5,
        xp: 20,
        rewardedLeftToday: 2,
      },
      201,
    ),
  );
  await page.route(/\/v1\/student\/flashcards\/[^/]+\/review$/, (route) => {
    const { rating } = route.request().postDataJSON() as { rating: string };
    ratings.push(rating);
    return json(route, { card: due[0], comesBackSooner: rating === 'again', cardsCounted: 1 });
  });
  return ratings;
}

async function expectAccessible(page: Page, where: string) {
  const results = await axeWhenSettled(page);
  expect(
    results.violations.map((v) => `${v.id}: ${v.help}`),
    `axe on ${where}`,
  ).toEqual([]);
}

const box = async (page: Page, selector: string) =>
  (await page.locator(selector).first().boundingBox())!;

test.use({ viewport: { width: 412, height: 915 } });

test('revealing a card moves nothing below it, and Explain is on the card', async ({ page }) => {
  await stub(page, [plain]);
  await page.goto('/cards');
  await expect(page.getByText('Demo front 1')).toBeVisible();
  const card = await box(page, '[data-testid="flip-card"]');
  const show = (await page.getByRole('button', { name: 'Show answer' }).boundingBox())!;

  await page.getByRole('button', { name: 'Show answer' }).click();
  await expect(page.getByText('Demo back 1')).toBeVisible();
  await page.waitForTimeout(600); // the turn
  const after = await box(page, '[data-testid="flip-card"]');
  const again = (await page.getByRole('button', { name: /^Again/ }).boundingBox())!;
  expect(Math.round(after.height)).toBe(Math.round(card.height));
  expect(Math.round(again.y)).toBe(Math.round(show.y));

  const explain = page.getByRole('button', { name: 'Explain' });
  const e = (await explain.boundingBox())!;
  expect(e.y).toBeGreaterThanOrEqual(after.y);
  expect(e.y + e.height).toBeLessThanOrEqual(after.y + after.height + 1);
  expect(e.height).toBeGreaterThanOrEqual(44);
  expect(e.width).toBeGreaterThanOrEqual(44);
  await expectAccessible(page, 'the revealed card');
  await explain.click();
  await expect(page.getByText('Demo step one')).toBeVisible();
});

test('a multiple choice card is answered by tapping a choice, which sets the rating', async ({
  page,
}) => {
  const ratings = await stub(page, [choice]);
  await page.goto('/cards');
  await expect(page.getByText('Demo choice question')).toBeVisible();
  const card = await box(page, '[data-testid="flip-card"]');
  const choices = page.getByRole('group', { name: 'Choose an answer' });
  for (const option of await choices.getByRole('button').all()) {
    const b = (await option.boundingBox())!;
    expect(b.y + b.height).toBeLessThanOrEqual(card.y + card.height + 1);
    expect(b.height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(412);
  await expectAccessible(page, 'the choice card');

  await choices.getByRole('button', { name: 'Demo option C' }).click();
  await expect(page.getByText('Not quite. The answer is:')).toBeVisible();
  await expectAccessible(page, 'the answered choice card');
  await page.getByRole('button', { name: 'Next card' }).click();
  await expect.poll(() => ratings).toEqual(['again']);
});
