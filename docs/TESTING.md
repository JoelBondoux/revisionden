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
`e2e.yml` with `needs: build` and download `web-dist` rather than building again.
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
| Friends league: add a friend with a code                                         | `league`                                                      | phone                          |
| Get help (student and parent): Quick exit, filters                               | `help`                                                        | all                            |
| Looks: every style, light and dark, contrast                                     | `looks`, `tiles`                                              | phone (`looks`); all (`tiles`) |
| Public pages: welcome, policies, About, footer                                   | `pages`, `about-narrow`                                       | all; 320px/200% (phone)        |

### Gaps to fill next (suggested, in order)

1. **Parent settings that change what a pupil sees**: Subjects (board and tier), Reminders and
   Friends on `/parent/subjects|reminders|friends/:studentId`, then the pupil's side reflecting
   the change. Today only the bug-button layout is checked there.
2. **Second parent**: invite → `/join` → both parents listed, and the removal notice.
3. **Plan, Papers and Progress as journeys**: `/plan` and `/papers` are only checked for the
   bottom nav at 320px/200% (`help`), and `/progress` for layout (`pages`).
4. **Feedback and complaints**: send feedback from a pupil and read it in `/feedback/family`;
   the complaints page.
5. **Sign out and session expiry**: parent sign-out, and a pupil's 12-hour session ending
   mid-lesson (back to unlock with `returnTo`).
6. **The parent journey at 320px with 200% text**, as the pupil journey already is (W15).

These are suggestions only: none is started until the lead or owner says so. Gaps 1 and 2 of the
W17 list are done: the 5-a-day and a whole flashcard session (W18), and the starting test
(W19).
