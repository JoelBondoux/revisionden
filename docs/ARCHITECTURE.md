# Architecture

> Live document. Update when a service, boundary or data flow changes. Decisions are recorded in
> [`project_memory/decisions/`](../project_memory/decisions/).

## Overview

```
 Phone / iPad / desktop (installable web app)
            │  HTTPS
            ▼
 Cloudflare: static web app ── Workers API (Hono, Better Auth) ── R2 (temporary uploads)
                                   │            │
                         Neon Postgres     Cloudflare AI Gateway ── Anthropic / OpenAI / Gemini
                         (London)               │
                                   └── Google Cloud Run: maths engine (SymPy), content jobs
```

## Repository layout

| Path             | What it is                                                                                                        |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| `apps/web`       | React + Vite PWA. Screens, design system, offline cache, web push                                                 |
| `apps/api`       | Hono app for Cloudflare Workers. Auth, REST endpoints, AI calls via the gateway                                   |
| `packages/core`  | Pure TypeScript domain logic, no I/O: rules for levels, streaks, mastery, plans, avatar codes. Shared Zod schemas |
| `packages/db`    | Drizzle schema and migrations for Neon Postgres                                                                   |
| `services/maths` | Python FastAPI + SymPy maths engine for Cloud Run                                                                 |
| `content/`       | Specification topic trees and question banks (JSON), with schemas                                                 |
| `e2e/`           | Playwright end-to-end and accessibility tests                                                                     |
| `evals/`         | AI marking evaluation set (never run in CI by default)                                                            |
| `scripts/`       | Repo tooling (version bump)                                                                                       |
| `docs/`          | Live documentation                                                                                                |

## Key flows

**Sign-in.** Parent uses Google or Microsoft through Better Auth (runs in our Worker; sessions in
Neon). Parent creates student profiles. A student device is linked by a one-time QR token
(10 minutes, single use) and then a passkey.

**Learning.** The web app fetches the next items from the API. The API picks them with
`packages/core` (weak spots first, parent focus weighting, spaced repetition) and records every
answer. Mastery, XP and streaks are updated by core functions.

**Marking.** Short answers: rules first, then a small model. Long answers and homework: the
student's transcription plus the mark scheme go to the marking model; the result is labelled as
marked by AI. Maths lines go to the maths engine, not to AI.

**Uploads.** Files go to R2 with a lifecycle rule that deletes them within 24 hours; the API
deletes them as soon as the user confirms what was read.

**AI gateway.** All AI calls go through Cloudflare AI Gateway: provider routing, logs without
personal data, spend tracking and the monthly cap per child.

## Data model (first draft, owned by the API/DB workstream)

| Table            | Key fields                                                              |
| ---------------- | ----------------------------------------------------------------------- |
| `families`       | id, created_at                                                          |
| `parents`        | id, family_id, auth_user_id                                             |
| `students`       | id, family_id, nickname, avatar_code, year_group                        |
| `devices`        | id, student_id, passkey credential, linked_at                           |
| `enrolments`     | student_id, subject_id, board, tier, spec_version                       |
| `topics`         | id, subject_id, board, spec_ref, parent_topic_id                        |
| `items`          | id, topic_id, type, body (JSON), answer (JSON), source_ref, checked_by  |
| `attempts`       | id, student_id, item_id, correct, score, time_ms, created_at            |
| `mastery`        | student_id, topic_id, value, updated_at                                 |
| `exams`          | id, student_id, kind (exam, mock, assessment), subject_id, date, result |
| `school_reports` | id, student_id, date, values (JSON)                                     |
| `plans`          | id, student_id, week_start, sessions (JSON), edited_by                  |
| `rewards`        | student_id, reward_id, earned_at                                        |
| `streaks`        | student_id, current, best, skip_days, gift_days                         |

No table stores a real name, date of birth, email of a student, photo or school name.

## Conventions

- TypeScript strict everywhere; ESM; Node 22.
- Every request and response body has a Zod schema in `packages/core`.
- Time, randomness and AI clients are injected so code is testable.
