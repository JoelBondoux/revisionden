# Testing protocol

> Live document. Every contributor (human or AI session) follows it. Change it by pull request.

## 1. Red, green, refactor (mandatory)

All behaviour is built test-first:

1. **Red:** write the smallest test that describes the next piece of behaviour. Run it and
   **see it fail for the right reason** (not a typo or missing import). Paste the failing
   output into the PR description or commit message body when it is not obvious.
2. **Green:** write the least code that makes it pass. Run the whole package's tests.
3. **Refactor:** tidy names and structure with all tests green. No new behaviour here.

Commit at green or after refactor, never at red on a shared branch. A bug fix starts with a test
that reproduces the bug.

## 2. Test layers

| Layer                 | Tool                                                              | Where            | Runs                                 |
| --------------------- | ----------------------------------------------------------------- | ---------------- | ------------------------------------ |
| Unit (pure logic)     | Vitest                                                            | `packages/core`  | Every push, every PR                 |
| Unit (scripts)        | `node --test`                                                     | `scripts/`       | Every push, every PR                 |
| Component             | Vitest + Testing Library                                          | `apps/web`       | Every push, every PR                 |
| API integration       | Vitest + Hono `app.request`, Postgres via PGlite or a Neon branch | `apps/api`       | Every push, every PR                 |
| Contract              | Shared Zod schemas used by both web and API                       | `packages/core`  | Every PR                             |
| Maths engine          | pytest                                                            | `services/maths` | Every push, every PR                 |
| Content validation    | JSON Schema + answer checks (maths answers checked by the engine) | `content/`       | Every PR touching content            |
| End-to-end            | Playwright (phone, tablet, desktop viewports)                     | `e2e/`           | PRs into `dev`, `staging` and `main` |
| Accessibility         | axe-core inside Playwright; WCAG 2.2 AA                           | `e2e/`           | PRs into `dev`, `staging` and `main` |
| AI marking evaluation | Golden set of answers with known marks; tolerance ±1 level        | `evals/`         | Weekly and on prompt changes         |

## 3. Coverage gates

| Package          | Minimum lines and branches |
| ---------------- | -------------------------- |
| `packages/core`  | 90%                        |
| `apps/api`       | 80%                        |
| `apps/web`       | 70%                        |
| `services/maths` | 90%                        |

CI fails below the gate. Raising a gate is welcome; lowering one needs a reason in the PR.

## 4. Rules

- Tests describe behaviour in plain words (`moves up when the average beats the target boundary`).
- No real personal data in fixtures: use made-up nicknames and generic schools.
- Tests do not call real AI providers. Use recorded fixtures; the eval suite is the only place
  real models are called, and it is never run in CI by default.
- Time and randomness are injected so tests are repeatable.
- A flaky test is a bug: fix it or delete it the same day.
- Web tests: every `findBy…` and `waitFor` waits up to 5 seconds for a screen's data and each test has 15 seconds (`apps/web/src/test-setup.ts`), so a slow CI runner does not time a test out while it is still loading. No per-file `LOAD` timeout is needed.

## 5. Running tests

```bash
pnpm install
pnpm test            # all TypeScript unit and component tests
pnpm test:coverage   # with coverage gates
pnpm test:scripts    # repo scripts, scripts/verify and the evals harness (fakes only)
UPDATE_SNAPSHOTS=1 node --test scripts/verify/audit.test.mjs   # refresh the audit snapshot
cd services/maths && pip install -r requirements-dev.txt && python -m pytest -q
pnpm --filter @revisionden/web build && pnpm --filter @revisionden/e2e e2e   # end-to-end + axe
E2E_BASE_URL=https://dev.revisionden.com pnpm --filter @revisionden/e2e e2e  # against a live site
E2E_BASE_URL=https://staging.revisionden.com pnpm --filter @revisionden/e2e smoke  # deployed smoke
E2E_BASE_URL=https://staging.revisionden.com E2E_WWW_URL=https://www-staging.revisionden.com pnpm --filter @revisionden/e2e smoke  # plus the public site
UPDATE_ROUTES=1 pnpm --filter @revisionden/api test   # refresh apps/api/routes.json after a route change
```

**Mocks mirror the real API.** `apps/api/routes.json` lists every real route (generated from the
Hono app; its test fails when it is out of date). Web tests fail if an MSW handler, shared or set
by one test, names a route that is not in it (`apps/web/src/test/apiRoutes.ts`), except the few in
`PENDING_ROUTES` that another workstream has agreed but not built.

