# Delivery backlog

> Live document. The detailed, ordered task list for every workstream. Each task lists the tests
> that must be written first (red) and pass (green). Sessions tick tasks off in their PRs.
> Overview and stages: [`PLAN.md`](PLAN.md). Who is on what: [`WORKSTREAMS.md`](WORKSTREAMS.md).

## Definition of ready (before a task starts)

- The task has acceptance tests written as Given / When / Then below.
- Its dependencies are merged into `dev`.
- It touches only paths the workstream owns.

## Definition of done (before a PR is merged into `dev`)

- Tests were written first and seen failing; all tests pass; coverage gates met.
- Lint, typecheck and format pass in CI.
- Docs updated: the affected live docs, `CHANGELOG.md` (Unreleased), this backlog's checkbox and
  the workstream row.
- No personal data or secrets in the diff.
- Accessible: keyboard reachable, labelled, 44px targets, 4.5:1 contrast (UI tasks).
- Works at phone (390px), tablet (820px) and desktop (1280px) widths (UI tasks).

---

## Wave 1 (Stage 1 foundations, in parallel)

### A. Web foundations and design system (`apps/web`)

- [x] **A1 Design tokens.** Colours, type (Nunito), spacing, radii, shadows from the mockups as CSS
      variables; light theme first.
  - Test: token file exports every named token; contrast check script passes 4.5:1 for text pairs.
- [x] **A2 Core components.** `Button` (primary, secondary, danger, 3D press), `Pill`, `ProgressBar`,
      `Card`, `BottomNav`, `Toast`, `Sheet`, `Avatar` (renders from avatar code, placeholder until E).
  - Tests: renders label; disabled state not clickable; `ProgressBar` exposes `role=progressbar`
    with correct values; `Toast` announces via `role=status`.
- [x] **A3 Routing and layout.** Routes for welcome, family, path, lesson, lesson complete,
      progress, plan, settings; phone layout with bottom nav, tablet and desktop with side nav.
  - Tests: each route renders its heading; unknown route shows a friendly 404.
- [x] **A4 API client and mocks.** Typed client using Zod schemas from `packages/core`; MSW
      handlers for development and tests.
  - Tests: client rejects responses that fail the schema; network error shows retry UI.
- [x] **A5 PWA.** Manifest (name, icons, theme colour), service worker caching the app shell,
      offline banner, "Add to Home Screen" help screen for iPad.
  - Tests: manifest valid; offline banner shows when `navigator.onLine` is false.
- [x] **A6 Screen shells.** Welcome and sign-in, learning path, lesson question, lesson complete,
      matching the mockups, wired to MSW data.
  - Tests: path shows locked, done, current and weak-spot nodes; lesson shows answer feedback.

### B. API, database and sign-in (`apps/api`, `packages/db`)

- [x] **B1 Database schema.** Drizzle tables from `ARCHITECTURE.md`; first migration; seed script
      with made-up data.
  - Tests (PGlite): migration applies cleanly; foreign keys enforced; no column named for real
    names, birth dates or student emails (schema guard test).
- [x] **B2 Worker setup.** Wrangler config for dev, staging, production; bindings for Neon
      (Hyperdrive or serverless driver), R2, AI Gateway; `/health` reports version.
  - Tests: health returns version; env validation fails fast on missing bindings.
- [x] **B3 Parent sign-in.** Better Auth with Google and Microsoft; sessions in Postgres; sign-out.
  - Tests: protected routes reject anonymous requests (401); session cookie is HttpOnly,
    Secure, SameSite=Lax.
- [x] **B4 Family and students.** Create family on first sign-in; CRUD for student profiles
      (nickname, avatar code, year group); enrolments (subject, board, tier, "not sure").
  - Tests: nickname validation (from core); a parent cannot see another family's students.
- [x] **B5 Device linking.** Parent creates a one-time token (10 minutes, single use) shown as QR;
      student device redeems it and registers a passkey; later unlock with passkey.
  - Tests: token expires; token cannot be reused; wrong family cannot redeem.
- [x] **B6 Rate limits and errors.** Consistent JSON errors; rate limit on auth and AI routes.
  - Tests: error shape matches schema; 429 after limit.

### C. Core domain rules and shared schemas (`packages/core`)

- [x] **C0 Feedback levels** (done in skeleton).
- [x] **C1 Schemas.** Zod schemas for every API request and response defined so far (students,
      enrolments, items, attempts, plans).
  - Tests: valid samples parse; invalid samples give readable errors.
- [x] **C2 Nickname and avatar code.** Nickname rules (2 to 16 letters, numbers, underscore; block
      list); avatar code encode, decode and validate against the item catalogue, including locked
      items.
  - Tests: round-trip encode/decode; locked item rejected unless earned.
- [x] **C3 Spaced repetition.** Card scheduler (SM-2 style intervals); wrong answers return sooner.
  - Tests: interval grows on success; resets on failure; due cards ordered by urgency.
- [x] **C4 Mastery.** Topic mastery 0 to 100 from recent attempts with decay over time.
  - Tests: correct answers raise mastery; old attempts weigh less; never outside 0 to 100.
- [x] **C5 Next-item selection.** Weak spots first, parent focus weights (light +10, medium +22,
      strong +38 points), due flashcards, variety rule (no more than 3 in a row from one topic).
  - Tests: weakest topic chosen most often (seeded randomness); focus subject share rises by the
    expected amount; variety rule holds.
