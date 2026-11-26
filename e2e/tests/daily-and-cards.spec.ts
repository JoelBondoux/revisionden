import { expect, test, type Page, type Route } from '@playwright/test';
import { axeWhenSettled } from './support/axe';
import { paintedTextFailures, settle } from './support/painted';
import topicMap from './fixtures/topic-map-gcse-maths.json' with { type: 'json' };

/*
 * W18: the 5-a-day and a flashcard session, each walked to the end on a phone. Until now only
 * their single screens were covered (docs/TESTING.md section 6, gap 1).
 *
 * The 5-a-day starts from Home, answers every item, reaches "Lesson complete", and Home then
 * shows it done. The flashcard session rates every due card (one Again, which comes back once),
 * reaches "Done for today!" with its 20 XP, asks for "10 more", and rates those to "Deck done!".
 * Every screen passes axe (WCAG 2.2 A and AA) once its animations settle.
 *
 * The API is stubbed with page.route and kept in memory for one test. Everything is made up: a
 * made-up pupil, made-up questions and cards (not educational content), no real names.
 */

const STUDENT_ID = '00000000-0000-4000-8000-0000000000d1';
const NOW = '2026-11-26T10:00:00.000Z';

test.skip(({ isMobile }) => !isMobile, 'a phone journey (the phone project)');

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, json: body });

const progress = (xpToday: number) => ({
  xpToday,
  totalXp: 100 + xpToday,
  dailyGoalXp: 50,
  goalMet: xpToday >= 50,
  streak: { current: 3, best: 3, skipDays: 0 },
});

/** A pupil already uses this phone; anything not stubbed answers 404. */
async function asPupil(page: Page) {
  await page.addInitScript(
    (id) => window.localStorage.setItem('revisionden.studentId', id),
    STUDENT_ID,
  );
  await page.route('**/v1/**', (route) =>
    json(route, { error: { code: 'not_found', message: 'Not stubbed', ref: 'RD-E2E000' } }, 404),
  );
  await page.route('**/v1/client-errors', (route) => route.fulfill({ status: 204 }));
  await page.route('**/v1/student/avatar', (route) =>
    json(route, { avatarCode: '1' + '0'.repeat(28), earnedRewardIds: [] }),
  );
  await page.route('**/v1/student/map**', (route) => json(route, topicMap));
  await page.route('**/v1/student/cards/due', (route) => json(route, { due: 0 }));
}

/** No WCAG 2.2 A or AA problem axe can find, once the screen's animations have settled. */
async function expectAccessible(page: Page, where: string) {
  const results = await axeWhenSettled(page);
  expect(
    results.violations.map((v) => `${v.id}: ${v.help}`),
    `axe on ${where}`,
  ).toEqual([]);
}

/** Two made-up short-answer questions for today's 5-a-day. */
const DAILY_ITEMS = [1, 2].map((n) => ({
  id: `00000000-0000-4000-8000-000000000d1${n}`,
  topicId: 'demo-topic',
  topicTitle: 'Demo topic',
  draft: false,
  type: 'short_answer' as const,
  prompt: `Demo daily question ${n}`,
}));

async function stubDaily(page: Page) {
  const state = { answered: [] as string[] };
  await page.route('**/v1/student/daily', (route) =>
    json(route, {
      day: '2026-11-26',
      items: DAILY_ITEMS,
      draftContent: false,
      answeredItemIds: state.answered,
      answered: state.answered.length,
      total: DAILY_ITEMS.length,
      done: state.answered.length === DAILY_ITEMS.length,
    }),
  );
  await page.route('**/v1/student/learn/attempts', (route) => {
    const { itemId } = route.request().postDataJSON() as { itemId: string };
    if (!state.answered.includes(itemId)) state.answered.push(itemId);
    const xpToday = state.answered.length * 10;
    return json(route, {
      id: `00000000-0000-4000-8000-000000000d2${state.answered.length}`,
      itemId,
      correct: true,
      score: 1,
      xpEarned: 10,
      createdAt: NOW,
      feedback: { correctAnswer: 'demo' },
      progress: progress(xpToday),
      flashcardAdded: false,
      combo: state.answered.length,
      comboBonusXp: 0,
      newlyEarned: [],
    });
  });
  return state;
}