**Deployed smoke test** (`e2e/smoke`, `pnpm --filter @revisionden/e2e smoke`): health ok, Google
offered, Google sign-in starts with the right callback (stops before Google), the parent family
route exists and refuses a signed-out request with a reference code, policy pages, the Google
button, the signed-out `/family` prompt, and that `/`, `/family`, `/legal`, a policy and `/about`
request nothing from third parties (only the web origin and its API host; it caught Cloudflare's
injected Web Analytics beacon on staging, 2026-11-25). The local suite checks the same for the
built app. It signs nobody in: there is no test backdoor. With `E2E_WWW_URL` set it also checks the
public site (`apps/www`) requests nothing from other origins and sends its content security policy;
`apps/www`'s own tests check every built page for third-party resources and broken links.
Still checked by a person after each staging deploy: signing in with Google and landing on
"Who's revising?", adding a child, linking a device with the QR code and passkey, and the
student using the app on that device.

End-to-end tests (`e2e/tests`) run at phone (390×844), tablet (820×1180) and desktop (1280×800)
in Chromium, fail on any axe WCAG 2.2 A/AA violation or sideways scrolling, and always run with
`--trace off` (turn traces on only to debug one test). Without `E2E_BASE_URL` they serve the built
app with `vite preview`. CI: `.github/workflows/e2e.yml` runs the whole suite (every project) on
pull requests into `dev`, `staging` and `main` (G10). It builds the web app once (job `build`,
artifact `web-dist`), runs four shards in parallel against that build (about 6 minutes in all), and
reports one check, **End-to-end result**, that is green only when every shard passed: that is the
check to require in branch protection. Another check that needs the built app can add a job to
`e2e.yml` with `needs: build` and download `web-dist` rather than building again. The contrast
sweep does this (W21, section 7): its tier 1 tests are tagged `@contrast`, the shards skip them
(`--grep-invert @contrast`), the `contrast` job runs them once, and **End-to-end result** needs it
too. Tier 2 (`@contrast-painted`) has its own workflow, `contrast-painted.yml`.
Every axe check goes through `axeWhenSettled(page)` (`e2e/tests/support/axe.ts`): it waits for
finite animations to finish first, because axe measures colours as drawn and a button still fading
in reads as low contrast. The rules stay WCAG 2.2 A/AA (or what the check passes in `configure`).
Passkey tests use Chromium's virtual authenticator (CDP `WebAuthn.addVirtualAuthenticator`):
one holding a generated passkey for the page's host checks the real unlock prompt, and an empty
one checks the "Ask a parent to link this device" message. The API is stubbed with `page.route`.
The whole-session smoke test (`e2e/tests/pupil-session.spec.ts`, phone only) walks one pupil
through unlock (virtual authenticator), Home, the map, a lesson, a right answer, the prize box
and back Home with Pip, running `axeWhenSettled` on every screen. It catches the pieces breaking
each other, which the per-screen specs cannot. It also runs at 320 x 640 with normal text and
with text at 200% (W15): there each screen must not scroll sideways, and "You are here" must sit
clear of the bottom nav and open the lesson when tapped. With 200% text the map starts below the
fold, so the walk scrolls down to it first (lead ruling, 2026-11-26: vertical scrolling is fine at
that size; auto-scrolling past the unit header would hide context).
The parent-session smoke test (`e2e/tests/parent-session.spec.ts`, phone only, W16) walks a new
parent through sign-in, the terms, adding a child, linking the child's device with the QR code,
the family screen, Parent home and the stats dashboard, with `axeWhenSettled` on every screen.
Sign-in is stubbed inside the spec only: the stubbed `POST api/auth/sign-in/social` answers with
the app's own callback URL, so no provider is ever called, and the test fails if any request leaves
the test server. There is no test backdoor or flag in the app.

## 6. End-to-end coverage map

Which user journeys the Playwright suite (`e2e/tests`) walks end to end, and the gaps worth
filling next. Screen-level specs (one page, its layout and axe) sit under the journey they belong
to. Updated by W, 2026-11-26 (W17).

### Covered

