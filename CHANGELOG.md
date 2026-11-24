# Changelog

All notable changes are recorded here. Versions use the format `xx.xx.xxx` (major.minor.patch).
Every push to `main` bumps the version automatically; add entries under **Unreleased** in each PR.

## [Unreleased]

### What's new

- Coming soon: a stats page for students and a stats dashboard for parents.
- Coming soon: rewards you set yourself as a parent, like a cinema trip for a 30-day streak.
- Sound effects: soft, original sounds for right and wrong answers, finishing a lesson, meeting your daily goal, flashcards and the starting test. Mute them from the speaker button at the top, or change the volume and tap sounds in Settings.

### Fixed

- GCSE Statistics offers only AQA and Pearson Edexcel in onboarding (checked on the board websites).
- Verification protocol now covers extended answers (blind marking of exemplars plus individual human approval).

### Added

- Sound effects (U1–U3): Web Audio sound bank (one synthesised sound per event, no audio files), `SoundProvider` and `useSound().play()`, header quick mute, Settings Sound section (on/off, volume, tap sounds; saved per device), iOS ambient audio session, nothing before the first tap or in the background, Test mode rule; wired into lessons, starting test and flashcards.
- Five-year rewards progression (R): level curve 1 to 100 with prestige stars, a 369-reward catalogue as data (levels, year chapters, milestone ladders, collections, 2026/27 seasonal drops) with a validator, healthy-limit rules (no late-night or time-based rewards, daily cap), student `/rewards` screen, and parent-set real-world rewards (`/family/:id/rewards`, `parent_rewards` table, migration 0004).
- New original avatar art: five chapter finale tops, rooftop scene, and the Frost Fest drop (bobble hat, paper lantern, frosty night scene).
- Verification: blind marking for extended answers: three exemplars (top, middle, low) marked by a second provider without the intended levels must all match; verified extended answers need `blind-marking` and individual human approval, and review batches always include them.
- Verification: the quote checker reports near matches (letters only, or words with small insertions or reordering, with a confidence) for a reviewer to confirm instead of passing them.
- Statistics dashboards (K): student "My stats" on the Progress tab (week, term and year; XP chart
  with goal line, tooltip and table view; mastery by subject; personal bests; kind framing), the
  parent stats dashboard at `/parent/stats` (study time, plan kept, accuracy, streak, 8-week chart,
  subjects, weak spots, healthy habits, AI spend, recent activity, Save as PDF in the browser),
  "What your parent can see" in Settings, and `GET /v1/student/stats`, `GET /v1/students/:id/stats`
  and `GET /v1/students/:id/dashboard`.
- Five-year rewards progression design (`docs/REWARDS.md`) and backlog workstream R.
- Policies index and rules (`docs/LEGAL.md`), About page, feedback and sound effects specs, backlog workstreams L and U.
- Statistics dashboards spec for student and parent (`docs/PRODUCT_RULES.md`) and backlog workstream K; parent-set rewards detail (`docs/REWARDS.md`).

- Content: official citations with verbatim quotes, pages and SHA-256 for all 110 pilot GCSE Maths entries (1MA1 Issue 2 and DfE subject content); quadratic formula flashcard fixed; sourcing record in `docs/sourcing/` (S).
- Onboarding (E1, E2): parents add each child with a nickname, avatar, school year (9 to 13), subjects, and an exam board and tier per subject ("Not sure" counted to check later); exams worked out from the year; school report step; finish screen with each child's starting test (`/onboarding`).
- Avatar builder (E3): layered SVG avatar with Face, Hair, Top, Eyewear, Headwear, Holding and Background tabs, Shuffle, and locked items that show their reward; avatar catalogue matches the approved design.
- Device linking screens (E4): one-time QR code (10 minutes, single use) with "Do this later", and the student `/link` page that sets up a passkey.
- API: `POST /v1/onboarding/children`, `GET /v1/onboarding/family`, `GET` and `PUT /v1/students/:id/avatar` (locked items need their reward).
- Learning loop (F): starting test per subject, lesson player for every item type with instant feedback, XP, daily goal and streak, flashcards with SM-2 (due, decks, own cards, wrong answers become cards), command-word lessons, and a content gate that serves only verified items unless `SERVE_DRAFT_CONTENT=true` in development (with a "DRAFT CONTENT" banner).
- Verification: quote checker that fetches official sources (cached outside git), confirms each quote at its page or specification code and records the source SHA-256 (V1).
- Verification: blind-answer and adversarial-review runners over one provider interface (Anthropic, OpenAI, Gemini), tested with recorded fixtures (V2).
- Verification: exact checkers for units, chemical equation balancing and equation-sheet lookups, with an optional `exact` block on items (V3).
- Review queue API and screens: batch sampling (10%, at least 30, one confirmed error fails the batch), decisions recorded by role (V4).
- Report a problem: the item is hidden at once; confirmed errors queue score recalculation and re-checks of the item, batch, writer prompt and source (V5).
- `pnpm content:audit <id | topic | subject>`: markdown audit report with citations, checks, reviewer role, version history and reports (V6).
- Double AI marking rules in `packages/core` and an essay golden-set eval harness in `evals/` with the `docs/AI.md` pass bars (V7).
- Verification protocol (`docs/VERIFICATION.md`): official citations on every item, multi-step checks, human approval, quarantine and audit reports; new workstream V and task D6.

