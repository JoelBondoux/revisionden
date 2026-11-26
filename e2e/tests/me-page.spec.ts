import { expect, test, type Page } from '@playwright/test';
import { axeWhenSettled } from './support/axe';

/**
 * The Me page (W9): avatar and nickname at the top, Edit my avatar, Get help first, and the
 * rest on two sub-pages. The student API is stubbed with a made-up nickname and look.
 */

const START = '1' + '0'.repeat(28);
const STUDENT = {
  id: '00000000-0000-4000-8000-0000000000e9',
  nickname: 'TestFox',
  avatarCode: START,
  yearGroup: 11,
};

async function asStudent(page: Page) {
  const saved: string[] = [];
  let current = START;
  await page.addInitScript(() => localStorage.setItem('revisionden.studentId', 'student-e2e'));
  await page.route('**/v1/student/me', (route) =>
    route.fulfill({ json: { ...STUDENT, avatarCode: current } }),
  );
  await page.route('**/v1/student/avatar', async (route) => {
    if (route.request().method() === 'PUT') {
      const { avatarCode } = route.request().postDataJSON() as { avatarCode: string };
      saved.push(avatarCode);
      current = avatarCode;
      return route.fulfill({ json: { ...STUDENT, avatarCode } });
    }
    return route.fulfill({ json: { avatarCode: current, earnedRewardIds: [] } });
  });
  return { saved };
}

const navAvatar = (page: Page) =>
  page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Me, settings and personalisation' })
    .locator('svg.avatar-svg');

test('edit and save my avatar: the nav avatar changes at once', async ({ page }) => {
  const { saved } = await asStudent(page);
  await page.goto('/settings');
  await expect(page.getByRole('heading', { level: 1, name: 'Me' })).toBeVisible();
  await expect(page.getByText('TestFox')).toBeVisible();
  const before = await navAvatar(page).innerHTML();

  await page.getByRole('button', { name: 'Edit my avatar' }).click();
  const sheet = page.getByRole('dialog', { name: 'Edit my avatar' });
  await sheet.locator('.avatar-option[aria-pressed="false"]:not([aria-disabled])').first().click();
  await sheet.getByRole('button', { name: 'Save' }).click();

  await expect(sheet).toBeHidden();
  await expect(page.getByText('Avatar saved.')).toBeVisible();
  expect(saved).toHaveLength(1);
  expect(saved[0]).not.toBe(START);
  await expect.poll(() => navAvatar(page).innerHTML()).not.toBe(before);
});

test('Cancel asks before throwing away changes', async ({ page }) => {
  const { saved } = await asStudent(page);
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Edit my avatar' }).click();
  const sheet = page.getByRole('dialog', { name: 'Edit my avatar' });
  await sheet.locator('.avatar-option[aria-pressed="false"]:not([aria-disabled])').first().click();
  await sheet.getByRole('button', { name: 'Cancel' }).click();
  const ask = page.getByRole('alertdialog', { name: 'Throw away your changes?' });
  await expect(ask.getByRole('button', { name: 'Keep editing' })).toBeFocused();
  await ask.getByRole('button', { name: 'Throw away' }).click();
  await expect(sheet).toBeHidden();
  expect(saved).toEqual([]);
});

test('edit my avatar by keyboard alone, with names a screen reader can read', async ({ page }) => {
  const { saved } = await asStudent(page);
  await page.goto('/settings');
  const edit = page.getByRole('button', { name: 'Edit my avatar' });
  await expect(edit).toBeVisible();
  for (let i = 0; i < 40 && !(await edit.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press('Tab');
  }
  await page.keyboard.press('Enter');
  const sheet = page.getByRole('dialog', { name: 'Edit my avatar' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('tablist', { name: 'Avatar parts' })).toBeVisible();
  // Tab to an item that is not worn yet, pick it, then on to Save.
  const target = sheet.locator('.avatar-option[aria-pressed="false"]:not([aria-disabled])').first();
  for (let i = 0; i < 60 && !(await target.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press('Tab');
  }
  await page.keyboard.press('Enter');
  const save = sheet.getByRole('button', { name: 'Save' });
  for (let i = 0; i < 200 && !(await save.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press('Tab');
  }
  await page.keyboard.press('Enter');
  await expect(sheet).toBeHidden();
  expect(saved).toHaveLength(1);
});

test('the Me page and its sheet are accessible', async ({ page }) => {
  await asStudent(page);
  for (const path of ['/settings', '/settings/look-and-sound', '/settings/more']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const results = await axeWhenSettled(page);
    expect(results.violations.map((v) => `${path} ${v.id}: ${v.help}`)).toEqual([]);
  }
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Edit my avatar' }).click();
  await expect(page.getByRole('dialog', { name: 'Edit my avatar' })).toBeVisible();
  const results = await axeWhenSettled(page);
  expect(results.violations.map((v) => `sheet ${v.id}: ${v.help}`)).toEqual([]);
});

test('Get help is still the first link on Me', async ({ page }) => {
  await asStudent(page);
  await page.goto('/settings');
  await expect(page.getByText('TestFox')).toBeVisible();
  const links = page.locator('main > :not(header) a');
  await expect(links.first()).toHaveAttribute('href', '/help');
  await expect(links.nth(1)).toHaveAttribute('href', '/progress');
  await expect(links.nth(2)).toHaveAttribute('href', '/rewards');
});

test.describe('single screen (390 × 844, default text)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the avatar, Edit, Get help, progress, rewards, Look and sound and More all show without scrolling', async ({
    page,
  }) => {
    await asStudent(page);
    await page.goto('/settings');
    await expect(page.getByText('TestFox')).toBeVisible();
    for (const name of ['Edit my avatar']) {
      await expect(page.getByRole('button', { name })).toBeInViewport({ ratio: 1 });
    }
    for (const name of ['Get help', 'My progress', 'My rewards', 'Look and sound', 'More']) {
      await expect(page.getByRole('link', { name, exact: true })).toBeInViewport({ ratio: 1 });
    }
  });
});

test.describe('on a 320px screen with text at 200%', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  for (const path of ['/settings', '/settings/look-and-sound', '/settings/more']) {
    test(`${path} has no sideways scroll`, async ({ page }) => {
      await asStudent(page);
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test('the Edit my avatar sheet fits with no sideways scroll', async ({ page }) => {
    await asStudent(page);
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Edit my avatar' }).click();
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    const sheet = page.getByRole('dialog', { name: 'Edit my avatar' });
    await expect(sheet.getByRole('button', { name: 'Save' })).toBeAttached();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test('a parent on /settings still gets Parent home, with no avatar header', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByRole('heading', { level: 1, name: 'Me' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit my avatar' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Parent home', exact: true })).toBeVisible();
});
