# Changelog

All notable changes are recorded here. Versions use the format `xx.xx.xxx` (major.minor.patch).
Every push to `main` bumps the version automatically; add entries under **Unreleased** in each PR.

## [Unreleased]

### Added

- Verification protocol (`docs/VERIFICATION.md`): official citations on every item, multi-step checks, human approval, quarantine and audit reports; new workstream V and task D6.

- Web: design tokens from the mockups (Nunito, violet, 3D edges) with a 4.5:1 contrast check (A1).
- Web: core components: Button, Pill, ProgressBar, Card, BottomNav, Toast, Sheet, Avatar and Pip the fox (A2).
- Web: routes for every Stage 1 screen, a friendly 404, bottom nav on phones and a side nav on tablets and desktops (A3).
- Web: typed API client that checks every response, with retry UI and an MSW mock API for development and tests (A4).
- Web: installable PWA with icons, an offline app shell, an offline banner and Add to Home Screen help for iPad (A5).
- Web: welcome, family, learning path, lesson and lesson complete screens wired to mock data (A6).
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

## [00.01.002] - 2026-11-24

## [00.01.001] - 2026-11-24

### Added

- Project memory (`project_memory/`) in the AtlasMind layout as the single source of truth, with the AtlasMind SSOT rule in `CLAUDE.md` and `AGENTS.md`; decision records moved to `project_memory/decisions/`.

- Monorepo skeleton: web app, API, core domain logic, maths engine.
- CI on every pull request; automatic version bump and tag on every push to `main`.
- Project overview moved to `docs/OVERVIEW.md` (no README while the repository is public).
- Project plan, delivery backlog, content plan, AI plan and environment set-up in `docs/`.
- Feedback-level rules tied to grade boundaries (`packages/core`).
- Maths equivalence checking with SymPy (`services/maths`).
