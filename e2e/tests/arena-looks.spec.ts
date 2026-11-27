import { expect, test, type Page } from '@playwright/test';
import { paintedTextFailures, settle } from './support/painted';

/**
 * J17x (owner report: white text on light pages): a lesson's words read on what is painted behind
 * them in every look, whatever the reading and appearance settings. Arena screens take the look's
 * own page (J15s), so each setting below must give the same readable lesson. Made-up items (not
 * educational); the lesson API is stubbed.
 */
const STUDENT_ID = '00000000-0000-4000-8000-0000000000d4';
const ITEM = {
  id: '00000000-0000-4000-8000-000000000a71',
  topicId: 'demo-topic',
  topicTitle: 'Demo topic',
  draft: false,
  type: 'multiple_choice',
  prompt: 'Demo question',
  options: ['Alpha', 'Bravo', 'Charlie', 'Delta'],
};
const STYLES = [
  'doodle-diary',
  'sticker-book',
  'pop-burst',
  'starlight',
  'comic-pop',
  'garden-grow',
  'pixel-arcade',
  'petal-glow',
  'turbo-drive',
  'rainbow-parade',
];

interface Setting {
  name: string;
  scheme: 'light' | 'dark';
  pattern: 'on' | 'off';
  contrast?: 'more';
  tint?: 'cream' | 'blue';
}

const SETTINGS: Setting[] = [
  { name: 'light, pattern on', scheme: 'light', pattern: 'on' },
  { name: 'light, pattern off', scheme: 'light', pattern: 'off' },
  { name: 'light, high contrast', scheme: 'light', pattern: 'on', contrast: 'more' },
  { name: 'light, cream tint', scheme: 'light', pattern: 'on', tint: 'cream' },
  { name: 'dark, pattern on', scheme: 'dark', pattern: 'on' },
  { name: 'dark, pattern off', scheme: 'dark', pattern: 'off' },
];

async function stubLesson(page: Page) {
  await page.addInitScript((id) => localStorage.setItem('revisionden.studentId', id), STUDENT_ID);
  await page.route('**/v1/student/recall*', (route) => route.fulfill({ status: 404, json: {} }));
  await page.route('**/v1/student/learn/lesson**', (route) =>
    route.fulfill({ json: { items: [ITEM], draftContent: false } }),
  );
  await page.route('**/v1/student/rewards/effect-styles', (route) =>
    route.fulfill({ json: { unlocked: STYLES } }),
  );
}

for (const setting of SETTINGS) {
  test(`a lesson reads in every look, ${setting.name}`, async ({ page }, info) => {
    test.skip(info.project.name !== 'phone', 'The look checks run on the phone');
    await page.emulateMedia({ colorScheme: setting.scheme, contrast: setting.contrast ?? null });
    await page.setViewportSize({ width: 390, height: 844 });
    await stubLesson(page);
    await page.addInitScript(
      ({ pattern, tint }) => {
        localStorage.setItem(
          'revisionden.appearance',
          JSON.stringify({ theme: 'system', palette: 'standard', pattern }),
        );
        if (tint) localStorage.setItem('revisionden.reading', JSON.stringify({ tint }));
      },
      { pattern: setting.pattern, tint: setting.tint },
    );
    const failures: string[] = [];
    for (const style of STYLES) {
      await page.addInitScript((s) => localStorage.setItem('revisionden.effectStyle', s), style);
      await page.goto('/learn/topic/demo-topic');
      await expect(page.locator('html')).toHaveAttribute('data-effect-style', style);
      await expect(page.locator('html')).toHaveAttribute('data-pattern', setting.pattern);
      await expect(page.getByText('Demo question')).toBeVisible();
      // Pick an answer, so Check is live (a disabled button is exempt from contrast, WCAG 1.4.3).
      await page.getByText('Alpha').click();
      await expect(page.getByRole('button', { name: 'Check' })).toBeEnabled();
      await page.addStyleTag({
        content: '* { animation: none !important; transition: none !important; }',
      });
      await settle(page);
      for (const f of await paintedTextFailures(page, { only: '.arena' }))
        failures.push(`${style}: ${f}`);
    }
    expect(failures).toEqual([]);
  });
}
