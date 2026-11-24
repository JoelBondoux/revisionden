# Workstreams

> Live document. Each build session updates its own row when it starts, opens a PR and finishes.
> Only edit your own row to avoid merge conflicts.

Status values: `queued`, `in progress`, `in review` (PR open into `dev`), `merged`, `blocked`.

## Wave 1: Stage 1 foundations (running in parallel)

| ID  | Workstream                           | Owns these paths                                        | Branch                      | Status      | PR                                                      |
| --- | ------------------------------------ | ------------------------------------------------------- | --------------------------- | ----------- | ------------------------------------------------------- |
| A   | Web foundations and design system    | `apps/web/**`                                           | `feature/a-web-foundations` | merged      | [#4](https://github.com/JoelBondoux/revisionden/pull/4) |
| B   | API, database and sign-in            | `apps/api/**`, `packages/db/**`                         | `feature/b-api-db-auth`     | in review   | [#6](https://github.com/JoelBondoux/revisionden/pull/6) |
| C   | Core domain rules and shared schemas | `packages/core/**`                                      | `feature/c-core-rules`      | merged      | [#3](https://github.com/JoelBondoux/revisionden/pull/3) |
| D   | Content format and maths engine      | `content/**`, `services/maths/**`, `scripts/content/**` | `feature/d-content-maths`   | in progress |                                                         |

### A: Web foundations and design system

Design tokens and components matching the mockups (Nunito, chunky 3D buttons, pills, progress
bars, bottom nav, toasts); PWA manifest and service worker; routing; screen shells for welcome
and sign-in, learning path, lesson question, lesson complete; API calls mocked with MSW against
the Zod schemas from `packages/core`. Accessibility: real buttons and links, 44px targets,
4.5:1 contrast.

### B: API, database and sign-in

Drizzle schema and migrations (see `ARCHITECTURE.md`); Wrangler config for dev, staging and
production; Better Auth with Google and Microsoft; family and student endpoints; one-time QR
device-link tokens and passkeys; integration tests against PGlite.

### C: Core domain rules and shared schemas

Spaced repetition scheduler; mastery updates; next-item selection (weak spots first, parent focus
weights); XP, daily goal, streaks, skip days and gift days; avatar code encode, decode and
validation; nickname validation; Zod schemas for every API request and response.

### D: Content format and maths engine

JSON Schemas for topic trees and items, a validator script with tests, one pilot topic tree
(GCSE Maths, Higher); maths engine endpoint that checks a list of working lines step by step
and reports which line first goes wrong; Cloud Run container ready to deploy.

## Wave 2: queued until Wave 1 is merged

| ID  | Workstream                                                              | Depends on           |
| --- | ----------------------------------------------------------------------- | -------------------- |
| E   | Family onboarding and avatar builder screens                            | A, B, C              |
| F   | Learning loop: starting test, path, lessons, flashcards, XP             | A, B, C, D           |
| G   | Deploy pipelines for dev, staging and production; Playwright end-to-end | A, B (domain bought) |
| H   | Reminders (web push) and AI gateway with per-child cost cap             | B                    |
| V   | Verification pipeline, review queue, quarantine and audit reports       | C, D                 |
