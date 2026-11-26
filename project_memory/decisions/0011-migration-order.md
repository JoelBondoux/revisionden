# 0011: Database migrations land in number order

- Status: accepted (lead ruling, 2026-11-26)
- Date: 2026-11-26

## Context

Deploys apply database migrations with drizzle-orm's `neon-http` migrator
(`packages/db/src/migrate-cli.ts`, run by `.github/workflows/deploy.yml`). It looks up the newest
migration already applied and runs only migrations whose journal `when` (the timestamp in
`packages/db/migrations/meta/_journal.json`) is later. A migration whose `when` is older than one
already applied is skipped without any error.

On 2026-11-26 several workstreams had migrations open at once (0029 to 0033). A later-numbered one
was ready to land first; if it had, the deploy would have silently skipped the earlier ones and
broken the features that need them.

## Decision

- Migrations land on `dev` in number order. Two open PRs never hold the same number; when they
  clash the lead assigns numbers, and the PR that trains first keeps the lower one.
- Before a PR with a migration trains, it merges the latest `dev` and regenerates its journal entry
  with drizzle-kit (never copying an old timestamp), so its `idx` follows the last one on `dev` and
  its `when` is later.
- A migration that has already been applied on dev is never edited; a new migration is added
  instead.

Detail: `docs/ARCHITECTURE.md` ("Migration order").
