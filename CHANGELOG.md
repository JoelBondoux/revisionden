# Changelog

All notable changes are recorded here. Versions use the format `xx.xx.xxx` (major.minor.patch).
Every push to `main` bumps the version automatically; add entries under **Unreleased** in each PR.

## [Unreleased]

### Added

- Content JSON Schemas for subjects, topic trees, items and mark schemes (`content/schemas/`).
- `pnpm content:validate`: checks schemas, unique ids, topic links and every maths answer with
  the maths engine; runs in CI.
- GCSE Maths Higher pilot topic tree (Pearson Edexcel 1MA1) with sample items.
- Maths engine `POST /check-working`: finds the first wrong line of working and checks the final
  answer; safer input parsing; 90% coverage gate; container smoke test in CI.

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
