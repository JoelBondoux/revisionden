import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { mockNextRewards } from '../../apps/web/src/features/learn/mocks';
import { computedContrastFailures } from './support/contrastStyles';
import { isDecorativeEmoji, paintedTextFindings } from './support/contrastFilter';
import {
  focusRingFailures,
  paintedTextFailures,
  paintedUiFailures,
  settle,
} from './support/painted';
import { recordDifferences } from './support/contrastRecord';
import { seedApp } from './support/seed';

/*
 * W21: the contrast sweep (owner's report: light looks showing white text on a pale fill). Every
 * screen in apps/web/src/routes.tsx (pupil, public, parent and staff), and the main dialogs, in all
 * 10 looks, light and dark, in each colour choice a family can make: the standard and colour-blind
 * palettes and each reading tint (W21b). Tier 2 sweeps every variant nightly
 * (CONTRAST_VARIANTS=1), and the standard palette otherwise.
 *
 * Tier 1 (here, every pull request): computed styles only, no screenshots. Text must read 4.5:1
 * (3:1 when large: 24px, or 18.66px bold) against the nearest opaque background; buttons, inputs,
 * switches and tabs must stand out 3:1 by their fill or border (WCAG 1.4.3, 1.4.11). What styles
 * alone cannot judge (page art, gradients, shadows, browser-drawn controls) is left to tier 2,
 * the painted sweep (CONTRAST_SWEEP=1).
 *
 * Known failures live in contrast-known.json (decision 0012, one entry in
 * project_memory/operations/contradictions.md). A test fails on any failure not listed, and on
 * any listed failure that is now fixed, so each fix must also remove its line. Refresh the list
 * with CONTRAST_UPDATE=1, then `node e2e/scripts/contrast-known.mjs`.
 *
 * The route table enforces itself: a route added to routes.tsx without a row here fails the
 * guard test below. All data is the web app's own made-up mock data.
 */