- Web: design tokens from the mockups (Nunito, violet, 3D edges) with a 4.5:1 contrast check (A1).
- Web: core components: Button, Pill, ProgressBar, Card, BottomNav, Toast, Sheet, Avatar and Pip the fox (A2).
- Web: routes for every Stage 1 screen, a friendly 404, bottom nav on phones and a side nav on tablets and desktops (A3).
- Web: typed API client that checks every response, with retry UI and an MSW mock API for development and tests (A4).
- Web: installable PWA with icons, an offline app shell, an offline banner and Add to Home Screen help for iPad (A5).
- Web: welcome, family, learning path, lesson and lesson complete screens wired to mock data (A6).
- Web: topic map replaces the learning path: hexagons per topic by unit, a Next mission card, the Map tab and a due-cards badge on Cards (A7).
- Shared Zod schemas for students, enrolments, items, attempts, plans and API errors, with
  readable error messages (`packages/core`).
- Nickname rules with a block list, and avatar codes with 14 layers and reward-locked items.
- Flashcard scheduler (SM-2 style) and topic mastery with time decay.
- Next-item selection: weak spots first, parent focus weights, due flashcards, variety rule.
- XP, daily goal, streaks, skip days and gift days; rewards catalogue with 14 unlock targets.
- Database schema and first migration (`packages/db`), with a privacy guard test that fails if a
  column could hold a student's real name, birth date, email, photo or school name; made-up
  seed data.
- API Worker config for dev, staging and production; environment checked on start-up; `/health`
  reports the version.
- Parent sign-in with Google or Microsoft (Better Auth); only the sign-in email is kept.
- Family created on first sign-in; student profiles and enrolments, each family isolated.
- Student device linking: one-time 10-minute QR code, then a passkey; unlock with the passkey.
- Rate limits on sign-in, device and AI routes; every error uses the shared JSON shape.
- Content JSON Schemas for subjects, topic trees, items and mark schemes (`content/schemas/`).
- `pnpm content:validate`: checks schemas, unique ids, topic links and every maths answer with
  the maths engine; runs in CI.
- GCSE Maths Higher pilot topic tree (Pearson Edexcel 1MA1) with sample items.
- Maths engine `POST /check-working`: finds the first wrong line of working and checks the final
  answer; safer input parsing; 90% coverage gate; container smoke test in CI.
- Content citations and verification records on every item, topic leaf, mark scheme and diagram,
  enforced by the validator (quotes, required checks, immutable verified versions, no PDFs or
  raster images); code-drawn SVG diagram schema; `pnpm content:validate --audit <id>` audit trail (a fuller `pnpm content:audit` is workstream V).
- Reminders (H1): web push per device with VAPID, a Settings card to turn them on, parent
  settings for quiet hours (21:00–07:30 and weekday school hours by default), at most 2 a day,
  and a 15-minute cron trigger. Pushes carry no text.
- AI gateway (H2): Claude via the Anthropic SDK through Cloudflare AI Gateway, OpenAI as an
  optional second checker, retries with backoff, Zod-checked JSON replies, a per-child monthly
  spend cap (US$2.50 by default) and a guard that refuses any request with personal data.
- Short-answer marking (H3): rules against the mark scheme first, Claude Haiku 5.5 only for
  wording variants, citing each mark point; unsure answers say "Check with your teacher".

### Changed

- Item type names are the content schema names everywhere (`worked_maths`, `extended_answer`); the mapping in core is removed.
- One item JSON format in the `items` table for the content sync and AI marking (`body.marks` added; marking reads `answer.key` and `answer.markScheme`), with a round-trip test.

## [00.01.002] - 2026-11-24

## [00.01.001] - 2026-11-24

### Added

- Five-year rewards progression design (`docs/REWARDS.md`) and backlog workstream R.

- Project memory (`project_memory/`) in the AtlasMind layout as the single source of truth, with the AtlasMind SSOT rule in `CLAUDE.md` and `AGENTS.md`; decision records moved to `project_memory/decisions/`.

- Monorepo skeleton: web app, API, core domain logic, maths engine.
- CI on every pull request; automatic version bump and tag on every push to `main`.
- Project overview moved to `docs/OVERVIEW.md` (no README while the repository is public).
- Project plan, delivery backlog, content plan, AI plan and environment set-up in `docs/`.
- Feedback-level rules tied to grade boundaries (`packages/core`).
- Maths equivalence checking with SymPy (`services/maths`).
