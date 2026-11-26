import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import topicMap from './fixtures/topic-map-gcse-maths.json' with { type: 'json' };

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

/** Lets a style change's transitions start, then finish (endless motion aside). */
async function settle(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))),
  );
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)), // a cancelled one is settled too
    ),
  );
}

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
        // Text drawn with no box of its own behind it, up to the page.
        const texts = await page.evaluate(() => {
          const clear = (el: Element) => {
            const cs = getComputedStyle(el);
            return (
              (cs.backgroundColor === 'rgba(0, 0, 0, 0)' || cs.backgroundColor === 'transparent') &&
              cs.backgroundImage === 'none'
            );
          };
          const out: {
            x: number;
            y: number;
            w: number;
            h: number;
            color: string;
            large: boolean;
            text: string;
          }[] = [];
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            const el = n.parentElement;
            if (!el || !n.textContent?.trim() || el.closest('.visually-hidden')) continue;
            let onPage = true;
            for (let a: Element | null = el; a && a !== document.body; a = a.parentElement)
              if (!clear(a)) onPage = false;
            if (!onPage) continue;
            const cs = getComputedStyle(el);
            if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
            const range = document.createRange();
            range.selectNodeContents(n);
            for (const r of Array.from(range.getClientRects())) {
              if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > innerHeight) continue;
              if (r.right < 0 || r.left > innerWidth) continue;
              const size = parseFloat(cs.fontSize);
              out.push({
                x: r.left,
                y: r.top,
                w: r.width,
                h: r.height,
                color: cs.color,
                large: size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700),
                text: (n.textContent ?? '').trim().slice(0, 30),
              });
            }
          }
          return out;
        });
        await settle(page);
        const withText = await page.screenshot({ animations: 'disabled' });
        const hide = await page.addStyleTag({
          content:
            '*, *::before, *::after { color: transparent !important; -webkit-text-fill-color: transparent !important; transition: none !important; }',
        });
        await settle(page);
        const without = await page.screenshot({ animations: 'disabled' });
        await hide.evaluate((s) => (s as HTMLElement).remove());
        const bad = await page.evaluate(
          async ({ shots, texts }) => {
            const pixels = async (b64: string) => {
              const img = new Image();
              img.src = `data:image/png;base64,${b64}`;
              await img.decode();
              const cv = document.createElement('canvas');
              cv.width = img.width;
              cv.height = img.height;
              const g = cv.getContext('2d')!;
              g.drawImage(img, 0, 0);
              return {
                w: img.width,
                h: img.height,
                d: g.getImageData(0, 0, img.width, img.height).data,
              };
            };
            const [A, B] = [await pixels(shots[0]!), await pixels(shots[1]!)];
            const scale = A.w / innerWidth;
            const ctx = document.createElement('canvas').getContext('2d')!;
            const rgb = (c: string) => {
              ctx.clearRect(0, 0, 1, 1);
              ctx.fillStyle = c;
              ctx.fillRect(0, 0, 1, 1);
              const d = ctx.getImageData(0, 0, 1, 1).data;
              return [d[0]!, d[1]!, d[2]!, d[3]! / 255];
            };
            const lum = (c: number[]) => {
              const f = (v: number) =>
                (v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
              return 0.2126 * f(c[0]!) + 0.7152 * f(c[1]!) + 0.0722 * f(c[2]!);
            };
            const ratio = (a: number[], b: number[]) => {
              const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m) as [number, number];
              return (x + 0.05) / (y + 0.05);
            };
            const out: string[] = [];
            for (const t of texts) {
              const ink = rgb(t.color);
              const a = ink[3]!;
              const samples: number[] = [];
              const x0 = Math.max(0, Math.floor(t.x * scale));
              const y0 = Math.max(0, Math.floor(t.y * scale));
              const x1 = Math.min(A.w, Math.ceil((t.x + t.w) * scale));
              const y1 = Math.min(A.h, Math.ceil((t.y + t.h) * scale));
              for (let y = y0; y < y1; y++)
                for (let x = x0; x < x1; x++) {
                  const k = (y * A.w + x) * 4;
                  const diff =
                    Math.abs(A.d[k]! - B.d[k]!) +
                    Math.abs(A.d[k + 1]! - B.d[k + 1]!) +
                    Math.abs(A.d[k + 2]! - B.d[k + 2]!);
                  // A letter pixel: drawing the text changed it. Behind it is what was painted.
                  if (diff < 60) continue;
                  const bg = [B.d[k]!, B.d[k + 1]!, B.d[k + 2]!];
                  samples.push(
                    ratio(
                      [0, 1, 2].map((c) => ink[c]! * a + bg[c]! * (1 - a)),
                      bg,
                    ),
                  );
                }
              if (samples.length < 8) continue;
              samples.sort((m, n) => m - n);
              const p10 = samples[Math.floor(samples.length * 0.1)]!;
              if (p10 < (t.large ? 3 : 4.5)) out.push(`"${t.text}" ${p10.toFixed(2)}`);
            }
            return [...new Set(out)];
          },
          { shots: [withText.toString('base64'), without.toString('base64')], texts },
        );
        for (const b of bad) failures.push(`${style} ${scheme} ${path}: ${b}`);
      }
    }
    expect(failures).toEqual([]);
  });
}
