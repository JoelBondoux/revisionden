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

/**
 * J15s-b, J15s-c: every piece of text drawn straight on the page (no box of its own behind it)
 * must read AA on what is really painted behind it. Three more screenshots: the text hidden (the
 * page as painted, halos included), then drawn in black and in white; the pixels either one
 * changes are the letters, measured in the text's real colour against the hidden-text page.
 */
async function paintedTextFailures(page: Page): Promise<string[]> {
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
      // Lines hidden by a line clamp or other clipping are not drawn, so clip each line box to
      // every ancestor that hides its overflow.
      const clips = [] as DOMRect[];
      for (let a: Element | null = el; a && a !== document.body; a = a.parentElement) {
        const ac = getComputedStyle(a);
        if (ac.overflowX !== 'visible' || ac.overflowY !== 'visible')
          clips.push(a.getBoundingClientRect());
      }
      for (const box of Array.from(range.getClientRects())) {
        let [left, top, right, bottom] = [box.left, box.top, box.right, box.bottom];
        for (const c of clips) {
          left = Math.max(left, c.left);
          top = Math.max(top, c.top);
          right = Math.min(right, c.right);
          bottom = Math.min(bottom, c.bottom);
        }
        [left, top] = [Math.max(left, 0), Math.max(top, 0)];
        [right, bottom] = [Math.min(right, innerWidth), Math.min(bottom, innerHeight)];
        const r = { left, top, right, bottom, width: right - left, height: bottom - top };
        if (r.width < 4 || r.height < 4) continue;
        // Text under something else (the bottom nav, a sheet) is not on show.
        const hit = document.elementFromPoint(left + r.width / 2, top + r.height / 2);
        if (!hit || !(el.contains(hit) || hit.contains(el))) continue;
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
  const shotWith = async (css: string) => {
    const tag = await page.addStyleTag({ content: css });
    await settle(page);
    const shot = await page.screenshot({ animations: 'disabled' });
    await tag.evaluate((el) => (el as HTMLElement).remove());
    return shot;
  };
  const fill = (c: string) =>
    `*, *::before, *::after { color: ${c} !important; -webkit-text-fill-color: ${c} !important; transition: none !important; }`;
  const without = await shotWith(fill('transparent'));
  const black = await shotWith(fill('#000'));
  const white = await shotWith(fill('#fff'));
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
      const [B, K, W] = [await pixels(shots[0]!), await pixels(shots[1]!), await pixels(shots[2]!)];
      const A = B;
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
        const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
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
            const off = (S: { d: Uint8ClampedArray }) =>
              Math.abs(S.d[k]! - B.d[k]!) +
              Math.abs(S.d[k + 1]! - B.d[k + 1]!) +
              Math.abs(S.d[k + 2]! - B.d[k + 2]!);
            // A letter pixel: the text drawn in black or in white changes it, whatever its
            // real colour (so faint text is found too). Behind it is what was painted.
            if (off(K) < 60 && off(W) < 60) continue;
            const bg = [B.d[k]!, B.d[k + 1]!, B.d[k + 2]!];
            samples.push(
              ratio(
                [0, 1, 2].map((c) => ink[c]! * a + bg[c]! * (1 - a)),
                bg,
              ),
            );
          }
        // Visible, non-empty text always has letter pixels; finding none is a failure.
        if (samples.length < 8) {
          out.push(`"${t.text}" has too few letter pixels to check`);
          continue;
        }
        samples.sort((m, n) => m - n);
        const p10 = samples[Math.floor(samples.length * 0.1)]!;
        if (p10 < (t.large ? 3 : 4.5)) out.push(`"${t.text}" ${p10.toFixed(2)}`);
      }
      return [...new Set(out)];
    },
    { shots: [without, black, white].map((b) => b.toString('base64')), texts },
  );
  return bad;
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
