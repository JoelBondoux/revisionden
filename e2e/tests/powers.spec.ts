import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/**
 * F9: no raw power ("x^2") on the lesson and flashcard screens, checked with every real content item that
 * shows one (the stored content keeps its ^; only the display changes).
 */
const CONTENT = join(import.meta.dirname, '../../content/items');
const STUDENT_ID = '00000000-0000-4000-8000-0000000000c2';

type Raw = Record<string, unknown> & { id: string; type: string; topic: string };

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : path.endsWith('.json') ? [path] : [];
  });
}

const shown = (i: Raw) =>
  [i.prompt, i.front, i.back, i.hint, ...((i.options as string[] | undefined) ?? [])].filter(
    (s): s is string => typeof s === 'string',
  );

function itemsIn(path: string): Raw[] {
  const data = JSON.parse(readFileSync(path, 'utf8')) as Raw | Raw[] | { items: Raw[] };
  if (Array.isArray(data)) return data;
  return 'items' in data && Array.isArray(data.items) ? data.items : [data as Raw];
}

const items: Raw[] = files(CONTENT)
  .flatMap(itemsIn)
  .filter((i) => typeof i?.type === 'string' && shown(i).some((s) => s.includes('^')));

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** The shape the lesson API sends for a content item (no answers). */
function learnItem(i: Raw, n: number) {
  const base = { id: uuid(n), topicId: i.topic, topicTitle: 'Demo topic', draft: false };
  if (i.type === 'flashcard') return { ...base, type: i.type, front: i.front, back: i.back };
  return {
    ...base,
    type: i.type,
    prompt: i.prompt,
    ...(i.options ? { options: i.options } : {}),
    // Interactive tiles (W8) carry their quadratic, as the API sends them.
    ...(i.type === 'area_model' ? { mode: i.mode, quadratic: i.quadratic } : {}),
    ...(typeof (i.answer as { unit?: unknown })?.unit === 'string'
      ? { unit: (i.answer as { unit: string }).unit }
      : {}),
  };
}

/**
 * A caret that raises something ("x^2", "10^(2 + 8)") must never be visible. A caret on its own
 * stays: content tells children how to type a power ("Use ^ for powers"), which the Power key does.
 */
const RAW_POWER = /\^[-−\d(A-Za-z]/;

/** The page's text a person can see: screen-reader-only words left out. */
const visibleText = (page: Page) =>
  page.locator('main').evaluate((main) => {
    const copy = main.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('.visually-hidden').forEach((e) => e.remove());
    return copy.textContent ?? '';
  });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    (id) => window.localStorage.setItem('revisionden.studentId', id),
    STUDENT_ID,
  );
});

test('real content shows powers as superscripts, with no visible ^, in lessons', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'one size is enough for a content sweep');
  test.setTimeout(180_000);
  expect(items.length).toBeGreaterThan(100);
  let current: object = {};
  await page.route('**/v1/student/learn/lesson**', (route) =>
    route.fulfill({ json: { items: [current], draftContent: false } }),
  );
  const leaks: string[] = [];
  for (const [n, item] of items.entries()) {
    if (item.type === 'flashcard') continue;
    current = learnItem(item, n + 1);
    await page.goto(`/learn/topic/${item.topic}`);
    await expect(page.locator('.question__prompt').first()).toBeVisible();
    await expect(page.locator('main sup').first()).toBeAttached();
    if (RAW_POWER.test(await visibleText(page))) leaks.push(item.id);
  }
  expect(leaks).toEqual([]);
});

test('real flashcards show powers as superscripts, with no visible ^', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one size is enough for a content sweep');
  const cards = items
    .filter((i) => i.type === 'flashcard')
    .map((i, n) => ({
      ...learnItem(i, 500 + n),
      subjectId: 'gcse-maths',
      origin: 'own',
      dueAt: '2026-11-24T10:00:00.000Z',
      nextReviewMs: { again: 600_000, hard: 86_400_000, good: 518_400_000, easy: 864_000_000 },
      draft: false,
    }));
  expect(cards.length).toBeGreaterThan(10);
  await page.route('**/v1/student/flashcards', (route) =>
    route.fulfill({ json: { due: cards, decks: [], mine: cards, draftContent: false } }),
  );
  await page.route('**/v1/student/flashcards/sessions', (route) =>
    route.fulfill({
      status: 201,
      json: { id: uuid(777), maxCards: 20, minCards: 5, xp: 20, rewardedLeftToday: 2 },
    }),
  );
  await page.goto('/cards');
  await expect(page.getByTestId('flip-card')).toBeVisible();
  await page.getByRole('button', { name: 'Show answer' }).click();
  expect(await visibleText(page)).not.toMatch(RAW_POWER);
  await page.getByRole('tab', { name: 'My cards' }).click();
  await expect(page.locator('.deck-list__title').first()).toBeVisible();
  expect(await page.locator('.deck-list__title').count()).toBe(cards.length);
  expect(await visibleText(page)).not.toMatch(RAW_POWER);
});

test('a tap on a power switches every power between x² and x^2, and it is remembered', async ({
  page,
}) => {
  const card = {
    ...learnItem(
      { id: 'demo', type: 'flashcard', topic: 'demo-topic', front: 'x^2 + 10^3', back: 'y^2' },
      901,
    ),
    subjectId: 'gcse-maths',
    origin: 'own',
    dueAt: '2026-11-24T10:00:00.000Z',
    nextReviewMs: { again: 600_000, hard: 86_400_000, good: 518_400_000, easy: 864_000_000 },
  };
  await page.route('**/v1/student/flashcards', (route) =>
    route.fulfill({ json: { due: [card], decks: [], mine: [], draftContent: false } }),
  );
  await page.route('**/v1/student/flashcards/sessions', (route) =>
    route.fulfill({
      status: 201,
      json: { id: uuid(777), maxCards: 20, minCards: 5, xp: 20, rewardedLeftToday: 2 },
    }),
  );
  await page.goto('/cards');
  const flip = page.getByTestId('flip-card');
  // The question side only: the answer is on the page, hidden, until the card turns (F21).
  const front = flip.locator('.flip-card__face--front');
  await expect(front.locator('sup')).toHaveCount(2);
  await flip.locator('.math-text').first().click();
  // The tap switched the powers, and did not turn the card.
  await expect(flip).not.toHaveClass(/flip-card--flipped/);
  await expect(front.locator('sup')).toHaveCount(0);
  await expect(flip).toContainText('x^2 + 10^3');
  await page.reload();
  await expect(page.getByTestId('flip-card')).toContainText('x^2 + 10^3');
  await page.getByTestId('flip-card').locator('.math-text').first().click();
  await expect(front.locator('sup')).toHaveCount(2);
});
