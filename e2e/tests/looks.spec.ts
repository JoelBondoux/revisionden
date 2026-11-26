import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import topicMap from './fixtures/topic-map-gcse-maths.json' with { type: 'json' };
import { paintedTextFailures, settle } from './support/painted';

// J15s (owner, 2026-11-26): each effect style is a full look that restyles the whole app. The map
// and the Me page stay accessible (WCAG 2.2 AA, axe) in every style, in light and dark.

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
] as const;

const STUDENT_ID = '00000000-0000-4000-8000-0000000000a1';

async function asStudent(page: Page) {
  await page.route('**/v1/**', (route) => route.fulfill({ status: 404, json: { error: 'none' } }));
  await page.route('**/v1/student/map**', (route) => route.fulfill({ json: topicMap }));
  await page.route('**/v1/student/cards/due', (route) => route.fulfill({ json: { due: 2 } }));
  await page.addInitScript((id) => localStorage.setItem('revisionden.studentId', id), STUDENT_ID);
}

async function expectAccessible(page: Page) {
  // A style change starts its transitions on the next frames; let them start, then finish.
  await page.evaluate(
    () =>
      new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))),
  );
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished),
    ),
  );
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    results.violations.map(
      (v) =>
        `${v.id}: ${v.nodes.map((n) => `${n.target.join(' ')} ${n.any[0]?.message ?? ''}`).join(' | ')}`,
    ),
  ).toEqual([]);
}

test.beforeEach(async ({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== 'phone', 'The look checks run on the phone');
});

for (const style of STYLES) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`the map and Me are accessible in ${style}, ${scheme} mode`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await asStudent(page);
      for (const path of ['/map', '/settings']) {
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await page.evaluate((s) => (document.documentElement.dataset.effectStyle = s), style);
        await expectAccessible(page);
      }
    });
  }
}

test('changing the style restyles the page itself, not just the accents', async ({ page }) => {
  await asStudent(page);
  await page.goto('/settings');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const look = () =>
    page.evaluate(() => {
      const card = document.querySelector('.card') ?? document.body;
      const s = getComputedStyle(card);
      return {
        page: getComputedStyle(document.body).backgroundColor,
        card: s.backgroundColor,
        corners: s.borderTopLeftRadius,
      };
    });
  const before = await look();
  await page.evaluate(() => (document.documentElement.dataset.effectStyle = 'pixel-arcade'));
  const after = await look();
  expect(after.page).not.toBe(before.page);
  expect(after.card).not.toBe(before.card);
  expect(after.corners).toBe('0px');
});

// Codex review of train #337 (lead, 2026-11-26: blocking): a look must never undo a reading or
// appearance setting. Reading tints and the dyslexia-friendly font win over every look, and the
// page textures (notebook lines, halftone, scanlines, stars) obey "Background pattern: Off" and
// high contrast, like the doodle pattern.
const TINTS = {
  cream: { light: 'rgb(248, 240, 216)', dark: 'rgb(29, 25, 18)' },
  blue: { light: 'rgb(223, 234, 246)', dark: 'rgb(17, 26, 38)' },
} as const;
const hasTexture = (image: string) => /repeating-|\d(\.\d+)?px/.test(image);
/** No page art: every background layer is `none`. */
const NO_ART = /^none(, none)*$/;

for (const scheme of ['light', 'dark'] as const) {
  test(`reading and pattern settings win over every look, ${scheme} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await asStudent(page);
    await page.goto('/settings');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    for (const style of STYLES) {
      const seen = await page.evaluate((s) => {
        const root = document.documentElement;
        root.dataset.effectStyle = s;
        const read = () => ({
          page: getComputedStyle(document.body).backgroundColor,
          image: getComputedStyle(document.body).backgroundImage,
          heading: getComputedStyle(document.querySelector('h1')!).fontFamily,
        });
        const out: Record<string, ReturnType<typeof read>> = {};
        for (const tint of ['cream', 'blue']) {
          root.dataset.readingTint = tint;
          out[tint] = read();
        }
        delete root.dataset.readingTint;
        root.dataset.readingFont = 'dyslexic';
        out.dyslexic = read();
        delete root.dataset.readingFont;
        root.dataset.pattern = 'off';
        out.patternOff = read();
        root.dataset.pattern = 'on';
        return out;
      }, style);
      for (const tint of ['cream', 'blue'] as const) {
        expect(seen[tint]!.page, `${style} ${tint}`).toBe(TINTS[tint][scheme]);
        expect(seen[tint]!.image, `${style} ${tint} page art`).toMatch(NO_ART);
      }
      expect(seen.dyslexic!.heading, `${style} heading font`).toMatch(/^"?OpenDyslexic/);
      expect(hasTexture(seen.patternOff!.image), `${style} textures with the pattern off`).toBe(
        false,
      );
    }
  });
}

test('high contrast drops the page art in every look', async ({ page }) => {
  await page.emulateMedia({ contrast: 'more' });
  await asStudent(page);
  await page.goto('/settings');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  for (const style of STYLES) {
    const image = await page.evaluate((s) => {
      document.documentElement.dataset.effectStyle = s;
      return getComputedStyle(document.body).backgroundImage;
    }, style);
    expect(image, style).toMatch(NO_ART);
  }
});

// Codex review of train #343 (lead: J15s-b, before staging): text painted straight on the page
// (headings, the version footer, page notes, map labels) must read AA on what is really painted
// behind it, the page wash and texture included, not just on --color-background. The letters are
// hidden (a text halo stays, since it is part of what makes the text readable), the page is
// screenshotted, and the pixels behind each piece of text are sampled.
for (const scheme of ['light', 'dark'] as const) {
  test(`text on the page reads AA on the painted page in every look, ${scheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 390, height: 844 });
    await asStudent(page);
    const failures: string[] = [];
    for (const path of ['/settings', '/map']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      for (const style of STYLES) {
        await page.evaluate((s) => (document.documentElement.dataset.effectStyle = s), style);
        await settle(page);
        const bad = await paintedTextFailures(page);
        for (const b of bad) failures.push(`${style} ${scheme} ${path}: ${b}`);
      }
    }
    expect(failures).toEqual([]);
  });
}

// J15s-c (Codex review of train #350): the check must catch faint text, not skip it.
test('the painted-page check fails on faint text (1.1:1)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await asStudent(page);
  await page.goto('/settings');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.evaluate(() => {
    const p = document.createElement('p');
    p.textContent = 'Faint demo text';
    p.style.cssText = 'font-size: 20px; margin: 16px;';
    // About 1.1:1 against the page: the page colour, a touch darker.
    const [r, g, b] = getComputedStyle(document.body)
      .backgroundColor.match(/\d+/g)!
      .map(Number) as [number, number, number];
    p.style.color = `rgb(${r - 12}, ${g - 12}, ${b - 12})`;
    document.querySelector('main')!.prepend(p);
  });
  await settle(page);
  const failures = await paintedTextFailures(page);
  expect(failures.some((f) => f.startsWith('"Faint demo text"'))).toBe(true);
});