const LOOKS = [
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
const MODES = ['light', 'dark'] as const;

/**
 * The colour choices a family can make (W21b): the standard palette, the colour-blind palette,
 * and each reading tint (on the standard palette). Each is swept as its own test, keyed apart.
 */
interface Variant {
  id: string;
  /** What is stored on this device before the app loads, as Settings would store it. */
  appearance?: { palette: string };
  reading?: { tint: string };
  /** How the test name reads; the standard palette adds nothing. */
  label: string;
}
const VARIANTS: readonly Variant[] = [
  { id: 'standard', label: '' },
  { id: 'colourblind', appearance: { palette: 'colourblind' }, label: ', colour-blind palette' },
  { id: 'cream', reading: { tint: 'cream' }, label: ', cream reading tint' },
  { id: 'blue', reading: { tint: 'blue' }, label: ', blue reading tint' },
];
/** Tier 2 sweeps every variant only nightly (CONTRAST_VARIANTS=1); otherwise the standard one. */
const PAINTED_VARIANTS = process.env.CONTRAST_VARIANTS ? VARIANTS : VARIANTS.slice(0, 1);

type Who = 'pupil' | 'parent' | 'visitor';
interface Screen {
  /** The path exactly as routes.tsx (or LESSON_PATHS) writes it. */
  route: string;
  who: Who;
  /** Where to go: the route with its parameters filled in from the mock data. */
  visit: string;
  /** Not swept, and why (a redirect, or a later pull request). */
  skip?: string;
  /**
   * Holds the screen's ever-growing lists to the same few made-up lines on every run, so a new
   * changelog line or package cannot move rows in or out of the sweep or change their keys.
   */
  steady?: (page: Page) => Promise<void>;
}

/** /about with three made-up What's new lines and its first three licences (see SCREENS). */
async function steadyAbout(page: Page) {
  await page.evaluate(() => {
    const versions = Array.from(document.querySelectorAll('.about__version'));
    versions.slice(1).forEach((v) => v.remove());
    const lines = Array.from(versions[0]?.querySelectorAll('li') ?? []);
    lines.slice(3).forEach((l) => l.remove());
    lines.slice(0, 3).forEach((l, n) => {
      l.textContent = `A made-up line about a change, number ${n + 1}, the same on every run.`;
    });
    Array.from(document.querySelectorAll('.about__licences li'))
      .slice(3)
      .forEach((l) => l.remove());
  });
}

/** The mock family's first child, and the mock review batch (both made up). */
const CHILD = '00000000-0000-4000-8000-0000000000a1';
const BATCH = '11111111-1111-4111-8111-111111111111';

const SCREENS: Screen[] = [
  // Pupil: the app with the bottom nav.
  { route: '/home', who: 'pupil', visit: '/home' },
  { route: '/map', who: 'pupil', visit: '/map' },
  { route: '/learn/subject/:subjectId', who: 'pupil', visit: '/learn/subject/gcse-maths' },
  { route: '/cards', who: 'pupil', visit: '/cards' },
  { route: '/rewards', who: 'pupil', visit: '/rewards' },
  { route: '/league', who: 'pupil', visit: '/league' },
  { route: '/plan', who: 'pupil', visit: '/plan' },
  { route: '/papers', who: 'pupil', visit: '/papers' },
  { route: '/progress', who: 'pupil', visit: '/progress' },
  { route: '/settings', who: 'pupil', visit: '/settings' },
  { route: '/settings/look-and-sound', who: 'pupil', visit: '/settings/look-and-sound' },
  { route: '/settings/more', who: 'pupil', visit: '/settings/more' },
  { route: '/install', who: 'pupil', visit: '/install' },
  // What's new gains a line with every change and the licences list with every package: three
  // of each, alike in style, show the colours just as well (lead, after train #403).
  { route: '/about', who: 'pupil', visit: '/about', steady: steadyAbout },
  { route: '/legal', who: 'pupil', visit: '/legal' },
  { route: '/legal/:name', who: 'pupil', visit: '/legal/privacy-notice' },
  { route: '/feedback', who: 'pupil', visit: '/feedback' },
  { route: '/feedback/mine', who: 'pupil', visit: '/feedback/mine' },
  // Pupil: lessons and tests (no nav).
  { route: '/learn/topic/:topicId', who: 'pupil', visit: '/learn/topic/demo' },
  { route: '/learn/daily', who: 'pupil', visit: '/learn/daily' },
  {
    route: '/learn/subject/:subjectId/practice',
    who: 'pupil',
    visit: '/learn/subject/gcse-maths/practice',
  },
  {
    route: '/learn/subject/:subjectId/start',
    who: 'pupil',
    visit: '/learn/subject/gcse-maths/start',
  },
  { route: '/learn/command-words', who: 'pupil', visit: '/learn/command-words' },
  // Signed out, or a pupil without a session.
  { route: '/', who: 'visitor', visit: '/' },
  { route: '/help', who: 'visitor', visit: '/help' },
  { route: '/unlock', who: 'visitor', visit: '/unlock' },
  { route: '/link', who: 'visitor', visit: '/link' },
  { route: '/ask-a-parent', who: 'visitor', visit: '/ask-a-parent' },
  { route: '/welcome/privacy', who: 'visitor', visit: '/welcome/privacy' },
  { route: '*', who: 'visitor', visit: '/no-such-page' },
  // Redirects: their target is swept.
  { route: '/learn', who: 'pupil', visit: '/learn', skip: 'redirects to /home' },
  {
    route: '/lesson/:lessonId',
    who: 'pupil',
    visit: '/lesson/demo',
    skip: 'redirects to /learn/topic/:topicId',
  },
  {
    route: '/lesson/:lessonId/complete',
    who: 'pupil',
    visit: '/lesson/demo/complete',
    skip: 'redirects to /map',
  },
  // Parent and family screens (a signed-in parent with the mock family).
  { route: '/parent/help', who: 'visitor', visit: '/parent/help' },
  { route: '/family', who: 'parent', visit: '/family' },
  { route: '/onboarding', who: 'parent', visit: '/onboarding' },
  { route: '/join', who: 'parent', visit: '/join' },
  { route: '/family/:studentId/rewards', who: 'parent', visit: `/family/${CHILD}/rewards` },
  { route: '/parent', who: 'parent', visit: '/parent' },
  { route: '/parent/reminders/:studentId', who: 'parent', visit: `/parent/reminders/${CHILD}` },
  { route: '/parent/friends/:studentId', who: 'parent', visit: `/parent/friends/${CHILD}` },
  { route: '/parent/stats', who: 'parent', visit: '/parent/stats' },
  { route: '/parent/subjects/:studentId', who: 'parent', visit: `/parent/subjects/${CHILD}` },
  { route: '/complaints', who: 'parent', visit: '/complaints' },
  { route: '/feedback/family', who: 'parent', visit: '/feedback/family' },
  // Staff screens (a made-up reviewer and operator).
  { route: '/review', who: 'parent', visit: '/review' },
  { route: '/review/batches/:batchId', who: 'parent', visit: `/review/batches/${BATCH}` },
  { route: '/admin/feedback', who: 'parent', visit: '/admin/feedback' },
];

/** The main dialogs and sheets, opened on top of their screen. */
interface Overlay {
  name: string;
  visit: string;
  open: (page: Page) => Promise<void>;
  /** Measure only inside this (the rest of the page sits behind a backdrop). */
  within?: string;
}
const OVERLAYS: Overlay[] = [
  {
    name: 'Subject selection',
    visit: '/map',
    open: async (page) => {
      await page.getByRole('button', { name: /^Your subject .* Change$/ }).click();
      await page.getByRole('region', { name: 'Pick a subject' }).waitFor();
    },
  },
  {
    name: 'Leave this lesson?',
    visit: '/learn/topic/demo',
    within: 'dialog[open]',
    open: async (page) => {
      await page.getByText('Option B', { exact: true }).click();
      await page.getByRole('button', { name: 'Home' }).click();
      await page.getByRole('dialog', { name: 'Leave this lesson?' }).waitFor();
    },
  },
  {
    name: 'Prize box',
    visit: '/learn/topic/demo',
    within: 'dialog[open]',
    open: async (page) => {
      mockNextRewards([{ id: 'streak-7', name: '7-day streak', rarity: 'common' }]);
      await page.getByText('Option B', { exact: true }).click();
      await page.getByRole('button', { name: 'Check' }).click();
      const box = page.getByRole('dialog');
      await box.getByRole('button', { name: 'Open the prize box' }).click();
      await box.getByRole('button', { name: 'Collect' }).waitFor();
    },
  },
  {
    name: 'Avatar editor',
    visit: '/settings',
    open: async (page) => {
      await page.getByRole('button', { name: 'Edit my avatar' }).click();
      await page.getByRole('button', { name: 'Save' }).waitFor();
    },
  },
];

// ---------------------------------------------------------------------------------------------
// The route table guards itself.

function routesInApp(): string[] {
  const src = (p: string) =>
    readFileSync(new URL(`../../apps/web/src/${p}`, import.meta.url), 'utf8');
  const lessons = Object.fromEntries(
    Array.from(src('layout/lessonRoutes.ts').matchAll(/(\w+): '([^']+)'/g), (m) => [m[1], m[2]]),
  );
  const routes = src('routes.tsx');
  return [
    ...Array.from(routes.matchAll(/path: '([^']+)'/g), (m) => m[1]!),
    ...Array.from(routes.matchAll(/path: LESSON_PATHS\.(\w+)/g), (m) => lessons[m[1]!]!),
  ];
}

test('every route in routes.tsx has a row in the contrast sweep', { tag: '@contrast' }, () => {
  const inApp = new Set(routesInApp());
  const listed = new Set(SCREENS.map((s) => s.route));
  expect(
    [...inApp].filter((r) => !listed.has(r)),
    'routes with no row in SCREENS',
  ).toEqual([]);
  expect(
    [...listed].filter((r) => !inApp.has(r)),
    'rows for routes that no longer exist',
  ).toEqual([]);
});

test(
  '/about is swept with the same few lines on every run (after train #403)',
  { tag: '@contrast' },
  async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'one check is enough');
    const about = SCREENS.find((s) => s.route === '/about')!;
    await open(page, about.who, 'light', about.visit, VARIANTS[0]!);
    expect(about.steady, '/about holds its lists steady').toBeDefined();
    await about.steady!(page);
    await expect(page.locator('.about__version')).toHaveCount(1);
    await expect(page.locator('.about__version li')).toHaveText([
      'A made-up line about a change, number 1, the same on every run.',
      'A made-up line about a change, number 2, the same on every run.',
      'A made-up line about a change, number 3, the same on every run.',
    ]);
    await expect(page.locator('.about__licences li')).toHaveCount(3);
  },
);

