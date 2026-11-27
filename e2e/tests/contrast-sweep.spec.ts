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
import { seedApp } from './support/seed';

/*
 * W21: the contrast sweep (owner's report: light looks showing white text on a pale fill). Every
 * screen in apps/web/src/routes.tsx, and the main dialogs, in all 10 looks, light and dark, with
 * reading tints off (the default).
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

type Who = 'pupil' | 'parent' | 'visitor';
interface Screen {
  /** The path exactly as routes.tsx (or LESSON_PATHS) writes it. */
  route: string;
  who: Who;
  /** Where to go: the route with its parameters filled in from the mock data. */
  visit: string;
  /** Not swept, and why (a redirect, or a later pull request). */
  skip?: string;
}

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
  { route: '/about', who: 'pupil', visit: '/about' },
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
  // Parent, staff and family screens: W21 pull request 2.
  { route: '/parent/help', who: 'visitor', visit: '/parent/help', skip: 'W21 PR 2' },
  { route: '/family', who: 'parent', visit: '/family', skip: 'W21 PR 2' },
  { route: '/onboarding', who: 'parent', visit: '/onboarding', skip: 'W21 PR 2' },
  { route: '/join', who: 'parent', visit: '/join', skip: 'W21 PR 2' },
  {
    route: '/family/:studentId/rewards',
    who: 'parent',
    visit: '/family/x/rewards',
    skip: 'W21 PR 2',
  },
  { route: '/review', who: 'parent', visit: '/review', skip: 'W21 PR 2' },
  {
    route: '/review/batches/:batchId',
    who: 'parent',
    visit: '/review/batches/x',
    skip: 'W21 PR 2',
  },
  { route: '/parent', who: 'parent', visit: '/parent', skip: 'W21 PR 2' },
  {
    route: '/parent/reminders/:studentId',
    who: 'parent',
    visit: '/parent/reminders/x',
    skip: 'W21 PR 2',
  },
  {
    route: '/parent/friends/:studentId',
    who: 'parent',
    visit: '/parent/friends/x',
    skip: 'W21 PR 2',
  },
  { route: '/parent/stats', who: 'parent', visit: '/parent/stats', skip: 'W21 PR 2' },
  {
    route: '/parent/subjects/:studentId',
    who: 'parent',
    visit: '/parent/subjects/x',
    skip: 'W21 PR 2',
  },
  { route: '/complaints', who: 'parent', visit: '/complaints', skip: 'W21 PR 2' },
  { route: '/admin/feedback', who: 'parent', visit: '/admin/feedback', skip: 'W21 PR 2' },
  { route: '/feedback/family', who: 'parent', visit: '/feedback/family', skip: 'W21 PR 2' },
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

/** A look as recorded in the known list: the desktop's readings are kept apart from the phone's. */
const as = (look: string) => (test.info().project.name === 'desktop' ? `${look}@desktop` : look);
const PAINTED = !!process.env.CONTRAST_SWEEP;

async function open(page: Page, who: Who, mode: (typeof MODES)[number], visit: string) {
  await page.emulateMedia({ colorScheme: mode });
  await seedApp(page, who);
  await page.goto(visit);
  await page.locator('h1').first().waitFor();
  // Everything the screen loads has arrived, so late content cannot change what is measured.
  await page.waitForLoadState('networkidle');
  // Reading tints and patterns are off (the default): nothing is stored for them.
  expect(
    await page.evaluate(() => document.documentElement.dataset.readingTint ?? null),
  ).toBeNull();
  await expect(page.getByRole('alert').filter({ hasText: 'Something went wrong' })).toHaveCount(0);
  await page.addStyleTag({
    content: '*, *::before, *::after { transition: none !important; animation: none !important; }',
  });
}