test("a pupil starts today's 5-a-day from Home, answers every item and sees it done", async ({
  page,
}) => {
  await asPupil(page);
  const state = await stubDaily(page);

  await page.goto('/home');
  const start = page.getByRole('link', { name: 'Start your 5-a-day' });
  await expect(start).toBeVisible();
  await expectAccessible(page, 'Home, 5-a-day not started');
  await start.click();
  await expect(page).toHaveURL(/\/learn\/daily$/);
  await expect(page.getByRole('heading', { level: 1, name: '5-a-day' })).toBeVisible();

  for (const [i, item] of DAILY_ITEMS.entries()) {
    await expect(page.getByText(item.prompt)).toBeVisible();
    if (i === 0) await expectAccessible(page, 'the first 5-a-day question');
    await page.getByLabel('Your answer').fill('demo');
    await page.getByRole('button', { name: 'Check' }).click();
    await expect.poll(() => state.answered.length).toBe(i + 1);
    await page
      .getByRole('button', { name: i === DAILY_ITEMS.length - 1 ? 'Finish' : 'Continue' })
      .click();
  }

  await expect(page.getByRole('heading', { name: 'Lesson complete' })).toBeVisible();
  await expect(page.getByText('2 of 2')).toBeVisible();
  await expect(page.getByText('+20 XP')).toBeVisible();
  await expectAccessible(page, 'the 5-a-day complete');

  // Back Home, the 5-a-day ring is full and says Done, with no Start or Continue link.
  await page.goto('/home');
  await expect(page.getByRole('progressbar', { name: '5-a-day' })).toHaveAttribute(
    'aria-valuetext',
    '2 of 2 done',
  );
  await expect(page.getByRole('link', { name: /your 5-a-day$/ })).toHaveCount(0);
  await expectAccessible(page, 'Home, 5-a-day done');

  // Going straight to /learn/daily now has nothing left, so it goes to the map.
  await page.goto('/learn/daily');
  await expect(page).toHaveURL(/\/map$/);
});

// W18: "Best combo" on the set-complete card was gold on the page's cream (1.37:1). The stats
// (right answers, XP and best combo) must read AA on what is behind them in every look, light
// and dark, measured with the shared painted-page sampler once the confetti and stars are still.
const ALL_STYLES = [
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

for (const scheme of ['light', 'dark'] as const) {
  test(`the 5-a-day's complete stats read in every look, ${scheme} mode`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ colorScheme: scheme });
    await asPupil(page);
    await page.route('**/v1/student/rewards/effect-styles', (route) =>
      json(route, { unlocked: ALL_STYLES }),
    );
    const failures: string[] = [];
    for (const style of ALL_STYLES) {
      await page.unroute('**/v1/student/daily');
      await page.unroute('**/v1/student/learn/attempts');
      await stubDaily(page);
      await page
        .evaluate((s) => localStorage.setItem('revisionden.effectStyle', s), style)
        .catch(() => undefined);
      await page.addInitScript((s) => localStorage.setItem('revisionden.effectStyle', s), style);
      await page.goto('/learn/daily');
      await expect(page.locator('html')).toHaveAttribute('data-effect-style', style);
      for (const [i] of DAILY_ITEMS.entries()) {
        await page.getByLabel('Your answer').fill('demo');
        await page.getByRole('button', { name: 'Check' }).click();
        await page
          .getByRole('button', { name: i === DAILY_ITEMS.length - 1 ? 'Finish' : 'Continue' })
          .click();
      }
      await expect(page.getByText('Best combo')).toBeVisible();
      await page.addStyleTag({
        content:
          '.confetti, .confetti * { display: none !important; } .set-complete * { animation: none !important; transition: none !important; }',
      });
      await settle(page);
      const found = await paintedTextFailures(page, { only: '.complete__stats' });
      for (const f of found) failures.push(`${style} ${scheme}: ${f}`);
    }
    expect(failures).toEqual([]);
  });
}

/** A made-up card (not educational content). */
const card = (n: number) => ({
  id: `00000000-0000-4000-8000-0000000002${String(n).padStart(2, '0')}`,
  topicId: 'demo-topic-a',
  topicTitle: 'Demo topic A',
  subjectId: 'gcse-maths',
  origin: 'deck',
  front: `Demo front ${n}`,
  back: `Demo back ${n}`,
  draft: false,
  dueAt: '2026-11-25T10:00:00.000Z',
  nextReviewMs: { again: 600_000, hard: 86_400_000, good: 518_400_000, easy: 864_000_000 },
});

/** Today's 5 cards under the daily limit, 3 more behind them, and "10 more" serving those 3. */
const TODAY = [1, 2, 3, 4, 5].map(card);
const MORE = [6, 7, 8].map(card);

