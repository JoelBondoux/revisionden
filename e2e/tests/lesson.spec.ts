import { expect, test, type Page } from '@playwright/test';

/**
 * J14: the lesson screen. Made-up items (not educational); the lesson API is stubbed. The answer
 * field reflows at 320 px with text at 200% (WCAG 1.4.4, 1.4.10), and Pip in the lesson header
 * reacts to each marked answer.
 */
const STUDENT_ID = '00000000-0000-4000-8000-0000000000d4';
const ITEM_ID = '00000000-0000-4000-8000-000000000a01';
const item = {
  id: ITEM_ID,
  topicId: 'demo-topic',
  topicTitle: 'Demo topic',
  draft: false,
  type: 'short_answer',
  prompt: 'Demo question',
  hint: 'Demo clue',
  canHelp: true,
};

async function stubLesson(page: Page, correct = true) {
  await page.addInitScript(
    (id) => window.localStorage.setItem('revisionden.studentId', id),
    STUDENT_ID,
  );
  await page.route('**/v1/student/recall*', (route) => route.fulfill({ status: 404, json: {} }));
  await page.route('**/v1/student/avatar', (route) =>
    route.fulfill({ json: { avatarCode: '1' + '0'.repeat(28), earnedRewardIds: [] } }),
  );
  await page.route('**/v1/student/learn/command-words', (route) =>
    route.fulfill({ json: { items: [item], draftContent: false } }),
  );
  await page.route('**/v1/student/learn/lesson**', (route) =>
    route.fulfill({
      json: { items: [item, { ...item, id: `${ITEM_ID.slice(0, -1)}2` }], draftContent: false },
    }),
  );
  await page.route('**/v1/student/learn/attempts', (route) =>
    route.fulfill({
      json: {
        id: '00000000-0000-4000-8000-000000000a09',
        itemId: ITEM_ID,
        correct,
        score: correct ? 1 : 0,
        xpEarned: correct ? 10 : 0,
        createdAt: '2026-11-26T10:00:00.000Z',
        feedback: { correctAnswer: 'demo' },
        progress: {
          xpToday: 10,
          totalXp: 10,
          dailyGoalXp: 50,
          goalMet: false,
          streak: { current: 0, best: 0, skipDays: 0 },
        },
        flashcardAdded: !correct,
        combo: correct ? 1 : 0,
        comboBonusXp: 0,
        newlyEarned: [],
      },
    }),
  );
}

const sideways = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe('on a 320px screen with text at 200%', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  test('the question, answer field, clue and Check reflow with no sideways scroll', async ({
    page,
  }) => {
    await stubLesson(page);
    await page.goto('/learn/topic/demo-topic');
    await expect(page.getByLabel('Your answer')).toBeVisible();
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await page.getByLabel('Your answer').fill('demo answer that is quite long');
    expect(await sideways(page)).toBeLessThanOrEqual(0);
    for (const control of [
      page.getByLabel('Your answer'),
      page.getByRole('button', { name: 'Check' }),
    ]) {
      const box = (await control.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(320);
    }
  });
});

test('Pip nods at a right answer, then rests', async ({ page }) => {
  await stubLesson(page);
  await page.goto('/learn/topic/demo-topic');
  const pip = page.locator('.lesson__top svg.pip-figure');
  await expect(pip).toHaveClass(/pip-figure--rest/);
  await page.getByLabel('Your answer').fill('demo');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(pip).toHaveClass(/pip-figure--nod/);
  await expect(pip).toHaveClass(/pip-figure--rest/);
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('Pip stays still when an answer is marked', async ({ page }) => {
    await stubLesson(page, false);
    await page.goto('/learn/topic/demo-topic');
    await page.getByLabel('Your answer').fill('not it');
    await page.getByRole('button', { name: 'Check' }).click();
    await expect(page.getByRole('status', { name: 'Answer feedback' })).toBeVisible();
    await expect(page.locator('.lesson__top svg.pip-figure')).toHaveClass(/pip-figure--rest/);
  });
});

// J14b: one compact header. Pip, the way out, the progress bar and XP share one row; Pip's line
// sits beside the student's avatar, and the question starts high on a 390 × 844 phone.
test.describe('at 390 × 844', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('one Pip in one header row, the avatar beside his line, and the question high up', async ({
    page,
  }) => {
    await stubLesson(page);
    await page.goto('/learn/topic/demo-topic');
    await expect(page.getByText('Demo question')).toBeVisible();
    await expect(page.locator('svg.pip-figure:visible')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Home' })).toHaveCount(1);
    const top = page.locator('.lesson__top');
    for (const name of ['Home', 'Leave lesson'])
      await expect(top.getByRole(name === 'Home' ? 'button' : 'link', { name })).toBeVisible();
    await expect(top.getByRole('progressbar', { name: 'Lesson progress' })).toBeVisible();
    await expect(page.locator('.lesson__pip .framed-avatar')).toBeVisible();
    const question = (await page.getByText('Demo question').boundingBox())!;
    expect(question.y).toBeLessThan(220);
  });
});

// J14c (Codex review of train #355): screens without the lesson header (an empty lesson, the
// finished screen) keep the layout's Pip, so there is always a Home button; and command words, a
// lesson too, shows the avatar beside Pip's line.
test.describe('Pip is always there in a lesson', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('on the finished screen', async ({ page }) => {
    await stubLesson(page);
    await page.route('**/v1/student/learn/lesson**', (route) =>
      route.fulfill({ json: { items: [item], draftContent: false } }),
    );
    await page.goto('/learn/topic/demo-topic');
    await page.getByLabel('Your answer').fill('demo');
    await page.getByRole('button', { name: 'Check' }).click();
    await page.getByRole('button', { name: /Continue|Finish/ }).click();
    await expect(page.locator('.lesson__top')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Home' })).toBeVisible();
  });

  test('on an empty lesson', async ({ page }) => {
    await stubLesson(page);
    await page.route('**/v1/student/learn/lesson**', (route) =>
      route.fulfill({ json: { items: [], draftContent: false } }),
    );
    await page.goto('/learn/topic/demo-topic');
    await expect(page.getByText(/No questions are ready here yet/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Home' })).toBeVisible();
  });

  test('in command words, with the avatar beside his line', async ({ page }) => {
    await stubLesson(page);
    await page.goto('/learn/command-words');
    await expect(page.getByText('Demo question')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Home' })).toHaveCount(1);
    await expect(page.locator('.lesson__pip .framed-avatar')).toBeVisible();
  });
});
