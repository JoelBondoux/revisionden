import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * The interactive lesson pilot (W8): the area model steps of the A4 lesson, by touch and by
 * keyboard. The lesson API is stubbed with made-up ids; the questions are the pilot's own.
 */

const EXPLORE = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a01';
const GUIDED = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a02';
const topic = {
  topicId: 'gcse-maths-h-a4',
  topicTitle: 'Simplifying, expanding and factorising',
  draft: true,
};
const items = [
  {
    ...topic,
    id: EXPLORE,
    type: 'area_model',
    mode: 'explore',
    prompt: 'Make x^2 + 5x + 6 into a rectangle.',
    quadratic: { b: 5, c: 6 },
  },
  {
    ...topic,
    id: GUIDED,
    type: 'area_model',
    mode: 'guided',
    prompt: 'Make x^2 + 6x + 8 into a rectangle.',
    quadratic: { b: 6, c: 8 },
    hint: 'List the pairs of numbers that multiply to 8, then find the pair that adds to 6.',
    askHelped: true,
  },
];
const right: Record<string, string> = { [EXPLORE]: '2,3', [GUIDED]: '2,4' };
const brackets: Record<string, string> = {
  [EXPLORE]: '(x + 2)(x + 3)',
  [GUIDED]: '(x + 2)(x + 4)',
};

/** The step's question; the power shows as a superscript (F9), so match the rest of it. */
const prompt = (page: Page, rest: string) =>
  page.locator('.question__prompt', { hasText: `+ ${rest} into a rectangle` });

async function stubLesson(page: Page, { draft = true } = {}) {
  const feedback: unknown[] = [];
  const attempts: unknown[] = [];
  await page.addInitScript(() => localStorage.setItem('revisionden.studentId', 'student-e2e'));
  await page.route('**/v1/student/recall*', (route) => route.fulfill({ status: 404, json: {} }));
  await page.route('**/v1/student/learn/lesson*', (route) =>
    route.fulfill({
      json: { items: items.map((i) => ({ ...i, draft })), draftContent: draft },
    }),
  );
  await page.route('**/v1/student/learn/attempts', async (route) => {
    const body = route.request().postDataJSON() as { itemId: string; answer: string };
    attempts.push(body);
    const correct = right[body.itemId] === body.answer;
    await route.fulfill({
      json: {
        id: '7a1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a00',
        itemId: body.itemId,
        correct,
        score: correct ? 1 : 0,
        xpEarned: correct ? 10 : 0,
        createdAt: '2026-11-26T12:00:00.000Z',
        feedback: { correctAnswer: brackets[body.itemId] },
        progress: {
          xpToday: 10,
          totalXp: 10,
          dailyGoalXp: 50,
          goalMet: false,
          streak: { current: 1, best: 1, skipDays: 0 },
        },
        flashcardAdded: false,
        newlyEarned: [],
      },
    });
  });
  await page.route('**/v1/student/feedback', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    feedback.push(route.request().postDataJSON());
    await route.fulfill({ status: 201, json: {} });
  });
  return { feedback, attempts };
}

test('the area model lesson by touch: tap a tile, pick the pair, check, and say it helped', async ({
  page,
}) => {
  const { feedback, attempts } = await stubLesson(page);
  await page.goto('/learn/topic/gcse-maths-h-a4');
  await expect(prompt(page, '5x + 6')).toBeVisible();

  await page.getByRole('button', { name: 'The x² square' }).click();
  await expect(page.getByTestId('area-term-square')).toHaveClass(/area-term--lit/);
  await expect(page.locator('.area-status')).toContainText('It is x by x');

  await page.getByRole('radio', { name: '2 and 3' }).check();
  await expect(page.getByTestId('area-sides')).toHaveText('The sides are x + 3 and x + 2.');
  await page.getByRole('button', { name: 'Check' }).click();
  await page.getByRole('button', { name: /Continue|Finish/ }).click();

  await expect(prompt(page, '6x + 8')).toBeVisible();
  await page.getByRole('radio', { name: '2 and 4' }).check();
  await page.getByRole('button', { name: 'Check' }).click();
  const helped = page.getByRole('group', { name: 'Did this help?' });
  await helped.getByRole('button', { name: 'Yes' }).click();
  await expect(page.getByText('Thanks for telling us.')).toBeVisible();

  expect(attempts).toEqual([
    expect.objectContaining({ itemId: EXPLORE, answer: '2,3' }),
    expect.objectContaining({ itemId: GUIDED, answer: '2,4' }),
  ]);
  expect(feedback).toEqual([{ kind: 'lesson_helped', itemId: GUIDED }]);
});

test('the area model step works by keyboard alone', async ({ page }) => {
  const { attempts } = await stubLesson(page);
  await page.goto('/learn/topic/gcse-maths-h-a4');
  const square = page.getByRole('button', { name: 'The x² square' });
  await expect(square).toBeVisible();
  // Tab to the square tile and light it with Enter.
  for (let i = 0; i < 40 && !(await square.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press('Tab');
  }
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('area-term-square')).toHaveClass(/area-term--lit/);
  // On to the pairs: the first radio, then the arrow key to the second.
  const firstPair = page.getByRole('radio', { name: '1 and 6' });
  for (
    let i = 0;
    i < 20 && !(await firstPair.evaluate((el) => el === document.activeElement));
    i++
  ) {
    await page.keyboard.press('Tab');
  }
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: '2 and 3' })).toBeChecked();
  const check = page.getByRole('button', { name: 'Check' });
  for (let i = 0; i < 20 && !(await check.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press('Tab');
  }
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /Continue|Finish/ })).toBeVisible();
  expect(attempts).toEqual([expect.objectContaining({ itemId: EXPLORE, answer: '2,3' })]);
});

test('the area model step is accessible', async ({ page }) => {
  await stubLesson(page);
  await page.goto('/learn/topic/gcse-maths-h-a4');
  await page.getByRole('radio', { name: '2 and 3' }).check();
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

test.describe('on a 320px screen with text at 200%', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  test('the area model step fits with no sideways scroll', async ({ page }) => {
    await stubLesson(page);
    await page.goto('/learn/topic/gcse-maths-h-a4');
    await expect(page.getByRole('radio', { name: '2 and 3' })).toBeVisible();
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await page.getByRole('radio', { name: '2 and 3' }).check();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe('single screen for doing things (390 × 844, default text)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the question, tiles, pairs and Check all fit without scrolling', async ({ page }) => {
    // As students will see it: verified content, so no development-only DRAFT banner.
    await stubLesson(page, { draft: false });
    await page.goto('/learn/topic/gcse-maths-h-a4');
    for (const pairChosen of [false, true]) {
      if (pairChosen) await page.getByRole('radio', { name: '2 and 3' }).check();
      await expect(prompt(page, '5x + 6')).toBeInViewport({
        ratio: 1,
      });
      await expect(page.locator('.area-svg')).toBeInViewport({ ratio: 1 });
      await expect(page.getByRole('radio', { name: '2 and 3' })).toBeInViewport({ ratio: 1 });
      await expect(page.getByRole('button', { name: 'Check' })).toBeInViewport({ ratio: 1 });
    }
  });
});