/** Every colour choice the app offers a family: the palettes, and the reading tints. */
function variantsInApp(): string[] {
  const choices = (p: string, name: string) => {
    const src = readFileSync(new URL(`../../apps/web/src/${p}`, import.meta.url), 'utf8');
    const list = new RegExp(`${name}: \\[([^\\]]+)\\]`).exec(src)![1]!;
    return Array.from(list.matchAll(/'([^']+)'/g), (m) => m[1]!);
  };
  return [
    ...choices('features/appearance/settings.ts', 'palette'),
    ...choices('features/reading/settings.ts', 'tint').filter((t) => t !== 'none'),
  ];
}

test(
  'the sweep covers every palette and reading tint in the app (W21b)',
  { tag: '@contrast' },
  () => {
    expect(VARIANTS.map((v) => v.id).sort()).toEqual(variantsInApp().sort());
  },
);

test.describe('which painted readings count (decision 0012)', { tag: '@contrast' }, () => {
  test('text too faint to sample is a failure, not a skip', () => {
    const faint = '"For:" has too few letter pixels to check';
    expect(paintedTextFindings([faint, '"Up next" 1.05'])).toEqual([faint, '"Up next" 1.05']);
  });

  test('only a decorative emoji on its own is left out', () => {
    expect(isDecorativeEmoji('"🦊" 2.10')).toBe(true);
    expect(isDecorativeEmoji('"🦊🎉" has too few letter pixels to check')).toBe(true);
    expect(isDecorativeEmoji('"🦊 Fox" 2.10')).toBe(false);
    expect(isDecorativeEmoji('"›" 1.80')).toBe(false);
    expect(isDecorativeEmoji('"#" 1.23')).toBe(false);
    expect(paintedTextFindings(['"🦊" 2.10', '"Fox 🦊" 2.10'])).toEqual(['"Fox 🦊" 2.10']);
  });
});

