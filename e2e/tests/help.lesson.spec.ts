import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** F10: Need a clue? then Help me understand, in a lesson. Made-up item (not educational). */
const STUDENT_ID = '00000000-0000-4000-8000-0000000000c3';
const ITEM_ID = '00000000-0000-4000-8000-000000000901';
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

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

test('a clue, then help step by step, then a helped answer', async ({ page }) => {
  await page.addInitScript(
    (id) => window.localStorage.setItem('revisionden.studentId', id),
    STUDENT_ID,
  );
  await page.route('**/v1/student/learn/lesson**', (route) =>
    route.fulfill({ json: { items: [item], draftContent: false } }),
  );
  await page.route(`**/v1/student/learn/items/${ITEM_ID}/help`, (route) =>
    route.fulfill({ json: { steps: ['Demo step one', 'Demo step two', 'Answer: demo'] } }),
  );
  let sent: { helped?: boolean } | null = null;
  await page.route('**/v1/student/learn/attempts', async (route) => {
    sent = route.request().postDataJSON() as { helped?: boolean };
    await route.fulfill({
      json: {
        id: '00000000-0000-4000-8000-000000000902',
        itemId: ITEM_ID,
        correct: true,
        score: 1,
        xpEarned: 7,
        helped: true,
        createdAt: '2026-11-26T10:00:00.000Z',
        feedback: { correctAnswer: 'demo' },
        progress: {
          xpToday: 7,
          totalXp: 7,
          dailyGoalXp: 50,
          goalMet: false,
          streak: { current: 0, best: 0, skipDays: 0 },
        },
        flashcardAdded: true,
        combo: 0,
        comboBonusXp: 0,
        newlyEarned: [],
      },
    });
  });

  await page.goto('/learn/topic/demo-topic');
  await expect(page.getByText('Demo question')).toBeVisible();
  await expect(page.getByText('Demo clue')).toBeHidden();
  await page.getByRole('button', { name: 'Need a clue?' }).click();
  await expect(page.getByText('Demo clue')).toBeVisible();
  await expectAccessible(page);

  await page.getByRole('button', { name: 'Help me understand' }).click();
  const panel = page.getByRole('region', { name: 'Help me understand' });
  await expect(panel.getByText('Demo step one')).toBeVisible();
  await panel.getByRole('button', { name: 'Next step' }).click();
  await expect(panel.getByText('Demo step two')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Check' })).toBeVisible();
  await expectAccessible(page);

  await page.getByLabel('Your answer').fill('demo');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.getByRole('status', { name: 'Answer feedback' })).toContainText(
    'Correct, with help',
  );
  expect(sent).toMatchObject({ helped: true });
});
