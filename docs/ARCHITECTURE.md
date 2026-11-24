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
| `evals/`         | AI marking evaluation harness and golden sets (never run in CI by default)                                        |
| `scripts/`       | Repo tooling: version bump, content validator (`content/`), verification pipeline (`verify/`)                     |
| `docs/`          | Live documentation                                                                                                |

## Web app (`apps/web`)

| Folder                       | What it holds                                                                                |
| ---------------------------- | -------------------------------------------------------------------------------------------- |
| `src/design`                 | Design tokens (`tokens.ts`, mirrored as CSS variables in `tokens.css`), base styles          |
| `src/components`             | Shared components (Button, Pill, ProgressBar, Card, BottomNav, Toast, Sheet, Avatar, Pip)    |
| `src/layout`                 | `AppLayout` (main nav: bottom bar on phones, side rail from 768px) and `FocusLayout`         |
| `src/pages`                  | One component per screen; `src/routes.tsx` maps paths to screens                             |
| `src/api`                    | Typed API client (every response checked with Zod), `useApiResource`, retry UI               |
| `src/mocks`                  | MSW handlers and made-up demo data, used by tests and by `pnpm dev`                          |
| `src/pwa`                    | Service worker registration and the offline banner                                           |
| `src/session`                | Which student is using this device (a convenience until device linking lands)                |
| `src/features/learn`         | Lesson player, starting test, subject page, command words, learning API client and mocks (F) |
| `src/features/flashcards`    | Cards tab: due cards, all decks, my cards, 3D flip card (F)                                  |
| `src/features/notifications` | Reminders card for this device, parent reminder settings, push helpers (H)                   |
| `src/features/legal`         | Policy pages from `docs/legal/*.md`, placeholders, safe Markdown, policy acceptance gate (L) |
| `src/features/about`         | About page: version, environment, build, What's new from `CHANGELOG.md`, licences (L)        |
| `src/features/feedback`      | Feedback form, family and own feedback lists, operator triage at `/admin/feedback` (L)       |
| `public/`                    | Web app manifest, icons, `sw.js` (app shell cache) and the MSW worker for development        |

- **Learning routes (F):** `/learn/subject/:subjectId` (topics and mastery), `/learn/subject/:subjectId/start`
  (starting test), `/learn/subject/:subjectId/practice` (mixed lesson), `/learn/topic/:topicId`, `/learn/command-words`;
  `/cards` is the flashcards screen. They call `/v1/student/...` with the device cookie.
- **Routes:** `/` welcome, `/family`, `/learn` (path), `/lesson/:id`, `/lesson/:id/complete`,
  | Folder           | What it holds                                                                             |
  | ---------------- | ----------------------------------------------------------------------------------------- |
  | `src/design`     | Design tokens (`tokens.ts`, mirrored as CSS variables in `tokens.css`), base styles       |
  | `src/components` | Shared components (Button, Pill, ProgressBar, Card, BottomNav, Toast, Sheet, Avatar, Pip) |
  | `src/layout`     | `AppLayout` (main nav: bottom bar on phones, side rail from 768px) and `FocusLayout`      |
  | `src/map`        | Topic map pieces: honeycomb row layout, topic and challenge hexes, Next mission card      |
  | `src/pages`      | One component per screen; `src/routes.tsx` maps paths to screens                          |
  | `src/api`        | Typed API client (every response checked with Zod), `useApiResource`, retry UI            |
  | `src/mocks`      | MSW handlers and made-up demo data, used by tests and by `pnpm dev`                       |
  | `src/pwa`        | Service worker registration and the offline banner                                        |
  | `src/session`    | Which student is using this device (a convenience until device linking lands)             |
  | `public/`        | Web app manifest, icons, `sw.js` (app shell cache) and the MSW worker for development     |
- **Routes:** `/` welcome, `/family`, `/map` (topic map; `/learn` redirects there), `/lesson/:id`, `/lesson/:id/complete`,
  `/cards`, `/plan`, `/papers`, `/progress`, `/settings`, `/install`, `/about`, `/feedback`,
  `/feedback/family`, `/feedback/mine`; signed out: `/legal`, `/legal/:name`, `/welcome/privacy`;
  `/admin/feedback` (operator); anything else shows a 404.
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
personal data, spend tracking and the monthly cap per child. Detail: `docs/AI.md`.