// ---------------------------------------------------------------------------------------------
// Tier 1: computed styles, every look, light and dark.

type Known = {
  decision: string;
  tracking: string;
  tier1: Record<string, number>;
  tier2: Record<string, string>;
};
const knownFile = new URL('./contrast-known.json', import.meta.url);
const known: Known = JSON.parse(readFileSync(knownFile, 'utf8')) as Known;
const UPDATE = !!process.env.CONTRAST_UPDATE;
/**
 * Also write where each tier 2 test differs from the known list, and still check it (CI, W21b):
 * the painted workflow prints these files into its log, so the known list can follow what CI
 * draws rather than a developer's machine (e2e/scripts/contrast-from-log.mjs).
 */
const RECORD = !!process.env.CONTRAST_RECORD;

/**
 * A look as recorded in the known list: a variant other than standard is added (+colourblind),
 * and the desktop's readings are kept apart from the phone's (@desktop).
 */
const as = (look: string, variant: Variant) =>
  `${look}${variant.id === 'standard' ? '' : `+${variant.id}`}${
    test.info().project.name === 'desktop' ? '@desktop' : ''
  }`;
/** The file one test writes its findings to, for contrast-known.mjs to merge. */
const resultFile = (tier: string, mode: string, variant: Variant, name: string) =>
  `test-results/contrast/${tier}-${test.info().project.name}-${mode}-${variant.id}-${encodeURIComponent(name)}.json`;
const PAINTED = !!process.env.CONTRAST_SWEEP;

async function open(
  page: Page,
  who: Who,
  mode: (typeof MODES)[number],
  visit: string,
  variant: Variant,
) {
  await page.emulateMedia({ colorScheme: mode });
  await seedApp(page, who);
  await page.addInitScript((v) => {
    if (v.appearance) localStorage.setItem('revisionden.appearance', JSON.stringify(v.appearance));
    if (v.reading) localStorage.setItem('revisionden.reading', JSON.stringify(v.reading));
  }, variant);
  await page.goto(visit);
  await page.locator('h1').first().waitFor();
  // Everything the screen loads has arrived, so late content cannot change what is measured.
  await page.waitForLoadState('networkidle');
  // The variant is what the app shows: the palette, and the reading tint (none by default).
  expect(
    await page.evaluate(() => ({
      palette: document.documentElement.dataset.palette ?? null,
      tint: document.documentElement.dataset.readingTint ?? null,
    })),
  ).toEqual({
    palette: variant.appearance?.palette ?? 'standard',
    tint: variant.reading?.tint ?? null,
  });
  await expect(page.getByRole('alert').filter({ hasText: 'Something went wrong' })).toHaveCount(0);
  await page.addStyleTag({
    content: '*, *::before, *::after { transition: none !important; animation: none !important; }',
  });
}

