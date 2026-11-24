# Instructions for AI build sessions

You are building RevisionDen, a family revision tutor (GCSE and A-Level). Read `project_memory/project_soul.md` and `project_memory/domain/product-facts.md` first (project memory is the single source of truth), then:
`docs/PLAN.md`, `docs/TESTING.md`, `docs/BRANCHING.md`, `docs/PRIVACY.md`,
`docs/PRODUCT_RULES.md`, `docs/ARCHITECTURE.md`, `docs/WORKSTREAMS.md`.

## Non-negotiable rules

1. **Red, green, refactor.** Write a failing test first and run it to see it fail for the right
   reason. Then the least code to pass. Then refactor. No behaviour without a test.
2. **Branches.** Branch from `dev` as `feature/<workstream-id>-<name>`. Open a pull request into
   `dev`. Never push to `dev`, `staging` or `main` directly.
3. **Stay in your lane.** Only change the paths your workstream owns (see `docs/WORKSTREAMS.md`).
   If you need a change elsewhere, note it in your PR description instead.
4. **Live docs.** In the same PR: update the docs your change affects and the `project_memory/` page that records any fact you changed, add a line under
   `## [Unreleased]` in `CHANGELOG.md` (and, for anything a family would notice, one plain-English line under its `### What's new`), and update your row in `docs/WORKSTREAMS.md`.
5. **Privacy.** This repository is public. Do not add a root README.md or a repository description. Never commit real names, schools, emails, photos or
   any personal data, even in tests. Never commit secrets; use `.dev.vars` (git-ignored).
6. **Versions.** Do not edit `VERSION` by hand; the release workflow bumps it on `main`.
7. **Verified content only.** Any educational content (questions, answers, diagrams, facts, mark
   schemes) follows `docs/VERIFICATION.md`: at least one official citation, all checks passed. Never
   invent a fact, a citation or a quote.
8. **Green before PR.** `pnpm lint && pnpm typecheck && pnpm test:coverage && pnpm test:scripts`
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

<!-- atlasmind:memory-ssot:start -->

## Project Memory is the source of truth (managed by AtlasMind)

`project_memory/` is this project's single source of truth (SSOT) for simple facts: what the product does, its limits,
defaults, settings, tiers or plans, and the decisions behind them. This applies to every agent working in this
repository, whichever tool it runs in.

- **Read Project Memory before code.** For a simple check, start with the pages listed under `## Maintained Pages` in
  `project_memory/project_soul.md`, then `project_memory/domain/product-facts.md`, then the rest of `project_memory/`. Read code when memory
  does not answer the question or the task needs exactness.
- **Change the fact, change the page.** Any change that alters one of those facts updates the Project Memory page that
  records it, in the same change. A change that leaves a page wrong is not finished.
- **Write back what you had to look up.** If no page answers the question, settle it in the code once and record the
  answer on the page it belongs on (or in `project_memory/domain/product-facts.md`), so the next agent does not have to.
- **Prefer maintained pages to imported ones.** A page ending in an `<!-- atlasmind-import` footer is generated from
  other files (README, manifest, docs) and can lag the code; `project_memory/index/import-freshness.md` says which are stale.
  Record a fact on a maintained page: an imported page that is edited by hand stops refreshing.
- **No other agent will do it for you.** AtlasMind's memory agent only runs on AtlasMind chat turns. Work done in any
  other tool (Claude Code, Codex, Copilot, Cursor, Gemini and the rest) reaches Project Memory only if the agent doing
  that work writes it.
- **Settle or record every contradiction; never ignore one.** When Project Memory, the docs and the code disagree, the
  code is what the product does today, and a recorded ruling or decision (for example under `decisions/`) is what it
  should do, so code that contradicts one is a bug to raise rather than a fact to copy. If the fix is in scope and it
  is clear which side is right, correct the wrong side in the same change and say so. Otherwise do not guess: add a
  `- [ ]` line under `## Open` in `project_memory/operations/contradictions.md` (create the page if it is missing) naming
  what disagrees, the paths on each side and why it was not settled, and tell the user. AtlasMind keeps surfacing
  open entries until the box is ticked.
- Never write secrets, credentials or personal data into Project Memory.

<!-- atlasmind:memory-ssot:end -->
