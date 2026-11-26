import { expect, test, type Page, type Route } from '@playwright/test';

/*
 * F15 (bug report from dev, 26 Nov, Chrome 412 × 960): on /cards, the "Add a card" boxes were
 * wider than the screen. At 412 px and 320 px, with normal text and with text at 200% (WCAG
 * 1.4.4, 1.4.10), the page never scrolls sideways and every box stays inside its card.
 * The API is stubbed with a made-up pupil and a made-up deck (not educational content).
 */

test.skip(({ isMobile }) => !isMobile, 'a phone check (the phone project)');

const json = (route: Route, body: unknown) => route.fulfill({ json: body });

async function stubCards(page: Page) {
  await page.addInitScript(() =>
    localStorage.setItem('revisionden.studentId', '00000000-0000-4000-8000-0000000000f1'),
  );
  await page.route('**/v1/student/avatar', (route) =>
    json(route, { avatarCode: '1' + '0'.repeat(28), earnedRewardIds: [] }),
  );
  await page.route('**/v1/student/cards/due', (route) => json(route, { due: 0 }));
  await page.route(/\/v1\/student\/flashcards(\?.*)?$/, (route) =>
    json(route, {
      due: [],
      decks: [
        {
          topicId: 'demo-topic-a',
          title: 'A demo topic with a fairly long name for a narrow screen',
          subjectId: 'gcse-maths',
          total: 0,
          due: 0,
        },
      ],
      mine: [],
      draftContent: false,
      dueToday: 0,
      backlog: 0,
      doneToday: false,
    }),
  );
}

for (const width of [412, 320]) {
  for (const big of [false, true]) {
    test(`"Add a card" fits a ${width}px screen${big ? ' with text at 200%' : ''}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await stubCards(page);
      await page.goto('/cards');
      if (big) await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
      await page.getByRole('tab', { name: 'My cards' }).click();
      await expect(page.getByLabel('Front')).toBeVisible();

      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ),
      ).toBeLessThanOrEqual(0);
      const outside = await page.evaluate(() => {
        const form = document.querySelector('.card-form');
        const card = form?.closest('.card') ?? form;
        if (!form || !card) return ['no form'];
        const box = card.getBoundingClientRect();
        return Array.from(form.querySelectorAll<HTMLElement>('input, textarea, select'))
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.left < box.left - 0.5 || r.right > box.right + 0.5;
          })
          .map((el) => el.tagName.toLowerCase());
      });
      expect(outside).toEqual([]);
    });
  }
}
