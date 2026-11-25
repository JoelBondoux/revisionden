# Changelog

All notable changes are recorded here. Versions use the format `xx.xx.xxx` (major.minor.patch).
Every push to `main` bumps the version automatically; add entries under **Unreleased** in each PR.

## [Unreleased]

### What's new

- When something goes wrong, tap "Send error report" to tell us in one tap. It's anonymous: no names, nothing you typed. We'll get on it.
- Coming soon: a daily 5-a-day, quick recall checks, links to free lessons for each topic, read aloud, and a dyslexia-friendly reading mode.
- Coming soon: build your own title from words you unlock, like "Cosmic Scholar".
- Coming soon: a private "Get help" page with UK support services you can call or message.
- Coming soon: a daily study limit you can set as a parent, with gentle suggestions from the app.
- Coming soon: invite a second parent to share control of the family.
- Coming soon: more hidden reward tracks to discover.
- Combo bonus: from your 3rd right answer in a row, each right answer earns 5 extra XP. In the starting test, the bonus is added when you see your results.
- Your topic map now shows your real progress, and tapping a topic or the next mission starts a lesson.
- Coming soon: a bug button on every screen. Find a real bug and earn bonus XP and secret Bug Hunter rewards.
- Coming soon: secret achievements you only discover when you earn them.
- Coming later: timed exam practice. Sit a full paper against the clock, then see your marks, your likely grade and how to pace yourself better.
- The privacy notice for students is now much easier to read: a short version on six cards, the key points of each part up front, and "Read more" when you want the detail.
- Coming soon: a new game feel for practice, with colour bursts, combos, rising sounds and a big "set complete" celebration.
- Parents get a notification on their phone when a child reaches a reward target you set. Turn on "Reward news" on the new parent home.
- New parent home: one place for the stats dashboard, rewards you set, reminder times, family feedback, settings and policies. Find it from the profile picker or Settings.
- When you're signed out, About, Policies and Feedback show a simple header (Sign in, Policies, About) instead of the student menu.
- Parents can download all their family's data as one file, from the family list.
- Accounts nobody uses for 12 months are now deleted automatically; the parent area shows the date, and warns you if you come back after a long break.
- Your own flashcards can't hold email addresses, phone numbers or family nicknames, to keep personal details out.
- After an update, the app now shows "A new version of RevisionDen is ready" with a Refresh button, so you're never stuck on an old version.
- On "Who's revising?", tapping a child now opens your view of them (their stats), with quick links to the rewards you set and to link their device. Students use the app on their own device.
- Need help? Email help@revisionden.com. You'll find it on the About page and the feedback screen.
- Signing in with Google now really signs you in, and "Who's revising?" shows your children instead of "Something went wrong". New families go straight to adding a child. If you're signed out, any page shows the sign-in buttons and brings you back where you were. You can sign out from the welcome page or "Who's revising?".
- When something does go wrong, the app shows a short code (like RD-7K2M9Q). Send it to us and we can find what happened.
- Reward sounds now grow with the reward: a bright chime for common rewards up to a short fanfare for legendary ones, with lots of variety, a different sound for each school year and special fanfares for finishing GCSEs and A-Levels. Tap to skip a long one, or try them all in Settings.
- RevisionDen is now online for testing at dev.revisionden.com and staging.revisionden.com, with the app version shown at the bottom of every page.
- Flashcards now give 20 XP for finishing a session of at least 5 cards (up to twice a day), not for each card, so there's no point tapping "Good" on everything. Cards you mark "Again" come back before the session ends.
- New stats page for students (XP, accuracy, streak and mastery by week, term or year) and a stats dashboard for parents.
- Parents can set their own rewards, like a cinema trip for a 30-day streak, and mark them as given. Students see them under "From home".
- Sound effects: soft, original sounds for right and wrong answers, finishing a lesson, meeting your daily goal, flashcards and the starting test. Mute them from the speaker button at the top, or change the volume and tap sounds in Settings.
- Read our privacy notice, terms and other policies in plain English, at any time, even signed out.
- New About page shows the app version and what's new.
- Send us a bug, an idea or something confusing from Settings, and see what happens to it.

### Fixed

