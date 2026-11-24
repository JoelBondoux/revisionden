# Workstreams

> Live document. Each build session updates its own row when it starts, opens a PR and finishes.
> Only edit your own row to avoid merge conflicts. The lead session tidies this page after merges.

Status values: `queued`, `in progress`, `in review` (PR open into `dev`), `merged`, `blocked`.

## Wave 1: Stage 1 foundations

| ID  | Workstream                           | Owns these paths                                        | Status | PR                                                      |
| --- | ------------------------------------ | ------------------------------------------------------- | ------ | ------------------------------------------------------- |
| A   | Web foundations and design system    | `apps/web/**`                                           | merged | [#4](https://github.com/JoelBondoux/revisionden/pull/4) |
| B   | API, database and sign-in            | `apps/api/**`, `packages/db/**`                         | merged | [#6](https://github.com/JoelBondoux/revisionden/pull/6) |
| C   | Core domain rules and shared schemas | `packages/core/**`                                      | merged | [#3](https://github.com/JoelBondoux/revisionden/pull/3) |
| D   | Content format and maths engine      | `content/**`, `services/maths/**`, `scripts/content/**` | merged | [#5](https://github.com/JoelBondoux/revisionden/pull/5) |

## Wave 2

| ID  | Workstream                                                | Owns these paths                                                                                | Status                                                  | PR                                                        |
| --- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------- |
| A2  | Hexagon topic map, next mission card, Map tab             | `apps/web/**` (map)                                                                             | merged                                                  | [#8](https://github.com/JoelBondoux/revisionden/pull/8)   |
| E   | Family onboarding and avatar builder                      | `apps/web/src/features/onboarding/**`, `apps/web/src/features/avatar/**`, onboarding API routes | merged                                                  | [#9](https://github.com/JoelBondoux/revisionden/pull/9)   |
| F   | Learning loop, starting test, flashcards, XP              | `apps/web/src/features/learn/**`, `apps/web/src/features/flashcards/**`, learning API routes    | merged                                                  | [#10](https://github.com/JoelBondoux/revisionden/pull/10) |
| H   | Reminders and AI gateway with per-child cost cap          | `apps/api/src/ai/**`, `apps/api/src/notifications/**`, `apps/web/src/features/notifications/**` | in review (migration regenerated as 0002 on top of dev) | [#11](https://github.com/JoelBondoux/revisionden/pull/11) |
| V   | Verification pipeline, review queue, quarantine and audit | `scripts/verify/**`, `evals/**`, `apps/web/src/features/review/**`, review API routes           | in review (regenerating DB migration on top of dev)     | [#12](https://github.com/JoelBondoux/revisionden/pull/12) |
| S   | Official citations for pilot GCSE Maths content           | `content/items/**`, `content/topic-trees/**`, `content/mark-schemes/**`                         | merged                                                  | [#7](https://github.com/JoelBondoux/revisionden/pull/7)   |

## Next (queued)

| ID  | Workstream                                                                                                    | Depends on                                                  |
| --- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| F2  | Map and cards-due API endpoints for the topic map (`/students/:id/map`, `/cards/due`), shared schemas in core | A2, F                                                       |
| G   | Deploy pipelines for dev, staging and production; Playwright end-to-end and accessibility                     | Scoped Cloudflare token and Neon key from the product owner |
| S2  | Run the full verification pipeline on the pilot and present it for human approval                             | V                                                           |
