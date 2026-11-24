# Changelog

All notable changes are recorded here. Versions use the format `xx.xx.xxx` (major.minor.patch).
Every push to `main` bumps the version automatically; add entries under **Unreleased** in each PR.

## [Unreleased]

### Added

- Monorepo skeleton: web app, API, core domain logic, maths engine.
- CI on every pull request; automatic version bump and tag on every push to `main`.
- Project plan and live documentation in `docs/`.
- Feedback-level rules tied to grade boundaries (`packages/core`).
- Maths equivalence checking with SymPy (`services/maths`).
