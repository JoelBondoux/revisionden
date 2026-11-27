import { expect, test, type Page } from '@playwright/test';
import { topicMap } from '../../apps/web/src/mocks/data';
import { seedApp } from './support/seed';

/*
 * UX-1 (owner approved the UX report, 2026-11-27): the current subject is a button in the top bar
 * on Home, Learn and Cards ("Maths ▾"). It opens a short sheet: your subjects first (tap to
 * switch), then "Add or change subjects" (the map's subject picker). The choice is remembered on
 * this device, so Home and the map show the same subject. All data here is made up.
 */

const SUBJECTS = [
  { subjectId: 'maths', subject: 'Maths', hasContent: true },
  { subjectId: 'biology', subject: 'Biology', hasContent: true },
];

/** The map for whichever subject is asked for (Maths by default), with both subjects listed. */
async function twoSubjects(page: Page) {
  const asked: (string | null)[] = [];
  await page.route('**/v1/student/map**', (route) => {
    const id = new URL(route.request().url()).searchParams.get('subjectId');
    asked.push(id);
    const s = SUBJECTS.find((x) => x.subjectId === id) ?? SUBJECTS[0]!;
    return route.fulfill({
      json: { ...topicMap, subjectId: s.subjectId, subject: s.subject, subjects: SUBJECTS },
    });
  });
  return asked;
}

const switcher = (page: Page) =>
  page.getByRole('button', { name: /^(Maths|Biology) ?, change subject$/ });

test('Home shows the current subject in the top bar', async ({ page }) => {
  await seedApp(page, 'pupil');
  await twoSubjects(page);
  await page.goto('/home');
  await expect(switcher(page)).toHaveText(/^Maths ▾/);
});

test('switching subject from Home carries over to Learn and is remembered', async ({ page }) => {
  await seedApp(page, 'pupil');
  const asked = await twoSubjects(page);
  await page.goto('/home');
  await switcher(page).click();

  const sheet = page.getByRole('dialog', { name: 'Your subjects' });
  await expect(sheet.getByRole('button', { name: 'Maths' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await sheet.getByRole('button', { name: 'Biology' }).click();
  await expect(sheet).toBeHidden();
  await expect(switcher(page)).toHaveText(/^Biology ▾/);
  expect(asked).toContain('biology');

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Learn' }).click();
  await expect(switcher(page)).toHaveText(/^Biology ▾/);
  await expect(page.locator('.map-play')).toContainText('Biology');

  await page.reload();
  await expect(switcher(page)).toHaveText(/^Biology ▾/);
});

test('the switcher is on Cards too, and its last line opens the subject picker', async ({
  page,
}) => {
  await seedApp(page, 'pupil');
  await twoSubjects(page);
  await page.goto('/cards');
  await switcher(page).click();
  await page
    .getByRole('dialog', { name: 'Your subjects' })
    .getByRole('button', { name: 'Add or change subjects' })
    .click();
  await expect(page).toHaveURL(/\/map$/);
  await expect(page.getByRole('region', { name: 'Pick a subject' })).toBeVisible();
});

test('the subject picker lists recent subjects first, then ones to start, then folds the rest', async ({
  page,
}) => {
  // Lead's ruling (UX-1): practised subjects most recent first, then the others with questions,
  // then the coming-soon ones folded; pupils cannot add subjects, so a parent is the way.
  const many = [
    { subjectId: 'art', subject: 'Art', hasContent: false, lastPractisedAt: null },
    {
      subjectId: 'biology',
      subject: 'Biology',
      hasContent: true,
      lastPractisedAt: '2026-11-20T10:00:00.000Z',
    },
    { subjectId: 'chemistry', subject: 'Chemistry', hasContent: false, lastPractisedAt: null },
    { subjectId: 'french', subject: 'French', hasContent: true, lastPractisedAt: null },
    {
      subjectId: 'maths',
      subject: 'Maths',
      hasContent: true,
      lastPractisedAt: '2026-11-26T10:00:00.000Z',
    },
  ];
  await seedApp(page, 'pupil');
  await page.route('**/v1/student/map**', (route) =>
    route.fulfill({ json: { ...topicMap, subjectId: 'maths', subject: 'Maths', subjects: many } }),
  );
  await page.goto('/map');
  await page.locator('.map-play').click();
  const picker = page.getByRole('region', { name: 'Pick a subject' });
  await expect(picker.locator('.map-subjects-grid').first().getByRole('button')).toHaveText([
    /^Maths/,
    /^Biology/,
    /^French/,
  ]);
  const later = picker.getByText('2 more subjects coming soon');
  await expect(later).toBeVisible();
  await expect(picker.getByRole('button', { name: /^Art/ })).toBeHidden();
  await later.click();
  await expect(picker.getByRole('button', { name: 'Art Coming soon' })).toBeVisible();
  await expect(picker.getByRole('button', { name: 'Chemistry Coming soon' })).toBeVisible();
  await expect(picker).toContainText('Want a different subject?');
  await picker.getByRole('link', { name: 'Ask a parent' }).click();
  await expect(page).toHaveURL(/\/ask-a-parent$/);
});

// Codex on #423: a long subject name in the top bar, at 320px with text at 200%, must not push
// the page sideways; the row wraps instead.
test.describe('at 320px with text at 200%', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  for (const path of ['/home', '/map', '/cards']) {
    test(`a long subject name never scrolls ${path} sideways`, async ({ page }) => {
      await seedApp(page, 'pupil');
      await page.route('**/v1/student/map**', (route) =>
        route.fulfill({
          json: {
            ...topicMap,
            subjectId: 'computer-science',
            subject: 'Computer Science',
            subjects: [
              { subjectId: 'computer-science', subject: 'Computer Science', hasContent: true },
            ],
          },
        }),
      );
      await page.goto(path);
      await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
      const button = page.getByRole('button', { name: /^Computer Science ?, change subject$/ });
      await expect(button).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
          ),
        )
        .toBeLessThanOrEqual(0);
      // Every item in the top row (Pip, the subject, mute, report a problem) stays on screen: a
      // row that overflows to the left (it is right-aligned) never shows as sideways scrolling.
      const offScreen = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.sound-header > *'))
          .map((el) => ({ name: el.className, box: el.getBoundingClientRect() }))
          .filter(({ box }) => box.left < -0.5 || box.right > window.innerWidth + 0.5)
          .map(({ name }) => name),
      );
      expect(offScreen).toEqual([]);
    });
  }
});
