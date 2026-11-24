# Environments and set-up

> Live document. What each environment needs and the one-off set-up steps. Secret values are
> never written here or committed anywhere.

## Accounts (owned by the product owner)

| Service                                            | Used for                                     | Status                                     |
| -------------------------------------------------- | -------------------------------------------- | ------------------------------------------ |
| GitHub (`JoelBondoux/revisionden`, public for now) | Code, CI                                     | To create                                  |
| Cloudflare                                         | Domain, web hosting, Workers, R2, AI Gateway | Account exists; revisionden.com registered |
| Neon                                               | Postgres                                     | Account exists                             |
| Google Cloud                                       | Cloud Run (maths engine, content jobs)       | Account exists                             |
| Anthropic API                                      | Live AI                                      | To set up, with monthly limit              |
| OpenAI or Gemini API                               | Second checker, photo reading                | Optional                                   |

## Domains

`revisionden.com` (primary, registered with Cloudflare on 2026-11-24) and optionally `revisionden.co.uk` (not yet bought; would redirect to .com), registered with
Cloudflare Registrar, auto-renew on.

| Host                                                     | Environment |
| -------------------------------------------------------- | ----------- |
| `revisionden.com`, `api.revisionden.com`                 | Production  |
| `staging.revisionden.com`, `api-staging.revisionden.com` | Staging     |
| `dev.revisionden.com`, `api-dev.revisionden.com`         | Development |

## GitHub Actions secrets (added in repository settings, workstream G)

| Secret                                                  | Purpose                                            |
| ------------------------------------------------------- | -------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`                                  | Deploy Workers, pages and R2 config (scoped token) |
| `CLOUDFLARE_ACCOUNT_ID`                                 | Deploy target                                      |
| `NEON_API_KEY`                                          | Create and migrate Neon branches                   |
| `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT` | Deploy to Cloud Run without long-lived keys        |

## Worker secrets (set with `wrangler secret put`, per environment)

Set each with `pnpm --filter @revisionden/api exec wrangler secret put <NAME> --env <dev|staging|production>`.
Locally, copy `apps/api/.dev.vars.example` to `apps/api/.dev.vars` (git-ignored). The API checks
these on start-up and answers every request with a JSON 500 (`server_misconfigured`) naming
nothing secret if one is missing; the missing names are written to the Worker log.

| Secret                                           | Needed from | Notes                                                                 |
| ------------------------------------------------ | ----------- | --------------------------------------------------------------------- |
| `DATABASE_URL`                                   | B (now)     | Neon connection string for that environment's branch (London)         |
| `BETTER_AUTH_SECRET`                             | B (now)     | At least 32 random characters: `openssl rand -base64 32`; one per env |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`       | B (now)     | Google OAuth web client                                               |
| `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` | B (now)     | Microsoft Entra app, "personal and work accounts" (`common` tenant)   |
| `AI_GATEWAY_URL`                                 | B (now)     | `https://gateway.ai.cloudflare.com/v1/<account id>/<gateway>`         |
| `ANTHROPIC_API_KEY`                              | H (now)     | Live AI (Claude). Optional: AI routes answer 503 until it is set      |
| `OPENAI_API_KEY`                                 | H (now)     | Optional second checker through the gateway (see `AI_CHECKER_MODEL`)  |
| `AI_GATEWAY_TOKEN`                               | H (now)     | Optional: only if the AI Gateway is set to "authenticated"            |
| `MATHS_ENGINE_URL`                               | F (now)     | Cloud Run maths engine; without it worked maths answers get a 503     |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`          | H (now)     | Web push. Both or neither; reminders stay off until set (see below)   |

## Worker variables and bindings (in `apps/api/wrangler.toml`, not secret)

| Name                | dev                               | staging                               | production                       |
| ------------------- | --------------------------------- | ------------------------------------- | -------------------------------- |
| `ENVIRONMENT`       | `development`                     | `staging`                             | `production`                     |
| `API_ORIGIN`        | `https://api-dev.revisionden.com` | `https://api-staging.revisionden.com` | `https://api.revisionden.com`    |
| `WEB_ORIGIN`        | `https://dev.revisionden.com`     | `https://staging.revisionden.com`     | `https://revisionden.com`        |
| `PASSKEY_RP_ID`     | `dev.revisionden.com`             | `staging.revisionden.com`             | `revisionden.com`                |
| `UPLOADS` (R2)      | `revisionden-uploads-dev`         | `revisionden-uploads-staging`         | `revisionden-uploads-production` |
| `AUTH_RATE_LIMITER` | 30 a minute per address           | same                                  | same                             |
| `AI_RATE_LIMITER`   | 20 a minute per address           | same                                  | same                             |