/** Measures one screen in each look, and compares with the known failures for it. */
async function sweep(
  page: Page,
  mode: (typeof MODES)[number],
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
      found[`${as(look)}|${mode}|${name}|${f.kind}|${f.where}|${f.label}`] = f.ratio;
  }
  const prefix = (k: string) => looks.some((l) => k.startsWith(`${as(l)}|${mode}|${name}|`));
  const listed = Object.keys(known.tier1).filter(prefix);
  if (UPDATE) {
    mkdirSync('test-results/contrast', { recursive: true });
    writeFileSync(
      `test-results/contrast/tier1-${test.info().project.name}-${mode}-${encodeURIComponent(name)}.json`,
      JSON.stringify(found, null, 2),
    );
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

  for (const screen of SCREENS.filter((s) => !s.skip)) {
    for (const mode of MODES) {
      test(`${screen.route} reads in every look, ${mode} mode`, async ({ page }, info) => {
        test.skip(info.project.name === 'tablet', 'phone (every look) and desktop (default look)');
        await open(page, screen.who, mode, screen.visit);
        await sweep(page, mode, screen.route, looksFor(info.project.name));
      });
    }
  }

  for (const overlay of OVERLAYS) {
    for (const mode of MODES) {
      test(`the ${overlay.name} reads in every look, ${mode} mode`, async ({ page }, info) => {
        test.skip(info.project.name === 'tablet', 'phone (every look) and desktop (default look)');
        await open(page, 'pupil', mode, overlay.visit);
        await overlay.open(page);
        await sweep(page, mode, overlay.name, looksFor(info.project.name), overlay.within);
      });
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
  name: string,
  looks: readonly string[],
  within?: string,
) {
  const found: Record<string, string> = {};
  const seen: Record<string, string> = {};
  const record = (into: Record<string, string>, look: string, lines: string[]) => {
    for (const line of lines) {
      const m = /^(.*?)\s([\d.]+)$/.exec(line);
      const key = `${as(look)}|${mode}|${name}|${(m ? m[1]! : line).replace(/\d/g, '#')}`;
      into[key] = m ? m[2]! : line;
    }
  };
  for (const look of looks) {
    await page.evaluate((l) => {
      document.documentElement.dataset.effectStyle = l;
    }, look);
    await settle(page);
    // The whole page, not just the first screen: scroll down a screen at a time (to six) and
    // measure each, so content below the fold is swept too (Codex on #400).
    const heights = await page.evaluate(() => ({
      page: document.documentElement.scrollHeight,
      view: innerHeight,
    }));
    const stops = [0];
    if (!within)
      for (
        let y = heights.view * 0.8;
        y < heights.page - heights.view * 0.2 && stops.length < 6;
        y += heights.view * 0.8
      )
        stops.push(Math.round(y));
    const steady: string[] = [];
    for (const y of stops) {
      await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
      await settle(page);
      // Text too faint to sample counts as a failure, not a skip (decision 0012); decorative
      // emoji are not text.
      steady.push(
        ...paintedTextFindings(await paintedTextFailures(page, { only: within ?? 'body' })).map(
          (t) => `text|${t}`,
        ),
        ...(await paintedUiFailures(page, within ? { within } : {})),
      );
    }
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await settle(page);
    // Text and edges hold still, so one reading is enough. A focus ring can be caught
    // mid-animation, so it is read twice: found only when both readings fail it, fixed only
    // when neither does.
    record(found, look, steady);
    record(seen, look, steady);
    if (!within) {
      const first: Record<string, string> = {};
      const second: Record<string, string> = {};
      record(first, look, await focusRingFailures(page));
      record(second, look, await focusRingFailures(page));
      for (const k of Object.keys(first)) if (k in second) found[k] = first[k]!;
      Object.assign(seen, first, second);
    }
  }
  const prefix = (k: string) => looks.some((l) => k.startsWith(`${as(l)}|${mode}|${name}|`));
  // A new list takes every failure either focus reading saw, so one quiet reading cannot leave
  // a real failure off it; a check then flags as new only what both readings fail.
  if (UPDATE) {
    mkdirSync('test-results/contrast', { recursive: true });
    writeFileSync(
      `test-results/contrast/tier2-${test.info().project.name}-${mode}-${encodeURIComponent(name)}.json`,
      JSON.stringify(seen, null, 2),
    );
    return;
  }
  const fresh = Object.keys(found).filter((k) => !(k in known.tier2));
  const fixed = Object.keys(known.tier2)
    .filter(prefix)
    .filter((k) => !(k in seen));
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

  for (const screen of SCREENS.filter((s) => !s.skip)) {
    for (const mode of MODES) {
      test(`${screen.route} reads as painted in every look, ${mode} mode`, async ({
        page,
      }, info) => {
        test.skip(info.project.name === 'tablet', 'phone (every look) and desktop (default look)');
        test.setTimeout(300_000);
        await open(page, screen.who, mode, screen.visit);
        await paintedSweep(page, mode, screen.route, looksFor(info.project.name));
      });
    }
  }

  for (const overlay of OVERLAYS) {
    for (const mode of MODES) {
      test(`the ${overlay.name} reads as painted in every look, ${mode} mode`, async ({
        page,
      }, info) => {
        test.skip(info.project.name === 'tablet', 'phone (every look) and desktop (default look)');
        test.setTimeout(300_000);
        await open(page, 'pupil', mode, overlay.visit);
        await overlay.open(page);
        await paintedSweep(page, mode, overlay.name, looksFor(info.project.name), overlay.within);
      });
    }
  }
});
