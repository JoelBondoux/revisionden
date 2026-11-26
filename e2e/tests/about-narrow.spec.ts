import { expect, test, type Page } from '@playwright/test';

// W13 (lead ruling, 2026-11-26): G saw /about scroll sideways on a 320px phone with large text,
// before L10 (643ece25) fixed its reflow. This locks that fix in: at 320px, with normal text and
// with text at 200% (WCAG 1.4.4, 1.4.10), nothing on the page scrolls sideways or pokes past the
// screen edge, for a visitor and for a signed-in student (who also has the bottom nav).

test.skip(({ isMobile }) => !isMobile, 'a phone check (the phone project)');
test.use({ viewport: { width: 320, height: 640 } });

/** A student uses this device; their avatar is a made-up code (the default look). */
async function asStudent(page: Page) {
  await page.addInitScript(() => localStorage.setItem('revisionden.studentId', 'student-e2e'));
  await page.route('**/v1/student/avatar', (route) =>
    route.fulfill({ json: { avatarCode: '1' + '0'.repeat(28), earnedRewardIds: [] } }),
  );
}

/** Visible elements whose box reaches past either side of the screen, by tag and class. */
function pastTheEdge(page: Page) {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    return Array.from(document.body.querySelectorAll<HTMLElement>('*'))
      .filter((el) => {
        if (el.closest('[aria-hidden="true"], .visually-hidden, .sr-only')) return false;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return false;
        return r.left < -0.5 || r.right > width + 0.5;
      })
      .map((el) => `${el.tagName.toLowerCase()}.${Array.from(el.classList).join('.')}`);
  });
}

for (const who of ['a visitor', 'a student'] as const) {
  for (const big of [false, true]) {
    test(`/about fits a 320px screen for ${who}${big ? ' with text at 200%' : ''}`, async ({
      page,
    }) => {
      if (who === 'a student') await asStudent(page);
      await page.goto('/about');
      if (big) await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
      await expect(
        page.getByRole('heading', { level: 1, name: 'About RevisionDen' }),
      ).toBeVisible();
      await expect(page.getByRole('heading', { name: "What's new" })).toBeVisible();

      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ),
      ).toBeLessThanOrEqual(0);
      expect(await pastTheEdge(page)).toEqual([]);
    });
  }
}
