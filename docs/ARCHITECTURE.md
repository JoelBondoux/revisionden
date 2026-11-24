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

## Data model (owned by the API/DB workstream)

Source of truth: `packages/db/src/schema.ts`; migrations in `packages/db/migrations`.

| Table                | Key fields                                                                  |
| -------------------- | --------------------------------------------------------------------------- |
| `auth_users`         | id, email, email_verified, name (always blank), image (always null)         |
| `auth_sessions`      | id, token, user_id, expires_at (IP address and user agent not kept)         |
| `auth_accounts`      | id, user_id, provider_id, account_id, OAuth tokens (no passwords)           |
| `auth_verifications` | id, identifier, value, expires_at (OAuth state)                             |
| `families`           | id, created_at                                                              |
| `parents`            | id, family_id, auth_user_id (unique)                                        |
| `students`           | id, family_id, nickname (unique per family), avatar_code, year_group (7–13) |
| `enrolments`         | student_id + subject_id (key), board, tier, spec_version                    |
| `devices`            | id, student_id, credential_id, public_key, counter, transports, linked_at   |
| `device_link_tokens` | id, token_hash, family_id, student_id, expires_at, used_at                  |
| `passkey_challenges` | id, kind (register, unlock), challenge, student_id, expires_at, used_at     |
| `student_sessions`   | id, token_hash, student_id, device_id, expires_at                           |
| `topics`             | id (text), subject_id, board, spec_ref, title, parent_topic_id              |
| `items`              | id, topic_id, type, body (JSON), answer (JSON), source_ref, checked_by      |
| `attempts`           | id, student_id, item_id, correct, score, time_ms, created_at                |
| `mastery`            | student_id + topic_id (key), value (0–1), updated_at                        |
| `exams`              | id, student_id, kind (exam, mock, assessment), subject_id, date, result     |
| `school_reports`     | id, student_id, date, values (JSON)                                         |
| `plans`              | id, student_id, week_start (unique per student), sessions (JSON), edited_by |
| `rewards`            | student_id + reward_id (key), earned_at                                     |
| `streaks`            | student_id (key), current, best, skip_days, gift_days                       |

No table stores a real name, date of birth, email of a student, photo or school name. The
schema guard test (`packages/db/src/schema-guard.test.ts`) checks the migrated database and fails
if such a column appears. The only allowed matches are the parent's Better Auth fields listed in
`schema-guard.ts`. Tokens (link tokens, student sessions) are stored as SHA-256 hashes.

## API (workstream B)

All bodies are validated with the Zod schemas in `packages/core`. Errors always look like
`{ "error": { "code", "message", "details"? } }` (`ApiErrorSchema`).

| Route                                                             | Who            | What                                      |
| ----------------------------------------------------------------- | -------------- | ----------------------------------------- |
| `GET /health`                                                     | anyone         | `{ status, version }`                     |
| `/api/auth/*`                                                     | anyone         | Better Auth: Google, Microsoft, sign-out  |
| `GET /v1/me`                                                      | parent         | Family id and sign-in email               |
| `GET, POST /v1/students`                                          | parent         | List (`{ students }`) or create           |
| `GET, PATCH, DELETE /v1/students/:id`                             | parent         | One student                               |
| `GET, POST /v1/students/:id/enrolments`                           | parent         | List (`{ enrolments }`) or add/replace    |
| `DELETE /v1/students/:id/enrolments/:subjectId`                   | parent         | Remove an enrolment                       |
| `POST /v1/students/:id/link-tokens`                               | parent         | One-time token and QR link (10 minutes)   |
| `GET /v1/students/:id/devices`, `DELETE .../devices/:id`          | parent         | List or unlink devices                    |
| `POST /v1/device/link`                                            | new device     | Redeem token + family id; passkey options |
| `POST /v1/device/link/verify`                                     | new device     | Register passkey; starts student session  |
| `POST /v1/device/unlock/options`, `POST /v1/device/unlock/verify` | linked device  | Unlock with the passkey                   |
| `GET /v1/student/me`, `POST /v1/student/lock`                     | student device | Who is signed in; lock the device         |

A parent only ever sees their own family: another family's student answers 404. The QR code
holds `<web origin>/link?token=…&family=…`. The passkey relying party is the web app's host
(`PASSKEY_RP_ID`). Student sessions use the `__Host-rd_student` cookie (HttpOnly, Secure,
SameSite=Lax) and last 12 hours. Sign-in, device and AI routes are rate limited per address
(30 and 20 requests a minute) and answer 429 with `Retry-After`.

## Conventions

- TypeScript strict everywhere; ESM; Node 22.
- Every request and response body has a Zod schema in `packages/core`.
- Time, randomness and AI clients are injected so code is testable.
