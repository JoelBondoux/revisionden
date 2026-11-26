import { expect, test, type Page } from '@playwright/test';
import { axeWhenSettled } from './support/axe';
import topicMap from './fixtures/topic-map-gcse-maths.json' with { type: 'json' };

/*
 * The winding topic map (J15c, owner sign-off of the all-themes mockup, revision 5). The data is
 * made up: the real GCSE Maths Higher topic tree (6 units, 97 topics) with a made-up student
 * part-way through Number and Algebra. The path does not breathe under automation.
 */

const STUDENT_ID = '00000000-0000-4000-8000-0000000000a1';
const STYLES = [
  'doodle-diary',
  'sticker-book',
  'pop-burst',
  'starlight',
  'garden-grow',
  'comic-pop',
  'pixel-arcade',
  'petal-glow',
  'turbo-drive',
  'rainbow-parade',
];

/** A Foundation student's map: two Higher-only topics on a side branch and an either-order pair. */
function foundationMap() {
  const map = structuredClone(topicMap) as typeof topicMap & {
    units: { topics: Record<string, unknown>[] }[];
  };
  map.qualification = 'GCSE Foundation';
  const number = map.units[0]!.topics;
  number[3]!.tier = 'higher';
  number[4]!.tier = 'higher';
  number[7]!.orderGroup = 'g1';
  number[8]!.orderGroup = 'g1';
  return map;
}

async function openMap(
  page: Page,
  { textScale = 1, map = topicMap as object, style = 'doodle-diary' } = {},
) {
  await page.route('**/v1/**', (route) => route.fulfill({ status: 404, json: { error: 'none' } }));
  await page.route('**/v1/student/map**', (route) => route.fulfill({ json: map }));
  await page.route('**/v1/student/cards/due', (route) => route.fulfill({ json: { due: 0 } }));
  // Every style unlocked, so choosing one (below) shows its own node art as a child would see it.
  await page.route('**/v1/student/rewards/effect-styles', (route) =>
    route.fulfill({ json: { unlocked: STYLES } }),
  );
  await page.addInitScript(
    ([id, scale, effect]) => {
      localStorage.setItem('revisionden.studentId', id as string);
      // Only the first time: a style chosen later (chooseStyle) survives the reload.
      if (!localStorage.getItem('revisionden.effectStyle'))
        localStorage.setItem('revisionden.effectStyle', effect as string);
      if (scale !== 1) {
        document.addEventListener('DOMContentLoaded', () => {
          const css = document.createElement('style');
          css.textContent = `html { font-size: ${(scale as number) * 100}% !important; }`;
          document.head.appendChild(css);
        });
      }
    },
    [STUDENT_ID, textScale, style],
  );
  await page.goto('/map');
  await expect(page.getByRole('group', { name: 'Units' })).toBeVisible();
  await page.evaluate((s) => (document.documentElement.dataset.effectStyle = s), style);
}

/**
 * Chooses a style as a child does (saved, then the app restarts), so the map draws that style's
 * own node art, not just its colours (J16: Petal Glow's tiles are flowers).
 */
async function chooseStyle(page: Page, style: string) {
  await page.evaluate((s) => localStorage.setItem('revisionden.effectStyle', s), style);
  await page.reload();
  await expect(page.getByRole('group', { name: 'Units' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-effect-style', style);
}

const sidewaysScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.beforeEach(async ({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== 'phone', 'The map layout checks are phone checks');
});

test('at 390 × 844 it opens on the current unit with You are here in view', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openMap(page);
  await expect(page.getByRole('heading', { level: 2, name: 'Algebra' })).toBeVisible();
  await expect(page.getByText('You are here')).toBeInViewport();
  await expect(page.getByRole('link', { name: /you are here$/ })).toBeInViewport();
  expect(await sidewaysScroll(page)).toBe(0);
});

for (const [label, width, scale] of [
  ['320px', 320, 1],
  ['320px with 200% text', 320, 2],
] as const) {
  test(`at ${label} the page never scrolls sideways`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 });
    await openMap(page, { textScale: scale });
    expect(await sidewaysScroll(page)).toBe(0);
  });
}

test('swipe sideways, or use the arrows, for the next unit', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openMap(page);
  await page.getByRole('button', { name: 'Next unit' }).click();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Ratio, proportion and rates of change' }),
  ).toBeVisible();
  const pager = page.getByRole('group', { name: 'Units' });
  await pager.evaluate((el) => el.scrollTo({ left: el.clientWidth * 3 }));
  await expect(
    page.getByRole('heading', { level: 2, name: 'Geometry and measures' }),
  ).toBeVisible();
  await pager.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(
    page.getByRole('heading', { level: 2, name: 'Ratio, proportion and rates of change' }),
  ).toBeVisible();
});

