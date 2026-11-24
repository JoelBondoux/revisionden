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

## [00.01.002] - 2026-11-24

## [00.01.001] - 2026-11-24

### Added

- Verification protocol (`docs/VERIFICATION.md`): official citations on every item, multi-step checks, human approval, quarantine and audit reports; new workstream V and task D6.

- Project memory (`project_memory/`) in the AtlasMind layout as the single source of truth, with the AtlasMind SSOT rule in `CLAUDE.md` and `AGENTS.md`; decision records moved to `project_memory/decisions/`.

- Monorepo skeleton: web app, API, core domain logic, maths engine.
- CI on every pull request; automatic version bump and tag on every push to `main`.
- Project overview moved to `docs/OVERVIEW.md` (no README while the repository is public).
- Project plan, delivery backlog, content plan, AI plan and environment set-up in `docs/`.
- Feedback-level rules tied to grade boundaries (`packages/core`).
- Maths equivalence checking with SymPy (`services/maths`).