**Reminders.** A cron trigger (every 15 minutes) works out each subscribed student's due
reminders (`apps/api/src/notifications/schedule.ts`), logs them and sends an empty VAPID-signed
push to each device. The service worker then fetches the text and shows the notification.

## Data model (owned by the API/DB workstream)

Source of truth: `packages/db/src/schema.ts`; migrations in `packages/db/migrations`.

| Table                | Key fields                                                                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth_users`         | id, email, email_verified, name (always blank), image (always null)                                                                             |
| `auth_sessions`      | id, token, user_id, expires_at (IP address and user agent not kept)                                                                             |
| `auth_accounts`      | id, user_id, provider_id, account_id, OAuth tokens (no passwords)                                                                               |
| `auth_verifications` | id, identifier, value, expires_at (OAuth state)                                                                                                 |
| `families`           | id, created_at                                                                                                                                  |
| `parents`            | id, family_id, auth_user_id (unique)                                                                                                            |
| `students`           | id, family_id, nickname (unique per family), avatar_code, year_group (7–13)                                                                     |
| `enrolments`         | student_id + subject_id (key), board, tier, spec_version                                                                                        |
| `devices`            | id, student_id, credential_id, public_key, counter, transports, linked_at                                                                       |
| `device_link_tokens` | id, token_hash, family_id, student_id, expires_at, used_at                                                                                      |
| `passkey_challenges` | id, kind (register, unlock), challenge, student_id, expires_at, used_at                                                                         |
| `student_sessions`   | id, token_hash, student_id, device_id, expires_at                                                                                               |
| `topics`             | id (text), subject_id, board, spec_ref, title, parent_topic_id                                                                                  |
| `items`              | id, topic_id, type, body (JSON), answer (JSON), source_ref, checked_by, content_id (unique), version, status, difficulty, tags                  |
| `attempts`           | id, student_id, item_id, correct, score, time_ms, created_at, item_version, mode, xp_earned, starting_test_id                                   |
| `mastery`            | student_id + topic_id (key), value (0–1), updated_at                                                                                            |
| `exams`              | id, student_id, kind (exam, mock, assessment), subject_id, date, result                                                                         |
| `school_reports`     | id, student_id, date, values (JSON)                                                                                                             |
| `plans`              | id, student_id, week_start (unique per student), sessions (JSON), edited_by                                                                     |
| `rewards`            | student_id + reward_id (key), earned_at                                                                                                         |
| `parent_rewards`     | id, student_id, title, note, target_kind (reward, stat, date), reward_id, stat, at_least, target_date, given_at                                 |
| `streaks`            | student_id (key), current, best, skip_days, gift_days, skips_in_a_row, last_date, last_settled_week                                             |
| `daily_xp`           | student_id + day (key, UK date), xp                                                                                                             |
| `starting_tests`     | id, student_id, subject_id, item_ids (JSON), started (created_at), finished_at                                                                  |
| `flashcards`         | id, student_id, item_id (null for own cards), topic_id, origin (deck, wrong_answer, own), front, back, repetitions, interval_days, ease, due_at |
| `push_subscriptions` | id, student_id, device_id, endpoint (unique), p256dh, auth                                                                                      |
| `reminder_settings`  | student_id (key), on/off switches, quiet and weekday quiet times, time zone                                                                     |
| `reminder_log`       | id, student_id, kind (streak, session), local_date, message, sent_at                                                                            |
| `ai_usage`           | id, student_id, job, provider, model, tokens, cost_micro_usd (no prompts)                                                                       |
| `reviewer_roles`     | auth_user_id (key), role (subject-specialist, content-lead, parent-reviewer)                                                                    |
| `item_reports`       | id, item_id, item_version, reason, reported_by, family_id, status, decided_by_role                                                              |
| `quarantined_items`  | item_id (key), item_version, cause (report, confirmed_error, batch_failed)                                                                      |
| `review_batches`     | id, title, writer_prompt, source_url, status, sample_seed                                                                                       |
| `review_batch_items` | batch_id + item_id (key), item_version, in_sample, snapshot (JSON), decision, decided_by_role                                                   |
| `recheck_requests`   | id, scope (batch, item, writer_prompt, source), scope_value, cause, status                                                                      |
| `recalculation_jobs` | id, item_id, item_version, status                                                                                                               |
| `feedback`           | id, family_id, sender_role, student_id, sender_auth_user_id, kind, text (≤500), device (JSON), status, created_at, updated_at, closed_at        |
| `policy_acceptances` | auth_user_id + policy (key), version, accepted_at                                                                                               |

No table stores a real name, date of birth, email of a student, photo or school name. The
schema guard test (`packages/db/src/schema-guard.test.ts`) checks the migrated database and fails
if such a column appears. The only allowed matches are the parent's Better Auth fields listed in
`schema-guard.ts`. Tokens (link tokens, student sessions) are stored as SHA-256 hashes.

## API (workstream B)

All bodies are validated with the Zod schemas in `packages/core`. Errors always look like
`{ "error": { "code", "message", "details"? } }` (`ApiErrorSchema`).

| Route                                                                                                                              | Who             | What                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------- | --------------- | --------------------------------------------------------- |
| `GET /health`                                                                                                                      | anyone          | `{ status, version }`                                     |
| `/api/auth/*`                                                                                                                      | anyone          | Better Auth: Google, Microsoft, sign-out                  |
| `GET /v1/me`                                                                                                                       | parent          | Family id and sign-in email                               |
| `GET, POST /v1/students`                                                                                                           | parent          | List (`{ students }`) or create                           |
| `GET, PATCH, DELETE /v1/students/:id`                                                                                              | parent          | One student                                               |
| `GET, POST /v1/students/:id/enrolments`                                                                                            | parent          | List (`{ enrolments }`) or add/replace                    |
| `DELETE /v1/students/:id/enrolments/:subjectId`                                                                                    | parent          | Remove an enrolment                                       |
| `POST /v1/students/:id/link-tokens`                                                                                                | parent          | One-time token and QR link (10 minutes)                   |
| `GET, PUT /v1/students/:id/avatar`                                                                                                 | parent          | Avatar code and earned rewards; save code                 |
| `POST /v1/onboarding/children`                                                                                                     | parent          | Add a child with subjects, boards, tiers                  |
| `GET /v1/onboarding/family`                                                                                                        | parent          | Children with exams, checks left, devices                 |
| `GET /v1/students/:id/devices`, `DELETE .../devices/:id`                                                                           | parent          | List or unlink devices                                    |
| `POST /v1/device/link`                                                                                                             | new device      | Redeem token + family id; passkey options                 |
| `POST /v1/device/link/verify`                                                                                                      | new device      | Register passkey; starts student session                  |
| `POST /v1/device/unlock/options`, `POST /v1/device/unlock/verify`                                                                  | linked device   | Unlock with the passkey                                   |
| `GET /v1/student/me`, `POST /v1/student/lock`                                                                                      | student device  | Who is signed in; lock the device                         |
| `GET /v1/student/learn/lesson?topicId=…` or `?subjectId=…`                                                                         | student device  | Lesson items (no answers); mixed by mastery for a subject |
| `GET /v1/student/learn/command-words`                                                                                              | student device  | Command-word lesson                                       |
| `GET /v1/student/learn/subjects/:id/topics`                                                                                        | student device  | Topics with mastery; starting test done?                  |
| `POST /v1/student/learn/starting-tests`, `POST .../:id/finish`                                                                     | student device  | Start the starting test; finish and see mastery           |
| `POST /v1/student/learn/attempts`                                                                                                  | student device  | Mark an answer; XP, mastery, streak, feedback             |
| `GET /v1/student/learn/progress`                                                                                                   | student device  | XP today, total, daily goal, streak                       |
| `GET, POST /v1/student/flashcards`                                                                                                 | student device  | Due cards, decks, own cards; add own card                 |
| `GET /v1/student/flashcards/decks/:topicId`                                                                                        | student device  | One deck's cards                                          |
| `GET /v1/student/rewards`                                                                                                          | student device  | Level, chapter, milestones, drops; saves new rewards      |
| `GET /v1/students/:id/rewards`                                                                                                     | parent          | The same rewards view for a child                         |
| `GET, POST /v1/students/:id/parent-rewards`                                                                                        | parent          | List with progress; add one to any target                 |
| `PATCH, DELETE /v1/students/:id/parent-rewards/:rewardId`                                                                          | parent          | Edit or delete it until given (then 409)                  |
| `POST /v1/students/:id/parent-rewards/:rewardId/given`                                                                             | parent          | Mark it as given                                          |
| `POST /v1/student/flashcards/:id/review`                                                                                           | student device  | Rate a card (again, hard, good, easy)                     |
| `GET /v1/notifications/vapid-key`                                                                                                  | anyone          | Public key for web push (503 if off)                      |
| `POST, DELETE /v1/student/push-subscriptions`                                                                                      | student device  | Turn reminders on or off for this device                  |
| `GET /v1/student/reminders/latest`                                                                                                 | student device  | Latest reminder text (for the worker)                     |
| `GET, PUT /v1/students/:id/reminder-settings`                                                                                      | parent          | Quiet hours, school hours, reminder kinds                 |
| `GET /v1/students/:id/ai-usage`                                                                                                    | parent          | This month's AI calls, spend and cap                      |
| `GET /v1/student/stats?period=week\|term\|year`                                                                                    | student device  | My stats: tiles, XP chart, mastery, bests                 |
| `GET /v1/students/:id/stats?period=…`                                                                                              | parent          | The same stats for their own child                        |
| `GET /v1/students/:id/dashboard`                                                                                                   | parent          | Parent stats dashboard for this week                      |
| `POST /v1/ai/mark-short-answer`                                                                                                    | student device  | Mark a short answer (rules, then AI)                      |
| ---------------------------------------------------------------------------------------------------------------------------------- | --------------- | --------------------------------------------------------- |
| ---------------------------------------------------------------------------------------------------------------------------------- | --------------- | ---------------------------------------------------       |
| `POST /v1/student/items/:itemId/reports`, `POST /v1/items/:itemId/reports`                                                         | student, parent | Report a problem; hides the item at once                  |
| `GET /v1/review/me`, `GET /v1/review/reports`, `POST .../reports/:id/decision`                                                     | reviewer        | Reviewer role; reports; no error or confirmed error       |
| `GET, POST /v1/review/batches`, `GET .../batches/:id`, `POST .../batches/:id/items/:itemId/decision`                               | reviewer        | Batch samples and decisions                               |
| `GET, POST /v1/review/rechecks`, `POST .../rechecks/:id/done`, `GET /v1/review/recalculations`, `POST .../recalculations/:id/done` | reviewer        | Re-check requests and recalculation jobs                  |
| `GET, POST /v1/student/feedback`                                                                                                   | student device  | Own feedback and its status; send feedback                |
| `GET, POST /v1/feedback`                                                                                                           | parent          | The family's feedback; send feedback                      |
| `GET /v1/admin/feedback`, `PATCH /v1/admin/feedback/:id`                                                                           | operator        | Triage all feedback (404 for anyone else)                 |
| `GET, PUT /v1/policy-acceptances`                                                                                                  | parent          | Versions of the terms and privacy notice confirmed        |

A parent only ever sees their own family: another family's student answers 404. The QR code
holds `<web origin>/link?token=…&family=…`. The passkey relying party is the web app's host
(`PASSKEY_RP_ID`). Student sessions use the `__Host-rd_student` cookie (HttpOnly, Secure,
SameSite=Lax) and last 12 hours. Sign-in, device and AI routes are rate limited per address
(30 and 20 requests a minute) and answer 429 with `Retry-After`.

**Content in the database.** `pnpm --filter @revisionden/api content:sync` loads `content/` into
`topics` and `items` (keyed by `items.content_id`), keeping each item's verification status and
version. What a student may see is decided when items are served: only `verified`, plus drafts
with `SERVE_DRAFT_CONTENT=true` in development. Content type names `worked_maths` and
`extended_answer` are stored as the core item types `working` and `long_answer`.

## Conventions

- TypeScript strict everywhere; ESM; Node 22.
- Every request and response body has a Zod schema in `packages/core`.
- Time, randomness and AI clients are injected so code is testable.
