# Instructions for AI build sessions

You are building RevisionDen, a family revision tutor (GCSE and A-Level). Read these first:
`docs/PLAN.md`, `docs/TESTING.md`, `docs/BRANCHING.md`, `docs/PRIVACY.md`,
`docs/PRODUCT_RULES.md`, `docs/ARCHITECTURE.md`, `docs/WORKSTREAMS.md`.

## Non-negotiable rules

1. **Red, green, refactor.** Write a failing test first and run it to see it fail for the right
   reason. Then the least code to pass. Then refactor. No behaviour without a test.
2. **Branches.** Branch from `dev` as `feature/<workstream-id>-<name>`. Open a pull request into
   `dev`. Never push to `dev`, `staging` or `main` directly.
3. **Stay in your lane.** Only change the paths your workstream owns (see `docs/WORKSTREAMS.md`).
   If you need a change elsewhere, note it in your PR description instead.
4. **Live docs.** In the same PR: update the docs your change affects, add a line under
   `## [Unreleased]` in `CHANGELOG.md`, and update your row in `docs/WORKSTREAMS.md`.
5. **Privacy.** This repository is public. Do not add a root README.md or a repository description. Never commit real names, schools, emails, photos or
   any personal data, even in tests. Never commit secrets; use `.dev.vars` (git-ignored).
6. **Versions.** Do not edit `VERSION` by hand; the release workflow bumps it on `main`.
7. **Green before PR.** `pnpm lint && pnpm typecheck && pnpm test:coverage && pnpm test:scripts`
   and, for `services/maths`, `python -m pytest -q`.

## Commands

```bash
pnpm install
pnpm test           # all TypeScript tests
pnpm test:coverage  # with coverage gates
pnpm lint && pnpm typecheck
```

## Style

TypeScript strict, ESM, small pure functions in `packages/core`, inject time and randomness,
plain-English test names, conventional commit messages.
