import { expect, test, type Page } from '@playwright/test';

/**
 * J17y (student bug report: "On galaxy fold 7 in open mode the touch areas don't match the
 * buttons", 750 × 832): each answer is chosen by a held tap at its centre and its lower edge, and
 * the floating bug button never covers an answer, Check or Continue once the page is scrolled to
 * the bottom. Made-up items (not educational); the API is stubbed.
 */
const STUDENT_ID = '00000000-0000-4000-8000-0000000000d4';
const ITEM = {
  id: '00000000-0000-4000-8000-000000000d71',
  topicId: 'demo-topic',
  topicTitle: 'Demo topic',
  draft: false,
  type: 'multiple_choice',
  prompt: 'Demo question',
  options: ['Alpha', 'Bravo', 'Charlie', 'Delta'],
};
const OPTIONS = ITEM.options;
const SCREENS = [
  { name: 'Galaxy Fold 7 open', width: 750, height: 832 },
  { name: 'a tall phone', width: 412, height: 915 },
];

async function stubDaily(page: Page) {
  await page.addInitScript((id) => localStorage.setItem('revisionden.studentId', id), STUDENT_ID);
  await page.route('**/v1/student/recall*', (route) => route.fulfill({ status: 404, json: {} }));
  await page.route('**/v1/student/daily', (route) =>
    route.fulfill({
      json: {
        day: '2026-11-26',
        items: [ITEM],
        draftContent: false,
        answeredItemIds: [],
        answered: 0,
        total: 1,
        done: false,
      },
    }),
  );
  await page.route('**/v1/student/learn/attempts', (route) =>
    route.fulfill({
      json: {
        id: '00000000-0000-4000-8000-000000000d79',
        itemId: ITEM.id,
        correct: true,
        score: 1,
        xpEarned: 10,
        createdAt: '2026-11-26T10:00:00.000Z',
        feedback: { correctAnswer: 'Alpha' },
        progress: {
          xpToday: 10,
          totalXp: 10,
          dailyGoalXp: 50,
          goalMet: false,
          streak: { current: 0, best: 0, skipDays: 0 },
        },
        flashcardAdded: false,
        combo: 1,
        comboBonusXp: 0,
        newlyEarned: [],
      },
    }),
  );
}

/** A finger held for 150 ms (Playwright's own tap is instant, so :active never shows). */
async function heldTap(page: Page, x: number, y: number) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await page.waitForTimeout(150);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

/** Boxes of the answers and main buttons the bug button overlaps, once scrolled to the bottom. */
async function coveredByBugButton(page: Page): Promise<string[]> {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(100);
  return page.evaluate(() => {
    const bug = document.querySelector('.bug-button');
    if (!bug || getComputedStyle(bug).position !== 'fixed') return [];
    const b = bug.getBoundingClientRect();
    return Array.from(document.querySelectorAll('.answer-option, .btn--primary, .btn--block'))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top;
      })
      .map((el) => (el.textContent ?? '').trim());
  });
}

for (const screen of SCREENS) {
  test.describe(`on ${screen.name} (${screen.width} × ${screen.height})`, () => {
    test.use({ viewport: { width: screen.width, height: screen.height } });

    test('a held tap at the centre or lower edge of each answer chooses it', async ({
      page,
    }, info) => {
      test.skip(!info.project.use.hasTouch, 'Touch screens only');
      await stubDaily(page);
      await page.goto('/learn/daily');
      await expect(page.getByText('Demo question')).toBeVisible();
      for (const [i, name] of OPTIONS.entries()) {
        for (const fy of [0.5, 0.9]) {
          // Choose a different answer first, so each tap has to change the choice.
          const other = OPTIONS[(i + 1) % OPTIONS.length]!;
          const ob = (await page.locator('.answer-option', { hasText: other }).boundingBox())!;
          await heldTap(page, ob.x + ob.width / 2, ob.y + ob.height / 2);
          await expect(page.locator('.answer-option:has(input:checked)')).toHaveText(other);
          const box = (await page.locator('.answer-option', { hasText: name }).boundingBox())!;
          await heldTap(page, box.x + box.width / 2, box.y + box.height * fy);
          await expect(
            page.locator('.answer-option:has(input:checked)'),
            `${name} at ${fy}`,
          ).toHaveText(name);
        }
      }
    });

    test('the bug button covers no answer, Check or Continue at the bottom of the page', async ({
      page,
    }) => {
      await stubDaily(page);
      await page.goto('/learn/daily');
      await expect(page.getByText('Demo question')).toBeVisible();
      expect(await coveredByBugButton(page), 'before answering').toEqual([]);
      await page.getByText('Alpha').click();
      await page.getByRole('button', { name: 'Check' }).click();
      await expect(page.getByRole('button', { name: /Continue|Finish/ })).toBeVisible();
      expect(await coveredByBugButton(page), 'after Check').toEqual([]);
    });
  });
}
