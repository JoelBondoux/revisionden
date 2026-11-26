import { expect, test, type Page } from '@playwright/test';
import { WCAG_TAGS, axeWhenSettled } from './support/axe';

/**
 * J17: a right answer bursts the style's particles, and a reward arrives in the prize box. The
 * API is stubbed with a made-up question (not educational) and a real catalogue reward id.
 */
const STUDENT_ID = '00000000-0000-4000-8000-0000000000d7';
const ITEM_ID = '00000000-0000-4000-8000-000000000d71';
const item = {
  id: ITEM_ID,
  topicId: 'demo-topic',
  topicTitle: 'Demo topic',
  draft: false,
  type: 'short_answer',
  prompt: 'Demo question',
};

async function lessonWithReward(page: Page) {
  await page.addInitScript(
    (id) => window.localStorage.setItem('revisionden.studentId', id),
    STUDENT_ID,
  );
  await page.route('**/v1/student/learn/lesson**', (route) =>
    route.fulfill({ json: { items: [item], draftContent: false } }),
  );
  await page.route('**/v1/student/learn/attempts', (route) =>
    route.fulfill({
      json: {
        id: '00000000-0000-4000-8000-000000000d72',
        itemId: ITEM_ID,
        correct: true,
        score: 1,
        xpEarned: 10,
        createdAt: '2026-11-26T10:00:00.000Z',
        feedback: { correctAnswer: 'demo' },
        progress: {
          xpToday: 10,
          totalXp: 10,
          dailyGoalXp: 50,
          goalMet: false,
          streak: { current: 7, best: 7, skipDays: 0 },
        },
        flashcardAdded: false,
        combo: 1,
        comboBonusXp: 0,
        newlyEarned: [
          {
            id: 'streak-7',
            name: '7-day streak',
            rarity: 'common',
            items: [],
            earned: true,
            current: 7,
            target: 7,
          },
        ],
      },
    }),
  );
  await page.goto('/learn/topic/demo-topic');
  await page.getByLabel('Your answer').fill('demo');
  await page.getByRole('button', { name: 'Check' }).click();
}

test('a reward arrives in the prize box: tap to open, see why, then Collect', async ({ page }) => {
  await lessonWithReward(page);
  const box = page.getByRole('dialog');
  await expect(box.getByRole('heading', { name: 'A prize box!' })).toBeVisible();
  await expect(page.locator('.fx-layer .fx-particle').first()).toBeAttached();
  await box.getByRole('button', { name: 'Open the prize box' }).click();
  await expect(box.getByRole('heading', { name: 'You earned a reward!' })).toBeVisible();
  await expect(box.getByRole('listitem')).toContainText('7-day streak');
  await expect(box.getByRole('listitem')).toContainText('For: ');
  const collect = box.getByRole('button', { name: 'Collect' });
  await expect(collect).toBeFocused();
  const results = await axeWhenSettled(page, (axe) => axe.include('dialog').withTags(WCAG_TAGS));
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  await collect.click();
  await expect(box).toBeHidden();
  await expect(page.getByRole('status', { name: 'New rewards' })).toContainText('7-day streak');
});

test('Escape closes the prize box', async ({ page }) => {
  await lessonWithReward(page);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the box opens at once with the list, and nothing flies', async ({ page }) => {
    await lessonWithReward(page);
    const box = page.getByRole('dialog');
    await expect(box.getByRole('heading', { name: 'You earned a reward!' })).toBeVisible();
    await expect(box.getByRole('button', { name: 'Collect' })).toBeFocused();
    await expect(page.locator('.fx-particle')).toHaveCount(0);
  });
});

test.describe('on a 320px screen with text at 200%', () => {
  test.use({ viewport: { width: 320, height: 640 }, reducedMotion: 'reduce' });

  test('the prize box has no sideways scroll', async ({ page }) => {
    await lessonWithReward(page);
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    // The box itself: nothing in it reaches past the screen's edge (polled while the layout settles).
    await expect
      .poll(() =>
        page.evaluate(() => {
          const dialog = document.querySelector('dialog')!;
          const parts = [dialog, ...Array.from(dialog.querySelectorAll('*'))];
          const right = Math.max(...parts.map((el) => el.getBoundingClientRect().right));
          return right - document.documentElement.clientWidth;
        }),
      )
      .toBeLessThanOrEqual(0);
  });
});
