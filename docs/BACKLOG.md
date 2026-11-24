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
- [x] **A7 Topic map.** The learning path becomes a honeycomb of hexagons, one per topic, grouped
      by unit: mastered (gold, tick), in progress (violet, mastery fill level and %), weak spot
      (orange, wrench, pulsing glow), locked (grey, lock) and a unit challenge (dark, crown,
      unlocks at 80%). Next mission card above the map; unit headers with % mastered; Learn tab
      renamed Map; Cards tab shows the due count.
  - Tests: each hex state and its accessible name; locked items explain how to unlock; mission
    card links to its lesson; Cards badge shows the due count.

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

- [x] F1 Starting test per subject (about 5 minutes) sets initial mastery.
- [ ] F2 Learning path from mastery; lesson player for each item type; instant feedback.
      Lesson player, instant feedback and a subject page with mastery are done; the learning path
      map (workstream A's screen) still reads mock data and links to the old mock lessons.
- [x] F3 Flashcards with spaced repetition.
- [x] F4 XP, daily goal and streak shown and updated.
- [ ] F5 Exam technique basics: command word lessons. The lesson screen and API are done
      (items tagged `command-word`); verified command-word items are still to be written through
      the content pipeline.
- [ ] F3 Flashcards with spaced repetition. Design: mockup screen 18 (card flips in 3D from
      question to answer; Again, Hard, Good and Easy buttons showing the next review time; Due
      today, All decks and My cards tabs; deck-done summary with XP). The Cards tab and its due
      badge already exist (A7); the page itself is a placeholder.
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

- [x] H1 Web push subscription and scheduled reminders with quiet hours.
- [x] H2 AI gateway client with provider routing, retries and per-child monthly cap.
- [x] H3 Short-answer marking via the small model with fixture tests (no live provider calls).

---

### V. Verification pipeline and audit (`scripts/verify/`, `apps/api` review routes, `evals/`)

- [x] V1 Quote checker: fetches the cited source (or private archive copy) and confirms the quote at the stated location.
- [x] V2 Blind-answer and adversarial review runners using two different providers; results written to the verification record.
- [x] V3 Exact checkers: units, chemical equation balancing, equation-sheet lookups (maths via the engine).
- [x] V4 Human review queue (admin screen) with batch sampling rule and approval recording (role, not name).
- [x] V5 Quarantine on report; recalculation of affected scores; batch re-check trigger.
- [ ] V6 `pnpm content:audit` report (done) and parent-portal PDF export (to do).
- [x] V7 Double AI marking with criterion citations and disagreement flagging; golden-set evals with the pass bars in `AI.md`.
- Tests: each checker red/green with known-good and known-bad fixtures; audit report snapshot test.

### R. Five-year rewards progression (`packages/core`, catalogue data, avatar layers)

- [x] R1 Level curve (1 to 100 plus prestige) from XP, tuned so daily practice reaches about level 20 a year.
- [x] R2 Catalogue as data with rarity, source (level, chapter, milestone, collection, season) and unlock target; validator for unique ids and reachable targets.
- [x] R3 Year chapters (Years 9 to 13) and milestone ladders from `REWARDS.md`, with carry-over from GCSE to A-Level and mid-way joiners.
- [x] R4 Collections and set bonuses; seasonal drops with term windows and later re-release.
- [x] R5 Parent-set real-world rewards tied to any target, marked as given by the parent.
- [x] R6 First seasonal drop and chapter 2 (Year 10) item art as original SVG layers.
- Tests: curve properties (monotonic, reachable), each target type unlocks once, no reward for late-night study or time spent, catalogue validator fixtures.

### K. Statistics dashboards (`packages/core/src/stats.ts`, `apps/api/src/stats/**`, `apps/web/src/features/stats/**`)

Spec: `PRODUCT_RULES.md`, statistics dashboards. Mockups 19 and 20.

- [ ] K1 Pure stats functions in core: periods (week, term, year in the family time zone), XP and questions per bucket, accuracy, active study time (5-minute gap rule, daily cap), personal bests, subject mastery average and change, weak-spot trend.
- [ ] K2 API: `GET /students/:id/stats?period=` (student or own parent only) and `GET /parent/students/:id/dashboard` (parent only), with shared Zod schemas.
- [ ] K3 Student "My stats" screen from the Progress tab: period toggle, tiles, XP bar chart with goal line, tooltip and table view, mastery by subject, personal bests, level bar.
- [ ] K4 Parent dashboard: student switcher, tiles, 8-week study time chart with plan line, subjects table, weak spots, effort scores, reward progress, healthy habits, AI spend, recent activity.
- [ ] K5 Save as PDF in the browser (nicknames only); "Not set up yet" states for missing panels; student Settings line showing what the parent can see.
- [ ] K6 Accessibility: table view for every chart, keyboard focus on bars, reduced motion.
- Tests: each number rule red/green with fixed clocks (gap rule, cap, part marks, unmarked answers left out, week boundaries in UK time, term and year buckets); access control (a parent cannot read another family's child); empty states; component tests for toggles, tooltips and table views.

### L. Policies, About page and feedback (`docs/legal/**`, `apps/web/src/features/legal/**`, `apps/web/src/features/about/**`, `apps/web/src/features/feedback/**`, feedback API routes and table)

Spec: `docs/LEGAL.md` and `PRODUCT_RULES.md` (About page, policies and feedback). Mockup 21.

- [x] L1 Write every policy in `docs/LEGAL.md` (plain English first, then full text), checked statement by statement against the code and docs; list every mismatch found.
- [x] L2 Policy pages at `/legal/<name>` built from the same Markdown, with placeholders filled from build variables; reachable signed out; print style.
- [x] L3 About page: version, environment, build date, commit, "What's new" from `CHANGELOG.md`, policy links, open-source licences.
- [x] L4 Feedback: form, privacy checks, device details toggle, parent view, operator triage at `/admin/feedback`, status updates, rate limit, retention.
- [x] L5 Policy acceptance in onboarding (version stored) and the "policy changed" prompt.
- Tests: placeholder filling and the missing-value message; What's new parsing (versions without the subsection hidden); feedback refuses emails, phone numbers and nicknames; a parent sees only their family's feedback; only the operator role reaches triage; rate limit; acceptance version stored.

### U. Sound effects (`apps/web/src/features/sound/**`)

Spec: `PRODUCT_RULES.md` (Sound effects).

- [x] U1 Sound bank synthesised with Web Audio (one function per event), `SoundProvider` and `useSound().play(event)`.
- [x] U2 Settings: header quick mute, Settings section (on/off, volume, tap sounds), saved per device; iOS ambient audio session; no sound before first tap or in the background.
- [ ] U3 Wire `play()` into lessons, flashcards, streaks, rewards, plan and celebrations (one-line calls, listed in the PR), with the Test mode rule. Done: lessons (correct, wrong, part marks, daily goal met, celebration), starting test (submit, reveal, one-minute timer warning), flashcards (flip, rating). Still to wire when those screens exist: level up, reward unlocked, gifts, plan session dropped, timed papers (`mode: 'timed'`).
- Tests: mute and volume respected; tap sounds off by default; Test mode plays no correct/wrong before submit; nothing plays before first interaction; a fake AudioContext records calls.

## Stage 2 and later

Broken down into tasks when Stage 1 ships, following the same format. Headline order:

1. Predicted grade (the stats dashboards are workstream K).
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