- [x] **C6 XP, goals and streaks.** XP per answer type; daily goal; streak days; skip days (earned
      by weekly goal, max 2 in a row); gift days (only given away; +20 XP for gifting).
  - Tests: streak breaks without goal or skip day; third skip in a row refused; gift day cannot be
    applied to own streak.
- [x] **C7 Rewards catalogue.** Reward definitions with unlock targets; evaluator that returns newly
      earned rewards from stats.
  - Tests: each target type (streak, grade, practice, friendship, competition) unlocks correctly.

### D. Content format and maths engine (`content`, `services/maths`, `scripts/content`)

- [x] **D1 Schemas.** JSON Schemas for subjects, topic trees (spec references), items (multiple
      choice, short answer, numeric, worked maths, flashcard, extended answer), mark schemes.
  - Tests: sample files validate; missing source reference fails.
- [x] **D2 Validator.** `pnpm content:validate` checks schemas, unique IDs, topic links, and sends
      every maths answer to the engine.
  - Tests: duplicate ID fails; wrong maths answer fails; orphan topic fails.
- [x] **D3 Pilot topic tree.** GCSE Maths Higher topic tree from the official specification (one
      board), with specification references.
  - Tests: every leaf topic has a spec reference; tree depth at most 3.
- [x] **D4 Working-lines checker.** Engine endpoint takes ordered lines of working and returns the
      first line that is not equivalent to the previous, plus final-answer correctness.
  - Tests: correct chain passes; sign slip detected on the right line; unsafe input rejected.
- [x] **D5 Container.** Dockerfile builds; container answers `/health`; ready for Cloud Run.
  - Tests: container smoke test in CI.
- [x] **D6 Citations and verification records.** Required `citations` (min 1) and `verification`
      record on every item, topic leaf, mark scheme and diagram, per `VERIFICATION.md`.
  - Tests: missing citation, quote, location or URL fails; verified item without required checks
    fails; `other_authoritative`-only item without `needs_human_approval` fails.

---

## Wave 2 (after Wave 1 is merged)

### E. Family onboarding and avatar builder (`apps/web/src/features/onboarding`, `.../avatar`)

- [x] E1 Onboarding flow from screen 15 of the mockups, against the real API.
- [x] E2 Board and tier picker per subject, with "not sure" reminders.
- [x] E3 Avatar builder from screen 16 (layers, shuffle, locked items, short code).
- [x] E4 QR device linking screens (parent shows code; student scans; passkey set-up).
- Tests: Playwright journey "parent adds two students and links a device"; component tests per step.

### F. Learning loop (`apps/web/src/features/learn`, `apps/api` learn routes)

- [ ] F1 Starting test per subject (about 5 minutes) sets initial mastery.
- [ ] F2 Learning path from mastery; lesson player for each item type; instant feedback.
- [ ] F3 Flashcards with spaced repetition.
- [ ] F4 XP, daily goal and streak shown and updated.
- [ ] F5 Exam technique basics: command word lessons.
- Tests: API integration for attempt recording; Playwright "complete a lesson and see XP".

### G. Deploy pipelines and end-to-end (`.github/workflows/deploy-*.yml`, `e2e/`)

- [ ] G1 Deploy web and API to Cloudflare per branch (dev, staging, production).
- [ ] G2 Neon branch per environment; migrations run on deploy.
- [ ] G3 Maths engine to Cloud Run per environment.
- [ ] G4 Playwright suite at three viewports with axe accessibility checks on PRs into staging and main.
- [ ] G5 Version shown in the app footer and `/health`.

### H. Reminders and AI gateway (`apps/api` notifications and AI)

- [ ] H1 Web push subscription and scheduled reminders with quiet hours.
- [ ] H2 AI gateway client with provider routing, retries and per-child monthly cap.
- [ ] H3 Short-answer marking via the small model with recorded-fixture tests.

---

### V. Verification pipeline and audit (`scripts/verify/`, `apps/api` review routes, `evals/`)

- [ ] V1 Quote checker: fetches the cited source (or private archive copy) and confirms the quote at the stated location.
- [ ] V2 Blind-answer and adversarial review runners using two different providers; results written to the verification record.
- [ ] V3 Exact checkers: units, chemical equation balancing, equation-sheet lookups (maths via the engine).
- [ ] V4 Human review queue (admin screen) with batch sampling rule and approval recording (role, not name).
- [ ] V5 Quarantine on report; recalculation of affected scores; batch re-check trigger.
- [ ] V6 `pnpm content:audit` report and parent-portal PDF export.
- [ ] V7 Double AI marking with criterion citations and disagreement flagging; golden-set evals with the pass bars in `AI.md`.
- Tests: each checker red/green with known-good and known-bad fixtures; audit report snapshot test.

## Stage 2 and later

Broken down into tasks when Stage 1 ships, following the same format. Headline order:

1. Mastery dashboard and predicted grade.
2. Exams, mocks and assessments entry; study plan generator and calendar (editable by both):
   drag sessions between days; detail panel to edit a session; custom rules created from edits,
   toggled and removed, applied by the generator, with conflict warnings (mockup screen 5).
3. School report setup and upload reading (delete after confirm).
4. Parent portal: weekly summary and focus nudges.
5. Feedback levels in the lesson player; Learn and Test modes.
6. Wellbeing guards.
7. Stage 3: past papers, maths working, essays and Mark my homework, access arrangements,
   A-Level extras.
8. Stage 4: rewards UI, friends league, skip and gift days UI, mascot kits, interactive lessons.
