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

## Web app (`apps/web`)

| Folder           | What it holds                                                                             |
| ---------------- | ----------------------------------------------------------------------------------------- |
| `src/design`     | Design tokens (`tokens.ts`, mirrored as CSS variables in `tokens.css`), base styles       |
| `src/components` | Shared components (Button, Pill, ProgressBar, Card, BottomNav, Toast, Sheet, Avatar, Pip) |
| `src/layout`     | `AppLayout` (main nav: bottom bar on phones, side rail from 768px) and `FocusLayout`      |
| `src/pages`      | One component per screen; `src/routes.tsx` maps paths to screens                          |
| `src/api`        | Typed API client (every response checked with Zod), `useApiResource`, retry UI            |
| `src/mocks`      | MSW handlers and made-up demo data, used by tests and by `pnpm dev`                       |
| `src/pwa`        | Service worker registration and the offline banner                                        |
| `src/session`    | Which student is using this device (a convenience until device linking lands)             |
| `public/`        | Web app manifest, icons, `sw.js` (app shell cache) and the MSW worker for development     |

- **Routes:** `/` welcome, `/family`, `/learn` (path), `/lesson/:id`, `/lesson/:id/complete`,
  `/cards`, `/plan`, `/papers`, `/progress`, `/settings`, `/install`; anything else shows a 404.
- **API address:** `VITE_API_URL`, defaulting to `/api` on the same site. In development the MSW
  mock API answers instead (turn off with `VITE_USE_MOCKS=false`).
- **Offline:** `sw.js` caches the app shell (pages network first, built assets cache first) and
  never caches `/api/` calls. It is registered in production builds only.
- **Temporary schemas:** `src/api/schemas.ts` holds local Zod schemas until `packages/core`
  publishes the shared ones (workstream C).

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
