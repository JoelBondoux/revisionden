# Project Soul

Tags: #project-identity #vision #goals

> The living identity of RevisionDen. Project memory (`project_memory/`) is the single source of
> truth (SSOT) for simple facts and the decisions behind them. Detailed specifications live in
> `docs/` and are linked from here.

## Project Type

Web application (installable PWA) with an API, a Python maths service and a content pipeline.

## Vision

A private, family revision tutor for GCSE and A-Level students that finds each student's weak
spots, plans revision around their exams and keeps them motivated with a game-like style aimed at
teenagers. It replaces a paid revision subscription and runs almost entirely on free plans.

### Success metrics

- Students revise on 5+ days a week; most practice time goes to weak topics.
- Mock and assessment results move towards target grades.
- Zero confirmed errors in released content; every item cited and verified (`docs/VERIFICATION.md`).
- Under £10 a month to run for one family.

## Principles

- Privacy first: store the minimum; no student real names, photos or school names; no passwords.
- No mistakes on the education side: every question, answer, diagram and mark is grounded in an
  official citation where one exists and passes the verification pipeline (`docs/VERIFICATION.md`).
- Trustworthy answers: facts from official exam board material; maths checked by the engine; AI
  marking always labelled as a guide.
- Red/green/refactor TDD for all behaviour.
- Teen-appropriate, original design: inspired by games, never copying another product's look or IP.

## Key Decisions

- Stack: Cloudflare (web, Workers, R2, AI Gateway), Neon Postgres, Cloud Run maths engine
  (`decisions/0001-stack.md`).
- Parent sign-in with Better Auth; student devices with one-time link tokens and passkeys; tests
  on PGlite (`decisions/0002-auth-db-testing.md`).
- Branch flow `feature/*` → `dev` → `staging` → `main`; version `xx.xx.xxx` bumped on every push to
  `main` (`docs/BRANCHING.md`).
- The repository has no root README or GitHub description while it is public (`docs/PRIVACY.md`).
- Domains: `revisionden.com` is the public sales site (`apps/www`), the app is on
  `app.revisionden.com` (`decisions/0005-domains-sales-site.md`).
- A standard definition with no official source may rest on the spec point that names the term,
  with individual human approval (`decisions/0008-definitions-policy.md`).
- A standard maths fact with no official source stays in but must pass a fact-check stage (official
  citation, or engine proof plus a third provider's blind statement) (`decisions/0009-fact-check-stage.md`).
- Question generation rules: 3% sampling for owner-approved template batches, set texts as
  quotation-only sources, fact-table batching, warn-only readability
  (`decisions/0010-question-generation-rules.md`).
- Database migrations land on `dev` in number order, each with a journal `when` later than the last
  (the migrator skips older ones) (`decisions/0011-migration-order.md`).
- Canonical backlog: `docs/BACKLOG.md` (`roadmap/improvement-plan.md` points to it).

## Maintained Pages

- domain/product-facts.md — what the product does, its rules, limits and defaults.
- operations/contradictions.md — open disagreements between memory, docs and code.
- misadventures/ — things that were tried and did not work, and why.

## Detailed specifications (in `docs/`)

- docs/PLAN.md, docs/BACKLOG.md, docs/WORKSTREAMS.md
- docs/PRODUCT_RULES.md, docs/ARCHITECTURE.md, docs/TESTING.md, docs/BRANCHING.md
- docs/CONTENT_PLAN.md, docs/AI.md, docs/ENVIRONMENTS.md, docs/PRIVACY.md