| Journey                                                                          | Spec(s)                                                       | Sizes                          |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------ |
| Pupil: unlock → Home → map → lesson → prize → Home                               | `pupil-session`                                               | phone; 320px; 320px/200% text  |
| Parent: sign in → terms → add child → link device → family → Parent home → stats | `parent-session`                                              | phone                          |
| Child sets up a passkey from a parent's link                                     | `link-passkey`                                                | all                            |
| Unlock with a passkey; no passkey on the device                                  | `pages` (unlock, ask a parent)                                | all                            |
| Lesson: answer, clue, help step by step, Learn more                              | `lesson`, `help.lesson`, `learn-more`, `area-model`, `powers` | phone (mostly)                 |
| Rewards: prize box, Escape, reduced motion                                       | `prize-box`                                                   | all; 320px/200%                |
| Map: units, swipe, Subject selection, node contrast                              | `map`                                                         | phone                          |
| Home and Pip (fits one screen, Leave this lesson?)                               | `home`                                                        | phone                          |
| Me: edit avatar (touch and keyboard), Cancel                                     | `me-page`                                                     | all                            |
| 5-a-day: Home → every item → Lesson complete → Home shows it done                | `daily-and-cards`                                             | phone                          |
| Flashcards: a whole session, Again, Done for today, 10 more, Deck done           | `daily-and-cards`, `cards`                                    | phone; all (`cards`)           |
| Starting test: answer, skip, finish, result; 1-minute warning, time up           | `starting-test`                                               | phone                          |
| Parent settings → child: subjects (map), friends (league), reminders saved       | `parent-settings`, `map`                                      | phone                          |
| Friends league: add a friend with a code                                         | `league`                                                      | phone                          |
| Get help (student and parent): Quick exit, filters                               | `help`                                                        | all                            |
| Looks: every style, light and dark, contrast                                     | `looks`, `tiles`                                              | phone (`looks`); all (`tiles`) |
| Public pages: welcome, policies, About, footer                                   | `pages`, `about-narrow`                                       | all; 320px/200% (phone)        |

### Gaps to fill next (suggested, in order)

1. **Second parent**: invite → `/join` → both parents listed, and the removal notice.
2. **Plan, Papers and Progress as journeys**: `/plan` and `/papers` are only checked for the
   bottom nav at 320px/200% (`help`), and `/progress` for layout (`pages`).
3. **Feedback and complaints**: send feedback from a pupil and read it in `/feedback/family`;
   the complaints page.
4. **Sign out and session expiry**: parent sign-out, and a pupil's 12-hour session ending
   mid-lesson (back to unlock with `returnTo`).
5. **The parent journey at 320px with 200% text**, as the pupil journey already is (W15).

These are suggestions only: none is started until the lead or owner says so. Gaps 1 to 3 of the
W17 list are done: the 5-a-day and a whole flashcard session (W18), the starting test (W19),
and parent settings reaching the child (W20; reminders reach a child only as notifications, so
only the parent's side is checked).

## 7. Contrast sweep

`e2e/tests/contrast-sweep.spec.ts` checks every screen in `apps/web/src/routes.tsx` and the main
dialogs in all 10 looks, light and dark, with reading tints off (decision 0012). The phone runs
every look; the desktop runs the default look. Data comes from the web app's own mock handlers
(`e2e/tests/support/seed.ts` answers each call with `apps/web/src/features/*/mocks.ts`).

- **Route guard:** a route in `routes.tsx` or `LESSON_PATHS` with no row in the sweep's table
  fails the first test. Add a row (or a skip with a reason, such as a redirect).
- **Tier 1, every pull request** (the `contrast` job in `.github/workflows/e2e.yml`, about a minute): computed
  styles only. Text 4.5:1 (3:1 when large) against the nearest opaque background, and buttons,
  inputs, switches and tabs 3:1 by fill or border. Text over page art, gradients or shadows is
  left to tier 2. Helper: `e2e/tests/support/contrastStyles.ts`.
- **Tier 2, painted** (`CONTRAST_SWEEP=1`; `.github/workflows/contrast-painted.yml`): text in
  every box (down the whole page, a screen at a time), UI parts' edges and the first three focus
  rings, measured on screenshots in two
  passes (a finding counts only when both passes see it, so a ring caught mid-animation cannot
  flake the run). Text too faint to sample is a failure, not a skip (decision 0012). Nightly,
  on demand, on pull requests that touch looks or design CSS, and before staging. Helpers:
  `paintedTextFailures`, `paintedUiFailures` and `focusRingFailures` in
  `e2e/tests/support/painted.ts`.
- **Steady screens:** anything that changes with every build is held to made-up values, so a
  row's place and key never move with the changelog: `/about` keeps three made-up What's new lines
  and three licences, and the version footer shows a made-up commit (W21c).
- **Known failures:** `e2e/tests/contrast-known.json`. A test fails on anything new and on a
  listed failure that is now fixed, so a fix removes its lines in the same change. To refresh the
  list after a fix: run the sweep with `CONTRAST_UPDATE=1` (add `CONTRAST_SWEEP=1` for tier 2),
  then `node e2e/scripts/contrast-known.mjs`.

```bash
pnpm --filter @revisionden/e2e exec playwright test tests/contrast-sweep.spec.ts --project=phone --project=desktop --grep @contrast --grep-invert @contrast-painted
CONTRAST_SWEEP=1 pnpm --filter @revisionden/e2e exec playwright test tests/contrast-sweep.spec.ts --project=phone --project=desktop --grep @contrast-painted
```