async function stubCards(page: Page) {
  const state = {
    sessions: [] as { extra: number; reviews: { cardId: string; rating: string }[] }[],
    finished: 0,
  };
  const sessionId = (i: number) => `00000000-0000-4000-8000-00000000077${i}`;
  await page.route(/\/v1\/student\/flashcards(\?extra=\d+)?$/, (route) => {
    const extra = Number(new URL(route.request().url()).searchParams.get('extra') ?? 0);
    return json(route, {
      due: extra ? MORE : TODAY,
      decks: [
        {
          topicId: 'demo-topic-a',
          title: 'Demo topic A',
          subjectId: 'gcse-maths',
          total: 8,
          due: 8,
        },
      ],
      mine: [],
      draftContent: false,
      dueToday: extra ? MORE.length : TODAY.length,
      backlog: extra ? MORE.length : TODAY.length + MORE.length,
      doneToday: false,
    });
  });
  await page.route('**/v1/student/flashcards/sessions', (route) => {
    const { extra } = (route.request().postDataJSON() ?? {}) as { extra?: number };
    state.sessions.push({ extra: extra ?? 0, reviews: [] });
    return json(
      route,
      {
        id: sessionId(state.sessions.length),
        maxCards: 20,
        minCards: 5,
        xp: 20,
        rewardedLeftToday: state.sessions.length === 1 ? 2 : 1,
      },
      201,
    );
  });
  await page.route(/\/v1\/student\/flashcards\/[^/]+\/review$/, (route) => {
    const cardId = new URL(route.request().url()).pathname.split('/').at(-2)!;
    const { rating } = route.request().postDataJSON() as { rating: string };
    const session = state.sessions.at(-1)!;
    session.reviews.push({ cardId, rating });
    return json(route, {
      card: [...TODAY, ...MORE].find((c) => c.id === cardId),
      comesBackSooner: rating === 'again',
      cardsCounted: new Set(session.reviews.map((r) => r.cardId)).size,
    });
  });
  await page.route(/\/v1\/student\/flashcards\/sessions\/[^/]+\/finish$/, (route) => {
    state.finished += 1;
    const session = state.sessions.at(-1)!;
    const counted = new Set(session.reviews.map((r) => r.cardId)).size;
    const rewarded = counted >= 5;
    return json(route, {
      completed: true,
      reason: rewarded ? 'rewarded' : 'too_few_cards',
      xpEarned: rewarded ? 20 : 0,
      cardsCounted: counted,
      rewardedLeftToday: 1,
      progress: progress(20),
      newlyEarned: [],
    });
  });
  return state;
}

/** Turns the card shown, checks its answer, and rates it. */
async function review(page: Page, n: number, rating: 'Again' | 'Good') {
  await expect(page.getByText(`Demo front ${n}`)).toBeVisible();
  await page.getByRole('button', { name: 'Show answer' }).click();
  await expect(page.getByText(`Demo back ${n}`)).toBeVisible();
  await page.getByRole('button', { name: new RegExp(`^${rating}`) }).click();
}

test('a pupil rates a whole flashcard session to "Done for today!", then 10 more to the end', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await asPupil(page);
  const state = await stubCards(page);

  await page.goto('/cards');
  await expect(page.getByRole('heading', { level: 1, name: 'Cards' })).toBeVisible();
  await expect(page.getByText('Demo front 1')).toBeVisible();
  await expectAccessible(page, 'the first due card');

  // Today's five: the second is rated Again, so it comes back once at the end of the session.
  await review(page, 1, 'Good');
  await review(page, 2, 'Again');
  await expectAccessible(page, 'a card after an Again');
  for (const n of [3, 4, 5]) await review(page, n, 'Good');
  await review(page, 2, 'Good');

  const done = page.locator('.deck-done');
  await expect(done.getByRole('heading', { name: 'Done for today!' })).toBeVisible();
  await expect(done.getByText('+20 XP')).toBeVisible();
  await expect(done.getByText('1 card comes back sooner')).toBeVisible();
  expect(state.finished).toBe(1);
  expect(state.sessions[0]!.reviews.map((r) => r.rating)).toEqual([
    'good',
    'again',
    'good',
    'good',
    'good',
    'good',
  ]);
  await expectAccessible(page, 'Done for today');

  // "10 more" asks for extra cards beyond today's limit and starts a new session with them.
  await done.getByRole('button', { name: '10 more' }).click();
  await expect(page.getByText('Demo front 6')).toBeVisible();
  await expect.poll(() => state.sessions.length).toBe(2);
  expect(state.sessions[1]!.extra).toBe(10);
  for (const n of [6, 7, 8]) await review(page, n, 'Good');

  // Three cards are too few for XP, and nothing is left behind them, so no more "10 more".
  await expect(done.getByRole('heading', { name: 'Deck done!' })).toBeVisible();
  await expect(
    done.getByText('Review at least 5 cards in one session to earn 20 XP.'),
  ).toBeVisible();
  await expect(done.getByRole('button', { name: '10 more' })).toHaveCount(0);
  await expect(done.getByText('No cards come back sooner.')).toBeVisible();
  expect(state.finished).toBe(2);
  await expectAccessible(page, 'Deck done');

  // "Back to learning" goes to /learn, which is Home now.
  await done.getByRole('link', { name: 'Back to learning' }).click();
  await expect(page).toHaveURL(/\/home$/);
});