/** Measures one screen in each look, and compares with the known failures for it. */
async function sweep(
  page: Page,
  mode: (typeof MODES)[number],
  variant: Variant,
  name: string,
  looks: readonly string[],
  within?: string,
) {
  const found: Record<string, number> = {};
  for (const look of looks) {
    await page.evaluate((l) => {
      document.documentElement.dataset.effectStyle = l;
    }, look);
    await page.evaluate(
      () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
    );
    const { failures } = await computedContrastFailures(page, within ? { within } : {});
    for (const f of failures)
      found[`${as(look, variant)}|${mode}|${name}|${f.kind}|${f.where}|${f.label}`] = f.ratio;
  }
  const prefix = (k: string) =>
    looks.some((l) => k.startsWith(`${as(l, variant)}|${mode}|${name}|`));
  const listed = Object.keys(known.tier1).filter(prefix);
  if (UPDATE) {
    mkdirSync('test-results/contrast', { recursive: true });
    writeFileSync(resultFile('tier1', mode, variant, name), JSON.stringify(found, null, 2));
    return;
  }
  const fresh = Object.keys(found).filter((k) => !(k in known.tier1));
  const fixed = listed.filter((k) => !(k in found));
  expect(
    fresh.map((k) => `${k} (${found[k]})`),
    'new contrast failures (fix them, or list them in contrast-known.json with a reason)',
  ).toEqual([]);
  expect(fixed, 'fixed: remove these from contrast-known.json').toEqual([]);
}

test.describe('tier 1: contrast from computed styles', { tag: '@contrast' }, () => {
  const looksFor = (project: string) =>
    project === 'desktop' ? (['doodle-diary'] as const) : LOOKS;

  for (const variant of VARIANTS) {
    for (const screen of SCREENS.filter((s) => !s.skip)) {
      for (const mode of MODES) {
        test(`${screen.route} reads in every look, ${mode} mode${variant.label}`, async ({
          page,
        }, info) => {
          test.skip(
            info.project.name === 'tablet',
            'phone (every look) and desktop (default look)',
          );
          await open(page, screen.who, mode, screen.visit, variant);
          await screen.steady?.(page);
          await sweep(page, mode, variant, screen.route, looksFor(info.project.name));
        });
      }
    }

    for (const overlay of OVERLAYS) {
      for (const mode of MODES) {
        test(`the ${overlay.name} reads in every look, ${mode} mode${variant.label}`, async ({
          page,
        }, info) => {
          test.skip(
            info.project.name === 'tablet',
            'phone (every look) and desktop (default look)',
          );
          await open(page, 'pupil', mode, overlay.visit, variant);
          await overlay.open(page);
          await sweep(
            page,
            mode,
            variant,
            overlay.name,
            looksFor(info.project.name),
            overlay.within,
          );
        });
      }
    }
  }
});

// ---------------------------------------------------------------------------------------------
// Tier 2: the painted sweep (CONTRAST_SWEEP=1): what is really drawn, page art and gradients
// included. Text in every box (4.5:1, 3:1 large), UI parts' edges (3:1) and the first focus rings.