Optional AI settings (workstream H), set as plain variables when needed:

| Name                 | Default | What it does                                                                |
| -------------------- | ------- | --------------------------------------------------------------------------- |
| `AI_MONTHLY_CAP_USD` | `2.50`  | AI spend cap per child per calendar month (UTC), in US dollars (about £2)   |
| `AI_CHECKER_MODEL`   | unset   | OpenAI model used as the second checker; off when unset                     |
| `AI_CHECKER_PRICES`  | unset   | Its prices, `input/output` US dollars per million tokens; needed with model |

Feedback triage (workstream L), set as a secret so no email is in the code:

| Name              | Default | What it does                                                                          |
| ----------------- | ------- | ------------------------------------------------------------------------------------- |
| `OPERATOR_EMAILS` | unset   | Comma-separated parent sign-in emails that may use `/admin/feedback`; none when unset |

Web build variables (workstream L), filled into the policies and About page at build:
`VITE_OPERATOR_NAME`, `VITE_CONTACT_EMAIL`, `VITE_POSTAL_ADDRESS`, `VITE_POLICY_EFFECTIVE_DATE`,
`VITE_ENVIRONMENT` and `VITE_COMMIT`. Without the operator details the pages say "contact details
to be added"; production builds must fail without them (workstream G).

**Cron trigger:** every 15 minutes (`[triggers] crons` in `wrangler.toml`) the Worker deletes
feedback closed more than 12 months ago, then sends due reminders. Reminders do nothing until
both VAPID keys are set.

**VAPID keys:** generate once per environment, for example with
`npx web-push generate-vapid-keys` (any tool that gives a P-256 key pair as base64url works:
the public key is the 65-byte uncompressed point, the private key the 32-byte scalar). Set both
with `wrangler secret put`. Changing the keys means every device has to turn reminders on again.

`SERVE_DRAFT_CONTENT` (workstream F) is off unless set to `true`, and only works when
`ENVIRONMENT` is `development`: staging and production never serve draft content, whatever it
says. Set it in `apps/api/.dev.vars` to try the pilot drafts locally; the app then shows a
"DRAFT CONTENT" banner. Load content into a database with
`DATABASE_URL=... pnpm --filter @revisionden/api content:sync`.

Local `wrangler dev` uses the top-level values (`localhost:8787` API, `localhost:5173` web).
The rate limiters use Cloudflare's Workers rate limiting binding; their `namespace_id` values are
our own numbers, not account ids.

## OAuth callback URLs

Register these in the Google and Microsoft apps (one app per provider can hold all three):

- `https://api-dev.revisionden.com/api/auth/callback/google` (and `/microsoft`)
- `https://api-staging.revisionden.com/api/auth/callback/google` (and `/microsoft`)
- `https://api.revisionden.com/api/auth/callback/google` (and `/microsoft`)

Scopes: email and profile only. The API keeps only the email: the name is blanked and the
picture is never fetched or stored.

## Database migrations

Migrations are generated from `packages/db/src/schema.ts` with
`pnpm --filter @revisionden/db db:generate` and applied with
`DATABASE_URL=<branch url> pnpm --filter @revisionden/db db:migrate` (workstream G will run this
from CI). Made-up seed data: `DATABASE_URL=<dev url> pnpm --filter @revisionden/db db:seed`.

## One-off set-up steps

1. Create the GitHub repository; push `main`, `staging`, `dev`.
2. Add branch protection to `main`, `staging`, `dev`: pull requests required, CI must pass.
3. ~~Buy the domains in Cloudflare.~~ Done for revisionden.com (2026-11-24); .co.uk optional.
4. Create the Neon project in the London region with branches `dev` and `staging` off `main`.
5. Create Google and Microsoft OAuth apps with callback URLs for each environment.
6. Create the Cloudflare AI Gateway and R2 buckets (one per environment, 24-hour lifecycle rule).
   In the gateway, keep logging on (we send `cf-aig-collect-log-payload: false`, so prompts and
   answers are never stored) and set a spend limit as a backstop to the per-child cap.
7. Create the Cloud Run service per environment (scale to zero) and workload identity for GitHub.
8. Add the secrets above.
9. Create the R2 buckets named above and apply the migrations to each Neon branch.