- Public pages (I): without a linked student on the device, `AppLayout` pages (About, Feedback, Settings and the rest) and the policy pages (now under `AppLayout`) show `PublicHeader` (logo, Sign in, Policies, About) instead of the student nav.
- No third-party requests (I): the deployed smoke test and the local e2e suite fail if a page requests any host other than the web origin and its API host. On staging it finds Cloudflare's zone-injected Web Analytics beacon (`static.cloudflareinsights.com`), which the owner is switching off in the Cloudflare dashboard.
- Policies: the privacy notice and services page (both now 1.1) say parents sign in with Google or Microsoft, whichever this app offers (a deployment may offer only one).
- Google and Microsoft access, refresh and ID tokens are no longer stored after sign-in (B2).
- Year group is limited to Years 9 to 13 in the API, the core schema and the database (B2, migration 0006).
- Students' own flashcards get the same personal-details check as feedback (B2, cleared with F).
- Stale app after a deploy (I): page visits skip the browser cache and refresh the offline copy (service worker v2); builds publish `/version.json` (`version-commit`); `UpdateBanner` checks it on start, on return to the foreground and every 15 minutes and offers Refresh; an unknown-route 404 or a wrong-shape reply from the API triggers a check and one automatic reload per new build (no loops).
- "Who's revising?" is parent view only (I, product owner decision): a child opens `/parent/stats?student=<id>` (preselected), never `/map`; per child "Rewards you set" and "Link a device" (`/onboarding?link=<id>` opens that child's link step); "Family feedback" link.
- Web app talks to the real API (I): the core client used placeholder paths the API never had (`family`, `students/:id/map`, `lessons/...`) and no cookies, so `/family` failed on staging after sign-in. It now reads `GET /v1/onboarding/family` (shared `OnboardingFamilySchema`) with `credentials: 'include'`; the welcome page starts Better Auth sign-in (`POST /api/auth/sign-in/social`, back to `/family`) instead of jumping to `/family`; a 401 on any screen (and onboarding) shows "Please sign in" with the provider buttons, returning to the same page; a family with no children goes from `/family` to `/onboarding`; sign-out (`POST /api/auth/sign-out`) on the welcome page and `/family`; the welcome page reads `GET /api/auth/get-session` and offers Continue and Sign out when signed in. Placeholder lesson screens removed (`/lesson/:id` opens `/learn/topic/:id`). Map and cards-due call F2's agreed `GET /v1/student/map` and `GET /v1/student/cards/due` (not on the API yet).
- Parent stats dashboard: a day with only flashcard practice no longer counts as a rest day (K).
- Opening My stats, the parent dashboard or a child's parent-set rewards no longer uses up the "New!" rewards the student should see on their Rewards page (K, via a read-only `rewardsProgress` in R's rewards routes).
- GCSE Statistics offers only AQA and Pearson Edexcel in onboarding (checked on the board websites).
- Verification protocol now covers extended answers (blind marking of exemplars plus individual human approval).

### Added

