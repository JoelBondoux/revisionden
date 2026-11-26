import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** Made-up cards (not educational) for one made-up student, served in place of the API. */
const STUDENT_ID = '00000000-0000-4000-8000-0000000000c1';
const card = (n: number) => ({
  id: `00000000-0000-4000-8000-00000000010${n}`,
  topicId: 'demo-topic-a',
  topicTitle: 'Demo topic A',
  subjectId: 'gcse-maths',
  origin: 'deck',
  front: `Demo front ${n}`,
  back: `Demo back ${n}`,
  draft: false,
  dueAt: '2026-11-24T10:00:00.000Z',
  nextReviewMs: { again: 600_000, hard: 86_400_000, good: 518_400_000, easy: 864_000_000 },
});

async function openCards(page: Page) {
  await page.addInitScript(
    (id) => window.localStorage.setItem('revisionden.studentId', id),
    STUDENT_ID,
  );
  await page.route('**/v1/student/flashcards', (route) =>
    route.fulfill({
      json: {
        due: [card(1), card(2)],
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
      },
    }),
  );
  await page.route('**/v1/student/flashcards/sessions', (route) =>
    route.fulfill({
      status: 201,
      json: {
        id: '00000000-0000-4000-8000-000000000777',
        maxCards: 20,
        minCards: 5,
        xp: 20,
        rewardedLeftToday: 2,
      },
    }),
  );
  await page.goto('/cards');
  await expect(page.getByText('Demo front 1')).toBeVisible();
}

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    results.violations.map(
      (v) => `${v.id}: ${v.help} [${v.nodes.map((n) => n.target.join(' ')).join(', ')}]`,
    ),
  ).toEqual([]);
}

test('the flashcard review on /cards is accessible on both sides of the card', async ({ page }) => {
  await openCards(page);
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Show answer' }).click();
  await expect(page.getByText('Demo back 1')).toBeVisible();
  await expectAccessible(page);
});

test('the flashcard is named by the words it shows (WCAG 2.5.3 Label in Name)', async ({
  page,
}) => {
  await openCards(page);
  await expect(page.getByRole('button', { name: /^Question/ })).toBeVisible();
});