/** One painted pass over a screen in each look; findings are compared as in tier 1. */
async function paintedSweep(
  page: Page,
  mode: (typeof MODES)[number],
  variant: Variant,
  name: string,
  looks: readonly string[],
  within?: string,
) {
  const found: Record<string, string> = {};
  const seen: Record<string, string> = {};
  /** Each finding by its key; the value is its ratio (or what was wrong) and, for text and
   * edges, the scroll stop it was read at (`@ 640`), so a reading can be traced. */
  const record = (into: Record<string, string>, look: string, lines: string[], stop?: number) => {
    for (const line of lines) {
      const m = /^(.*?)\s([\d.]+)$/.exec(line);
      const key = `${as(look, variant)}|${mode}|${name}|${(m ? m[1]! : line).replace(/\d/g, '#')}`;
      if (key in into) continue; // the first stop that found it
      into[key] = `${m ? m[2]! : line}${stop === undefined ? '' : ` @ ${stop}`}`;
    }
  };
  for (const look of looks) {
    await page.evaluate((l) => {
      document.documentElement.dataset.effectStyle = l;
    }, look);
    await settle(page);
    // The whole page, not just the first screen: scroll down a screen at a time to the end and
    // measure each, so content below the fold is swept too (Codex on #400). No cap: a cap cut
    // long pages at a place that moved with their content (train #403).
    const heights = await page.evaluate(() => ({
      page: document.documentElement.scrollHeight,
      view: innerHeight,
    }));
    const stops = [0];
    if (!within)
      for (
        let y = heights.view * 0.8;
        y < heights.page - heights.view * 0.2;
        y += heights.view * 0.8
      )
        stops.push(Math.round(y));
    // Text and edges hold still, so one reading is enough.
    for (const y of stops) {
      await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
      await settle(page);
      // Text too faint to sample counts as a failure, not a skip (decision 0012); decorative
      // emoji are not text.
      const here = [
        ...paintedTextFindings(await paintedTextFailures(page, { only: within ?? 'body' })).map(
          (t) => `text|${t}`,
        ),
        ...(await paintedUiFailures(page, within ? { within } : {})),
      ];
      record(found, look, here, y);
      record(seen, look, here, y);
    }
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await settle(page);
    // A focus ring can be caught mid-animation, so it is read twice: found only when both
    // readings fail it, fixed only when neither does.
    if (!within) {
      const first: Record<string, string> = {};
      const second: Record<string, string> = {};
      record(first, look, await focusRingFailures(page));
      record(second, look, await focusRingFailures(page));
      for (const k of Object.keys(first)) if (k in second) found[k] = first[k]!;
      Object.assign(seen, first, second);
    }
  }
  const prefix = (k: string) =>
    looks.some((l) => k.startsWith(`${as(l, variant)}|${mode}|${name}|`));
  // A new list takes every failure either focus reading saw, so one quiet reading cannot leave
  // a real failure off it; a check then flags as new only what both readings fail.
  if (UPDATE) {
    mkdirSync('test-results/contrast', { recursive: true });
    writeFileSync(resultFile('tier2', mode, variant, name), JSON.stringify(seen, null, 2));
    return;
  }
  const fresh = Object.keys(found).filter((k) => !(k in known.tier2));
  const fixed = Object.keys(known.tier2)
    .filter(prefix)
    .filter((k) => !(k in seen));
  // CI (CONTRAST_RECORD=1) writes only where it differs from the list, for its log: the rows it
  // finds that are not listed, and the listed rows it no longer finds. Small enough to read back
  // (e2e/scripts/contrast-from-log.mjs), so the list follows what CI draws.
  // A clean retry removes the failed attempt's file (recordDifferences).
  if (RECORD)
    recordDifferences(
      resultFile('diff-tier2', mode, variant, name),
      Object.fromEntries(fresh.map((k) => [k, seen[k]!])),
      fixed,
    );
  expect(
    fresh.map((k) => `${k} (${found[k]})`),
    'new painted contrast failures',
  ).toEqual([]);
  expect(fixed, 'fixed: remove these from contrast-known.json').toEqual([]);
}

test.describe('tier 2: painted contrast', { tag: '@contrast-painted' }, () => {
  test.skip(
    !PAINTED,
    'set CONTRAST_SWEEP=1 (nightly, before staging, and on look or design changes)',
  );
  const looksFor = (project: string) =>
    project === 'desktop' ? (['doodle-diary'] as const) : LOOKS;

  for (const variant of PAINTED_VARIANTS) {
    for (const screen of SCREENS.filter((s) => !s.skip)) {
      for (const mode of MODES) {
        test(`${screen.route} reads as painted in every look, ${mode} mode${variant.label}`, async ({
          page,
        }, info) => {
          test.skip(
            info.project.name === 'tablet',
            'phone (every look) and desktop (default look)',
          );
          test.setTimeout(600_000);
          await open(page, screen.who, mode, screen.visit, variant);
          await screen.steady?.(page);
          await paintedSweep(page, mode, variant, screen.route, looksFor(info.project.name));
        });
      }
    }

    for (const overlay of OVERLAYS) {
      for (const mode of MODES) {
        test(`the ${overlay.name} reads as painted in every look, ${mode} mode${variant.label}`, async ({
          page,
        }, info) => {
          test.skip(
            info.project.name === 'tablet',
            'phone (every look) and desktop (default look)',
          );
          test.setTimeout(600_000);
          await open(page, 'pupil', mode, overlay.visit, variant);
          await overlay.open(page);
          await paintedSweep(
            page,
            mode,
            variant,
            overlay.name,
            looksFor(info.project.name),
            overlay.within,
          );
        });
      }
    }
  }
});