// Codex review of #307: every unit opens near the topics you can do next, not at the top of its
// path, the first time you visit it, and keeps where you left it after that.
test('another unit opens near its next topic, then remembers where you were', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openMap(page);
  // The map opens on Algebra; Number's weak topics sit low on its path.
  await page.getByRole('button', { name: 'Previous unit' }).click();
  const number = page.locator('.wiggly-map__page').nth(0);
  await expect(number.locator('.path-node--weak').first()).toBeInViewport();
  await number.evaluate((el) => (el.scrollTop = 40));
  await page.getByRole('button', { name: 'Next unit' }).click();
  await page.getByRole('button', { name: 'Previous unit' }).click();
  expect(await number.evaluate((el) => el.scrollTop)).toBe(40);
});

test('the big subject box opens Subject selection', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openMap(page);
  await page.getByRole('button', { name: /^Your subject Maths Change$/ }).click();
  await expect(page.getByRole('region', { name: 'Pick a subject' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to the map' }).click();
  await expect(page.getByRole('group', { name: 'Units' })).toBeVisible();
});

for (const scheme of ['light', 'dark'] as const) {
  test(`the map is accessible in ${scheme} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width: 390, height: 844 });
    await openMap(page);
    await page.evaluate(() =>
      Promise.all(
        document
          .getAnimations()
          .filter((a) => a.effect?.getTiming().iterations !== Infinity)
          .map((a) => a.finished),
      ),
    );
    const results = await axeWhenSettled(page);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
}

/*
 * Ported from the mockup's checks (docs/mockups/checks): every route stays readable, and every
 * node stands out from the road and the page.
 */
for (const width of [320, 390]) {
  test(`at ${width}px every unit's route is readable: no overlaps, nothing off screen, no crossings`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await openMap(page, { map: foundationMap() });
    const issues = await page.evaluate(() => {
      const out: string[] = [];
      document.querySelectorAll<HTMLElement>('.wiggly-map__page').forEach((pg, u) => {
        const pr = pg.getBoundingClientRect();
        const box = (e: Element) => {
          const r = e.getBoundingClientRect();
          return { l: r.left - pr.left, r: r.right - pr.left, t: r.top, b: r.bottom };
        };
        const items = [
          ...Array.from(pg.querySelectorAll('.path-node')),
          ...Array.from(pg.querySelectorAll('.path-node__label')),
          ...Array.from(pg.querySelectorAll('.path-here')),
        ].map(box);
        const hit = (a: ReturnType<typeof box>, c: ReturnType<typeof box>) =>
          a.l < c.r - 1 && c.l < a.r - 1 && a.t < c.b - 1 && c.t < a.b - 1;
        const nodes = pg.querySelectorAll('.path-node').length;
        for (let i = 0; i < items.length; i++)
          for (let j = i + 1; j < items.length; j++) {
            const ownLabel = i < nodes && j === i + nodes; // a node and its own label meet by design
            if (!ownLabel && hit(items[i]!, items[j]!))
              out.push(`unit ${u + 1}: items ${i} and ${j} overlap`);
          }
        pg.querySelectorAll('.path-node__label').forEach((l, i) => {
          const b = box(l);
          if (b.l < -2 || b.r > pr.width + 2) out.push(`unit ${u + 1}: label ${i} off screen`);
        });
        const w = (pg.querySelector('.path-trail') as HTMLElement).clientWidth / 100;
        const curves = Array.from(
          pg.querySelectorAll('.path-road .r, .path-road .rb, .path-road .rx'),
        ).flatMap((el) =>
          (el.getAttribute('d') || '')
            .split('M')
            .filter(Boolean)
            .map((d: string) => {
              const [ax, ay, c1x, c1y, c2x, c2y, bx, by] = d
                .trim()
                .split(/[\sC]+/)
                .map(Number) as number[];
              return Array.from({ length: 25 }, (_, k) => {
                const t = k / 24,
                  m = 1 - t;
                return [
                  (m ** 3 * ax! + 3 * m * m * t * c1x! + 3 * m * t * t * c2x! + t ** 3 * bx!) * w,
                  m ** 3 * ay! + 3 * m * m * t * c1y! + 3 * m * t * t * c2y! + t ** 3 * by!,
                ] as const;
              });
            }),
        );
        const side = (a: readonly number[], b: readonly number[], c: readonly number[]) =>
          (c[0]! - a[0]!) * (b[1]! - a[1]!) - (c[1]! - a[1]!) * (b[0]! - a[0]!);
        const cross = (
          p: readonly number[],
          q: readonly number[],
          r: readonly number[],
          s: readonly number[],
        ) => side(r, s, p) * side(r, s, q) < 0 && side(p, q, r) * side(p, q, s) < 0;
        for (let i = 0; i < curves.length; i++)
          for (let j = i + 1; j < curves.length; j++) {
            const A = curves[i]!,
              B = curves[j]!;
            const near = (P: readonly number[], Q: readonly number[]) =>
              Math.hypot(P[0]! - Q[0]!, P[1]! - Q[1]!) < 30;
            if ([A[0]!, A[24]!].some((P) => near(P, B[0]!) || near(P, B[24]!))) continue;
            let x = false;
            for (let s = 0; s < 24 && !x; s++)
              for (let t = 0; t < 24 && !x; t++) x = cross(A[s]!, A[s + 1]!, B[t]!, B[t + 1]!);
            if (x) out.push(`unit ${u + 1}: road segments ${i} and ${j} cross`);
          }
      });
      return out;
    });
    expect(issues).toEqual([]);
  });
}

for (const scheme of ['light', 'dark'] as const) {
  test(`in ${scheme} mode every node stands out 3:1 from the road and the page, in every style`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width: 390, height: 844 });
    await openMap(page);
    const failures: string[] = [];
    for (const style of STYLES) {
      await chooseStyle(page, style);
      // The page's real pixels (textures included) with the trail hidden.
      const pageEl = page.locator('.wiggly-map__page').nth(1);
      await page.addStyleTag({
        content: '.wiggly-map__page .path-trail > * { visibility: hidden !important; }',
      });
      const shot = await pageEl.screenshot();
      await page.evaluate(() =>
        document
          .querySelectorAll('style')
          .forEach(
            (s) => s.textContent?.includes('.path-trail > * { visibility: hidden') && s.remove(),
          ),
      );
      const result = await page.evaluate(
        async ({ b64 }) => {
          const ctx = document.createElement('canvas').getContext('2d')!;
          const parse = (c: string): number[] | null => {
            if (!c || c === 'none' || c === 'transparent') return null;
            ctx.clearRect(0, 0, 1, 1);
            ctx.fillStyle = '#000';
            ctx.fillStyle = c;
            ctx.fillRect(0, 0, 1, 1);
            const d = ctx.getImageData(0, 0, 1, 1).data;
            return d[3] ? [d[0]!, d[1]!, d[2]!, d[3]! / 255] : null;
          };
          const lum = ([r, g, b]: number[]) => {
            const f = (c: number) =>
              (c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
            return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
          };
          const ratio = (a: number[], b: number[]) => {
            const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m) as [number, number];
            return (x + 0.05) / (y + 0.05);
          };
          const over = (c: number[], bg: number[]) =>
            c.length > 3 ? c.slice(0, 3).map((v, i) => v * c[3]! + bg[i]! * (1 - c[3]!)) : c;
          const img = new Image();
          img.src = `data:image/png;base64,${b64}`;
          await img.decode();
          const cv = document.createElement('canvas');
          cv.width = img.width;
          cv.height = img.height;
          const g = cv.getContext('2d')!;
          g.drawImage(img, 0, 0);
          const px = g.getImageData(0, 0, cv.width, cv.height).data;
          const bgs: number[][] = [];
          for (let y = 4; y < cv.height; y += 23)
            for (let x = 4; x < cv.width; x += 19) {
              const i = (y * cv.width + x) * 4;
              bgs.push([px[i]!, px[i + 1]!, px[i + 2]!]);
            }
          const layers = (n: Element) => {
            const cs = getComputedStyle(n);
            const out: number[][][] = [];
            const oc = parse(cs.outlineColor);
            if (parseFloat(cs.outlineWidth) > 0 && cs.outlineStyle !== 'none' && oc && oc[3]! > 0.5)
              out.push([oc]);
            for (const m of cs.boxShadow.matchAll(/(rgba?\([^)]*\)) 0px 0px 0px ([\d.]+)px/g)) {
              const rc = parse(m[1]!);
              if (parseFloat(m[2]!) >= 2 && rc && rc[3]! > 0.5) {
                out.push([rc]);
                break;
              }
            }
            const art = n.querySelector('svg .edge');
            if (art) {
              const ac = parse(getComputedStyle(art).stroke);
              if (ac && ac[3]! > 0.5) out.push([ac]);
            }
            const bc = parse(cs.borderTopColor);
            if (parseFloat(cs.borderTopWidth) >= 2 && bc && bc[3]! > 0.5) out.push([bc]);
            const grads = (
              cs.backgroundImage.match(/(rgba?|color)\([^)]*\)|#[0-9a-f]{3,8}\b/gi) || []
            )
              .map(parse)
              .filter(Boolean) as number[][];
            if (grads.length) out.push(grads);
            else {
              const f = parse(cs.backgroundColor);
              if (f && f[3]! > 0.2) out.push([f]);
            }
            return out;
          };
          const pg = document.querySelectorAll('.wiggly-map__page')[1]!;
          const stroke = (sel: string) =>
            [parse(getComputedStyle(pg.querySelector(sel)!).stroke)].filter(Boolean) as number[][];
          const road = stroke('.path-road .r');
          const done = stroke('.path-road .d');
          const p10 = (v: number[]) => v.sort((a, b) => a - b)[Math.floor(v.length * 0.1)]!;
          const layerVs = (L: number[][], b: number[], X: number[]) =>
            Math.min(...L.map((c) => ratio(over(c, b), X)));
          const visible = (ls: number[][][], roads: number[][]) => ({
            road: Math.min(
              ...bgs
                .slice(0, 40)
                .flatMap((b) =>
                  roads.map((r) => Math.max(0, ...ls.map((L) => layerVs(L, b, over(r, b))))),
                ),
            ),
            bg: p10(bgs.map((b) => Math.max(0, ...ls.map((L) => layerVs(L, b, b))))),
          });
          const out: string[] = [];
          const pick = (...cs: (number[] | undefined)[]) =>
            cs.filter((c): c is number[] => Boolean(c));
          const states: [string, string, number[][]][] = [
            ['done', '.path-node--done', pick(done[0])],
            ['current', '.path-node--current', pick(done[0], road[0])],
            ['open', '.path-node--open', pick(road[0])],
          ];
          for (const [state, sel, roads] of states) {
            const n = pg.querySelector(sel);
            if (!n || !roads.length) continue;
            const v = visible(layers(n), roads);
            if (v.road < 3 || v.bg < 3)
              out.push(`${state}: vs road ${v.road.toFixed(2)}, vs page ${v.bg.toFixed(2)}`);
          }
          return out;
        },
        { b64: shot.toString('base64') },
      );
      for (const r of result) failures.push(`${style} ${scheme} ${r}`);
    }
    expect(failures).toEqual([]);
  });
}