- Flashcard sessions (F3): `flashcard_sessions` table (migration 0010), `POST /v1/student/flashcards/sessions` and `.../sessions/:id/finish`; reviews need a `sessionId` and no longer return `xpEarned` or `progress`; session XP counts for rewards and the flashcards-reviewed milestones; flashcard self-ratings never change topic mastery. `DECK_REVIEW_XP` removed.
- Error reports (I): "Send error report" on every error with an `RD-` code posts an anonymous report to `POST /v1/error-reports` (strict `ErrorReportSchema`: code, screen and API path with ids masked, status, build, browser family, online, time); `error_reports` table (migration 0009, one row per code, 90-day clean-up); operator list at `/admin/feedback` (filter "Error reports"), `GET /v1/admin/error-reports?since=…` grouped by screen, API path and status, and `scripts/error-reports.mjs` (reads `DATABASE_URL`). Id-free path checks now also refuse full ids. Privacy notice 1.2 and data retention 1.1.
- Combo XP J4 (J): `COMBO_BONUS_XP`, `comboBonusXp`, `comboBefore`, `comboBonusForSequence` in `packages/core/src/xp.ts`. `POST /v1/student/learn/attempts` adds +5 XP from the 3rd right Learn mode answer in a row (worked out from the student's recent answers; a wrong answer, a Test mode answer or a 5-minute gap ends it) and returns `combo` and `comboBonusXp`. `POST .../starting-tests/:id/finish` applies the bonus to the test's answers in order on the first finish and returns `bestCombo` and `comboBonusXp`. The bonus is stored in each answer's `xp_earned`, so R's reward XP and daily cap count it. New optional fields in `LearnAttemptResponseSchema` and `StartingTestResultSchema`.
- Research: competitor analysis of UK revision products (features, past-paper licensing, prices) and a ranked gap list (`docs/research/competitors-2026-11.md`).
- Game feel J1 (J): dark "arena" theme tokens (`--arena-*`, answer colours, neon sparks, all text pairs checked for 4.5:1) and motion tokens (`--motion-*`, `--ease-spring`) in `apps/web/src/design/`, `arena.css` (arena screen, 2×2 answer grid, jelly press), and effect components in `apps/web/src/features/juice/` (particle burst capped at 24, float-up text, shake, COMBO ×n badge, star reveal, confetti capped at 40, rolling counter, springy glowing progress bar, Pip speech line, pulsing CTA class) with a `useReducedMotion` switch that turns particles, shakes, confetti and pulsing off. Not yet used on any screen (J2–J5).
- Topic map from real data (F2): `GET /v1/student/map` (units, topic states, unit challenge, next mission) and `GET /v1/student/cards/due`; the Map tab and Cards badge call them, map hexes open the lesson player, and the map schemas are shared from `packages/core`.
- Friendly view of the young people's privacy notice (L6): short-version cards, key points with accessible "Read more" and "Expand all", original SVG icons and Pip, reduced-motion aware, print expands all; built from `docs/legal/privacy-for-young-people.md` (now 1.1) with comment hints; e2e axe test.
- Parent reward notification (H2): the family export (`GET /v1/export`) lists the parent's reward-news devices without their push keys; `parent_push_subscriptions` table and `parent_rewards.reached_notified_at` (migration 0007), `POST, DELETE /v1/parent/push-subscriptions`, `GET /v1/parent/notifications/latest`, a cron step (`runParentRewardNotifications`) that reads the read-only `rewardsProgress`, sends once per reward, respects the child's nightly quiet hours and is not counted in the 2-a-day reminder limit; the service worker shows parent text and opens `/parent` on parent devices.
- Parent home (P): tapping a child on "Who's revising?" now opens `/parent?student=<id>` (that child preselected) instead of `/parent/stats`. `/parent` has a student switcher, rewards you set, reminder times (`/parent/reminders/:id`, the existing reminder settings form), stats dashboard, manage children, family feedback, download your family's data (to the B2 panel on `/onboarding`), Reward news toggle, settings and policies; linked from `/family` and Settings.
- Privacy fixes (B2): `GET /v1/export` (parent's and own children's data as JSON, secrets left out) and a "Download your family's data" panel on the onboarding family list; family activity (`families.last_active_at`, `previous_active_at`, migration 0006), 12-month inactive deletion and `GET /v1/family/activity` with a return-after-11-months warning; the 15-minute cron (`apps/api/src/cleanup.ts`) also deletes expired link codes, student and parent sessions, passkey challenges and sign-in checks.
- Support email (L): `help@revisionden.com` from `VITE_SUPPORT_EMAIL` (default in the repo) on the About page, the feedback form and as `{{SUPPORT_EMAIL}}` in the accessibility statement and community rules (both now 1.1); privacy@ stays the privacy contact.
- Error reference codes (I): every API error body has `error.ref` (`RD-` + 6 letters/digits, `makeErrorRef` in core), logged with status, code, method and an id-masked path (no messages or personal data); every "Something went wrong" in the web app shows it; `POST /v1/client-errors` logs codes the web app made itself (strict schema, rate limited).
- Route contract (I): `apps/api/routes.json` generated from the Hono app (`UPDATE_ROUTES=1` to refresh); web tests fail if any MSW handler (shared or per test) is not a real route; the web/API call table is in `docs/ARCHITECTURE.md`.
- Deployed smoke test (I): `E2E_BASE_URL=https://staging.revisionden.com pnpm --filter @revisionden/e2e smoke` checks health, sign-in providers, the start of Google sign-in, the family route, policy pages, the Google button and the signed-out `/family` prompt. No sign-in backdoor.
- Sign-in providers are each optional (G follow-up): the API starts with Google or Microsoft alone (id and secret together, at least one), `GET /v1/auth/providers` lists the configured ones, and the welcome page shows only those buttons (both if the API cannot be asked).
- Reward sounds (U4): four tiers by rarity (common ~0.5 s, rare ~1 s, epic ~1.5 s, legendary ≤ 3 s) with 4 variations each and no repeat in a row (injected randomness), ladder and level steps that climb in pitch and fullness, a synth voice per year chapter, unique GCSE and A-Level finisher fanfares, one sound for several rewards (the biggest, after any sound still playing), tap to skip legendary, Settings samples (Common, Rare, Epic, Legend); played on the Rewards screen for new rewards. Removed a stale "coming soon: sound effects" line.
- Deploys (G1, G2, G5): Neon project `revisionden` (London) with `main`, `staging` and `dev` branches migrated to 0005; EU-jurisdiction R2 upload buckets with a 24-hour delete rule; authenticated AI Gateway `revisionden`; API Workers on `api-dev.`, `api-staging.` and `api.revisionden.com` and web Workers on `dev.` and `staging.`; GitHub Actions deploys (`deploy-dev.yml`, `deploy-staging.yml`, `deploy-production.yml` after the release bump, shared `deploy.yml`) that migrate over HTTPS (`db:migrate:deploy`), deploy, and check `/health` (`scripts/check-deploy.mjs`). `/health` now answers `misconfigured` (503) with the version while a secret is missing. Production web builds fail without `VITE_OPERATOR_NAME`, `VITE_CONTACT_EMAIL` or `VITE_POLICY_EFFECTIVE_DATE`. Version footer on every page.
- End-to-end and accessibility (G4): Playwright + axe suite in `e2e/` at phone, tablet and desktop sizes, run on pull requests into `staging` and `main` (`e2e.yml`).
- Cloud Run deploy for the maths engine (G3), written and disabled until Google Cloud is set up (`deploy-maths.yml`).
- Sound effects (U1–U3): Web Audio sound bank (one synthesised sound per event, no audio files), `SoundProvider` and `useSound().play()`, header quick mute, Settings Sound section (on/off, volume, tap sounds; saved per device), iOS ambient audio session, nothing before the first tap or in the background, Test mode rule; wired into lessons, starting test and flashcards.
- Five-year rewards progression (R): level curve 1 to 100 with prestige stars, a 369-reward catalogue as data (levels, year chapters, milestone ladders, collections, 2026/27 seasonal drops) with a validator, healthy-limit rules (no late-night or time-based rewards, daily cap), student `/rewards` screen, and parent-set real-world rewards (`/family/:id/rewards`, `parent_rewards` table, migration 0004).
- New original avatar art: five chapter finale tops, rooftop scene, and the Frost Fest drop (bobble hat, paper lantern, frosty night scene).
- Verification: blind marking for extended answers: three exemplars (top, middle, low) marked by a second provider without the intended levels must all match; verified extended answers need `blind-marking` and individual human approval, and review batches always include them.
- Verification: the quote checker reports near matches (letters only, or words with small insertions or reordering, with a confidence) for a reviewer to confirm instead of passing them.
- Policies (L1): all eleven `docs/legal/` policies as 1.0 drafts, checked against the code; mismatches recorded in contradictions.
- Policy pages `/legal` and `/legal/:name` from the same Markdown with build-time placeholders and print style (L2); About page with What's new from `CHANGELOG.md` and licences (L3).
- Feedback (L4): form, personal-details check, device details toggle, family and own lists, operator triage, 5 per 24 hours, 12-month retention; `feedback` table (migration 0005), `OPERATOR_EMAILS`.
- Policy acceptance in onboarding with a "policy changed" prompt, `policy_acceptances` table and `GET, PUT /v1/policy-acceptances` (L5).
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