// Codex review of #307: the text on a node (an open or weak topic's %, the Higher H) reads 4.5:1
// on the node's own fill, in every style, light and dark.
for (const scheme of ['light', 'dark'] as const) {
  test(`in ${scheme} mode the % and H on every node read 4.5:1, in every style`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width: 390, height: 844 });
    await openMap(page);
    const failures: string[] = [];
    for (const style of STYLES) {
      await chooseStyle(page, style);
      const found = await page.evaluate(() => {
        const ctx = document.createElement('canvas').getContext('2d')!;
        const parse = (c: string): number[] | null => {
          if (!c || c === 'none' || c === 'transparent') return null;
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillStyle = '#000';
          ctx.fillStyle = c;
          ctx.fillRect(0, 0, 1, 1);
          const d = ctx.getImageData(0, 0, 1, 1).data;
          return d[3] ? [d[0]!, d[1]!, d[2]!, d[3]! / 255] : null;
        };
        const lum = ([r, g, b]: number[]) => {
          const f = (c: number) =>
            (c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
          return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
        };
        const over = (c: number[], bg: number[]) =>
          c.slice(0, 3).map((v, i) => v * (c[3] ?? 1) + bg[i]! * (1 - (c[3] ?? 1)));
        const ratio = (a: number[], b: number[]) => {
          const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m) as [number, number];
          return (x + 0.05) / (y + 0.05);
        };
        const pageBg = parse(getComputedStyle(document.body).backgroundColor) ?? [255, 255, 255, 1];
        const out: string[] = [];
        for (const text of Array.from(
          document.querySelectorAll<HTMLElement>(
            '.path-node:not(.path-node--locked) .path-node__pct, .path-node .path-node__h',
          ),
        )) {
          const node = text.closest('.path-node')!;
          const cs = getComputedStyle(node);
          const fills = (
            cs.backgroundImage.match(/(rgba?|color)\([^)]*\)|#[0-9a-f]{3,8}\b/gi) || []
          )
            .map(parse)
            .filter((c): c is number[] => Boolean(c && c[3]! > 0.5));
          const solid = parse(cs.backgroundColor);
          const under = fills.length ? fills : [solid && solid[3]! > 0.2 ? solid : pageBg];
          const ink = parse(getComputedStyle(text).color)!;
          const worst = Math.min(
            ...under.map((u) => ratio(over(ink, over(u, pageBg)), over(u, pageBg))),
          );
          if (worst < 4.5) out.push(`${node.className} ${text.textContent}: ${worst.toFixed(2)}`);
        }
        return out;
      });
      for (const f of found) failures.push(`${style} ${scheme} ${f}`);
    }
    expect(failures).toEqual([]);
  });
}
