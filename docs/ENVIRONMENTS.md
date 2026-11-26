# Environments and set-up

> Live document. What each environment needs and the one-off set-up steps. Secret values are
> never written here or committed anywhere.

## Accounts (owned by the product owner)

| Service                                            | Used for                                     | Status                                  |
| -------------------------------------------------- | -------------------------------------------- | --------------------------------------- |
| GitHub (`JoelBondoux/revisionden`, public for now) | Code, CI                                     | In use; deploy secrets to add (below)   |
| Cloudflare                                         | Domain, web hosting, Workers, R2, AI Gateway | In use: Workers, R2 and gateway created |
| Neon                                               | Postgres                                     | In use: project `revisionden` (London)  |
| Google Cloud                                       | Cloud Run (maths engine, content jobs)       | Account exists; not set up (G3)         |
| Anthropic API                                      | Live AI                                      | To set up, with monthly limit           |
| OpenAI or Gemini API                               | Second checker, photo reading                | Optional                                |

## Domains

`revisionden.com` (primary, registered with Cloudflare on 2026-11-24) and optionally `revisionden.co.uk` (not yet bought; would redirect to .com), registered with
Cloudflare Registrar, auto-renew on.

| Host                                                     | Environment                                   |
| -------------------------------------------------------- | --------------------------------------------- |
| `revisionden.com` (`www.` redirects to it)               | Public sales site, production (decision 0005) |
| `www-staging.revisionden.com`                            | Public sales site, staging (not indexed)      |
| `app.revisionden.com`, `api.revisionden.com`             | Production app and API                        |
| `staging.revisionden.com`, `api-staging.revisionden.com` | Staging                                       |
| `dev.revisionden.com`, `api-dev.revisionden.com`         | Development                                   |

Until workstream G moves it, the app's production Worker is still configured for
`revisionden.com` (`apps/web/wrangler.toml`); it moves to `app.revisionden.com` before the public
site's first production deploy.

| Host                                                     | Environment |
| -------------------------------------------------------- | ----------- |
| `app.revisionden.com`, `api.revisionden.com`             | Production  |
| `staging.revisionden.com`, `api-staging.revisionden.com` | Staging     |
| `dev.revisionden.com`, `api-dev.revisionden.com`         | Development |

The bare `revisionden.com` is the public sales site (workstream M, `apps/www`); the app never
runs there. G creates nothing on the apex.

## What is live (workstream G, 2026-11-25)

Every resource is named `revisionden` or starts `revisionden-` (decision 0003). No ids here.

| Piece          | Development                     | Staging                         | Production                       |
| -------------- | ------------------------------- | ------------------------------- | -------------------------------- |
| Neon branch    | `dev`                           | `staging`                       | `main`                           |
| Migrations     | 0000–0005 applied               | 0000–0005 applied               | 0000–0005 applied                |
| R2 bucket (EU) | `revisionden-uploads-dev`       | `revisionden-uploads-staging`   | `revisionden-uploads-production` |
| API Worker     | `revisionden-api-dev`           | `revisionden-api-staging`       | `revisionden-api`                |
| API host       | `api-dev.revisionden.com`       | `api-staging.revisionden.com`   | `api.revisionden.com`            |
| Web Worker     | `revisionden-web-dev`           | `revisionden-web-staging`       | `revisionden-web` (not yet)      |
| Web host       | `dev.revisionden.com`           | `staging.revisionden.com`       | `app.revisionden.com` (not yet)  |
| `/health`      | `misconfigured` (OAuth missing) | `misconfigured` (OAuth missing) | `misconfigured` (OAuth missing)  |

- Neon project `revisionden`, region `aws-eu-west-2` (London), Postgres 17, database
  `revisionden`, owner role `revisionden_owner`. `staging` and `dev` were branched from `main`
  before any data was added.
- R2 buckets are in the EU jurisdiction (so wrangler binds them with `jurisdiction = "eu"`), each
  with the rule `delete-after-24-hours` (objects and unfinished multipart uploads).
- AI Gateway `revisionden`: authentication on (Cloudflare now requires it for new gateways),
  logging on, cache off, rate limit 120 a minute. The API sends `cf-aig-collect-log-payload: false`,
  so prompts and answers are never stored.
- The production web app is not deployed yet: its build fails until the operator details exist.
- The first web deploys of dev and staging were made from a cloud session whose network proxy
  cannot upload Workers static assets, so they bundle the files into the Worker script instead.
  The first GitHub Actions deploy replaces them with the normal static-assets Worker
  (`apps/web/wrangler.toml`); nothing else changes.
- The production API's cron (then every 15 minutes) did not register on the first deploy (Cloudflare said the
  trigger update was only partly applied; the account's other projects may already use the free
  plan's cron triggers). The first production deploy from GitHub Actions retries it; if it fails
  again, free a cron trigger or move to Workers Paid. Without it, reminders and the 12-month
  feedback clean-up do not run in production.

## Still needed from the product owner

Generated and already set on each API Worker: `DATABASE_URL`, `BETTER_AUTH_SECRET`,
`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `AI_GATEWAY_URL`.

| Worker secret or variable                        | dev | staging | production | Effect until set                                                                             |
| ------------------------------------------------ | --- | ------- | ---------- | -------------------------------------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`       | ✗   | ✗       | ✗          | One provider required: until one is set, every API route except `/health` gives 500          |
| `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` | ✗   | ✗       | ✗          | Optional once Google is set: the sign-in page hides it                                       |
| `ANTHROPIC_API_KEY`                              | ✗   | ✗       | ✗          | AI routes answer 503                                                                         |
| `AI_GATEWAY_TOKEN`                               | ✗   | ✗       | ✗          | AI calls are refused by the authenticated gateway                                            |
| `OPERATOR_EMAILS`                                | ✗   | ✗       | ✗          | Nobody can open `/admin/feedback`                                                            |
| `APPDECK_OPERATOR_SHARED_SECRET`                 | ✗   | ✗       | ✗          | The AppDeck operator bridge (`/operator/appdeck`) answers 503; set the same value in AppDeck |
| `MATHS_ENGINE_URL`                               | ✗   | ✗       | ✗          | Worked maths answers get 503 (needs G3)                                                      |
| `OPENAI_API_KEY` (optional)                      | –   | –       | –          | No second checker                                                                            |

Set each with
`pnpm --filter @revisionden/api exec wrangler secret put <NAME> --env <dev|staging|production>`
(it asks for the value, so it never appears in your shell history). `AI_GATEWAY_TOKEN` is a
Cloudflare API token with the "AI Gateway: Run" permission (dashboard: AI, AI Gateway,
`revisionden`, Settings, Authentication, Create authentication token).

Web build variables for production (GitHub environment `production`, Variables):
`VITE_OPERATOR_NAME`, `VITE_CONTACT_EMAIL`, `VITE_POLICY_EFFECTIVE_DATE` (required: the build
fails without them). `VITE_OPERATOR_NAME` is the agreed value (held by the product owner); `VITE_CONTACT_EMAIL` =
`privacy@revisionden.com`; leave `VITE_POLICY_EFFECTIVE_DATE` unset until launch.
`VITE_POSTAL_ADDRESS` is not used. Dev and staging may leave them unset
and show "to be added". `VITE_SUPPORT_EMAIL` is optional everywhere: the help inbox shown on the
About page, the feedback form and some policies, `help@revisionden.com` when unset.

## Deploys from GitHub Actions

Workflows: `deploy-dev.yml` (push to `dev`), `deploy-staging.yml` (push to `staging`),
`deploy-production.yml` (after "Release version bump" succeeds on `main`, or by hand); all call
`deploy.yml`, which migrates the Neon branch (`db:migrate:deploy`, over HTTPS), loads `content/`
into it (`content:sync`; dev and staging only), deploys the API
Worker with the version from `VERSION`, builds and deploys the web app, then checks `/health`
(`scripts/check-deploy.mjs`). Each can also be run by hand from the Actions tab.

Why GitHub Actions and not Cloudflare Workers Builds: Workers Builds would need six build
triggers (two Workers, three environments) set up by hand in the dashboard, because the shared
token cannot manage builds, and it has no good place for migrations or the production-after-bump
order. With Actions the owner adds five secrets once. A session cannot add them: it can neither
read the Cloudflare token nor write GitHub Actions secrets.

| GitHub secret           | Where                                                | Value                                          |
| ----------------------- | ---------------------------------------------------- | ---------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Repository secret                                    | New token just for RevisionDen (step 1)        |
| `CLOUDFLARE_ACCOUNT_ID` | Repository secret                                    | Cloudflare dashboard, account home, Account ID |
| `DATABASE_URL`          | Environment secret in `dev`, `staging`, `production` | That Neon branch's pooled connection string    |

Step by step (about 15 minutes):

1. **Cloudflare token.** Dashboard, My Profile, API Tokens, Create Token, "Edit Cloudflare
   Workers" template. Account resources: your account only. Zone resources: Specific zone,
   `revisionden.com`. Keep the template's permissions (Workers Scripts, Workers Routes, Workers
   KV, account settings read, and so on) and add **Account: Workers R2 Storage: Edit** and
   **Zone: DNS: Edit** (for the custom domains). Name it
   `revisionden-github-deploy`. Copy the token once.
2. **GitHub repository secrets.** Repository, Settings, Secrets and variables, Actions, New
   repository secret: `CLOUDFLARE_API_TOKEN` (the token) and `CLOUDFLARE_ACCOUNT_ID`.
3. **GitHub environments.** Settings, Environments, New environment: `dev`, `staging`,
   `production` (the first deploy may already have made them). For `production`, add yourself as
   a required reviewer if you want to approve each live deploy, and limit it to the `main` branch.
4. **Database URLs.** Neon console, project `revisionden`, Connect: pick the branch (`dev`,
   `staging`, `main`), database `revisionden`, role `revisionden_owner`, "Connection pooling" on,
   copy the URL. In each GitHub environment add the secret `DATABASE_URL` (`main` goes in
   `production`).
5. **Production variables.** Environment `production`, Variables: `VITE_OPERATOR_NAME`
   (the agreed value, held by the product owner) and `VITE_CONTACT_EMAIL` (`privacy@revisionden.com`). Add
   `VITE_POLICY_EFFECTIVE_DATE` (for example `2026-12-01`) only when production launches; until
   then the production web build fails on purpose. Setting the same two in `dev` and `staging` is
   optional (they show "to be added" without them).
6. **Contact inboxes (done, 2026-11-25).** `privacy@revisionden.com` (privacy and data rights)
   and `help@revisionden.com` (help and support) forward to the product owner's inbox with
   Cloudflare Email Routing on the `revisionden.com` zone (a session must not set this up: it
   needs the owner's inbox address).
7. **First run.** Actions, "Deploy dev", Run workflow. It should end with "API is on
   <version>; some secrets still missing" until the OAuth secrets are set.

## Public site deploys (workstream M, decision 0005)

`deploy-www.yml` builds `apps/www` and deploys its Worker. It runs as its own job in
`deploy-staging.yml` (`revisionden-www-staging` on `www-staging.revisionden.com`) and
`deploy-production.yml` (`revisionden-www` on `revisionden.com` and `www.revisionden.com`), then
checks the home page answers. Not live yet: it waits for the GitHub secrets above and, for
production, for the app to move to `app.revisionden.com`.

| Build variable               | staging                               | production                    | Notes                                                                             |
| ---------------------------- | ------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------- |
| `WWW_ENVIRONMENT`            | `staging`                             | `production`                  | Set by the workflow                                                               |
| `WWW_LAUNCHED`               | unset                                 | unset until launch            | GitHub variable; `true` drops "in private testing" and the policies' draft banner |
| `WWW_APP_URL`                | `https://staging.revisionden.com`     | `https://app.revisionden.com` | Defaults; "Sign in" and "Start free" go here                                      |
| `WWW_SITE_URL`               | `https://www-staging.revisionden.com` | `https://revisionden.com`     | Defaults; canonical links, sitemap, Open Graph                                    |
| `VITE_OPERATOR_NAME`         | optional                              | **required**                  | Same GitHub environment variable as the web app                                   |
| `VITE_CONTACT_EMAIL`         | optional                              | **required**                  | `privacy@revisionden.com`                                                         |
| `VITE_SUPPORT_EMAIL`         | optional                              | optional                      | `help@revisionden.com` when unset                                                 |
| `VITE_POLICY_EFFECTIVE_DATE` | optional                              | optional                      | Policies show "date to be added" until set                                        |

Local build: `pnpm --filter @revisionden/www build` (staging settings), then open `apps/www/dist`
with any static server, or `pnpm --filter @revisionden/www exec wrangler dev`.

## Maths engine on Cloud Run (G3, not set up yet)

`.github/workflows/deploy-maths.yml` deploys `services/maths` to Cloud Run (`europe-west2`,
London, scale to zero) as `revisionden-maths-dev`, `revisionden-maths-staging` and
`revisionden-maths`. It only runs by hand and only when the repository variable
`MATHS_DEPLOY_ENABLED` is `true`. The owner needs to:

1. Create (or pick) a Google Cloud project and enable Cloud Run, Cloud Build and Artifact
   Registry; add the repository variable `GCP_PROJECT_ID`.
2. Create a service account `revisionden-deployer` with Cloud Run Admin, Cloud Build Editor,
   Artifact Registry Writer, Service Account User and Storage Admin (source deploys).
3. Create a workload identity pool and GitHub provider limited to this repository, allow it to
   impersonate the service account, and add the secrets `GCP_WORKLOAD_IDENTITY_PROVIDER` and
   `GCP_SERVICE_ACCOUNT`.
4. Set `MATHS_DEPLOY_ENABLED` to `true`, run the workflow for each environment, and set the URL
   it prints as `MATHS_ENGINE_URL` on that API Worker.

The service is public because the API calls it without credentials today; making it private
(ID tokens from the Worker) is a later change in `apps/api/src/learning/maths-engine.ts`.

## Worker secrets (set with `wrangler secret put`, per environment)

Set each with `pnpm --filter @revisionden/api exec wrangler secret put <NAME> --env <dev|staging|production>`.
Locally, copy `apps/api/.dev.vars.example` to `apps/api/.dev.vars` (git-ignored). The API checks
these on start-up and answers every request with a JSON 500 (`server_misconfigured`) naming
nothing secret if one is missing; the missing names are written to the Worker log.

| Secret                                           | Needed from | Notes                                                                 |
| ------------------------------------------------ | ----------- | --------------------------------------------------------------------- |
| `DATABASE_URL`                                   | B (now)     | Neon connection string for that environment's branch (London)         |
| `BETTER_AUTH_SECRET`                             | B (now)     | At least 32 random characters: `openssl rand -base64 32`; one per env |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`       | B (now)     | Google OAuth web client. Id and secret together                       |
| `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` | B (now)     | Microsoft Entra app (`common` tenant). Optional if Google is set      |
| `AI_GATEWAY_URL`                                 | B (now)     | `https://gateway.ai.cloudflare.com/v1/<account id>/<gateway>`         |
| `ANTHROPIC_API_KEY`                              | H (now)     | Live AI (Claude). Optional: AI routes answer 503 until it is set      |
| `OPENAI_API_KEY`                                 | H (now)     | Optional second checker through the gateway (see `AI_CHECKER_MODEL`)  |
| `AI_GATEWAY_TOKEN`                               | H (now)     | Optional: only if the AI Gateway is set to "authenticated"            |
| `MATHS_ENGINE_URL`                               | F (now)     | Cloud Run maths engine; without it worked maths answers get a 503     |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`          | H (now)     | Web push. Both or neither; reminders stay off until set (see below)   |
| `APPDECK_OPERATOR_SHARED_SECRET`                 | O (now)     | AppDeck operator bridge; 32+ characters, a different one per env      |

At least one sign-in provider (Google or Microsoft, each with its id and secret) is needed;
the other is optional. `GET /v1/auth/providers` tells the sign-in page which buttons to show, and
`/health` says `ok` once one provider and the generated secrets are set.

## Worker variables and bindings (in `apps/api/wrangler.toml`, not secret)

| Name                    | dev                                | staging                               | production                       |
| ----------------------- | ---------------------------------- | ------------------------------------- | -------------------------------- |
| `ENVIRONMENT`           | `development`                      | `staging`                             | `production`                     |
| `API_ORIGIN`            | `https://api-dev.revisionden.com`  | `https://api-staging.revisionden.com` | `https://api.revisionden.com`    |
| `WEB_ORIGIN`            | `https://dev.revisionden.com`      | `https://staging.revisionden.com`     | `https://app.revisionden.com`    |
| `PASSKEY_RP_ID`         | `dev.revisionden.com`              | `staging.revisionden.com`             | `revisionden.com`                |
| `UPLOADS` (R2, EU)      | `revisionden-uploads-dev`          | `revisionden-uploads-staging`         | `revisionden-uploads-production` |
| `AUTH_RATE_LIMITER`     | 30 a minute per address            | same                                  | same                             |
| `AI_RATE_LIMITER`       | 20 a minute per address            | same                                  | same                             |
| `OPERATOR_RATE_LIMITER` | 120 a minute per address (AppDeck) | same                                  | same                             |

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
`VITE_OPERATOR_NAME`, `VITE_CONTACT_EMAIL` (`privacy@revisionden.com`), `VITE_POLICY_EFFECTIVE_DATE`
(`VITE_POSTAL_ADDRESS` optional, not used), `VITE_ENVIRONMENT` and `VITE_COMMIT`, plus
`VITE_API_URL` (the API host). Without the operator details the pages say "contact details to be
added"; a production build (`VITE_ENVIRONMENT=production`) fails without `VITE_OPERATOR_NAME`,
`VITE_CONTACT_EMAIL` and `VITE_POLICY_EFFECTIVE_DATE`
(`apps/web/src/features/legal/productionGuard.ts`).

**Cron triggers (production only):** Neon suspends an idle database after 5 minutes, so every
tick that opens it wakes it. Dev, staging and local have `crons = []` (an explicit empty list: Cloudflare
keeps a deployed cron when `[triggers]` is left out, and only an empty list removes it). Production
has, in UTC, one clean-up a day at 03:17 (`apps/api/src/cleanup.ts`: expired link codes, sessions,
passkey challenges and sign-in checks; feedback closed more than 12 months ago; families unused
for 12 months) and reminders every 30 minutes from 06:30 to 20:30 (UK waking hours in GMT and BST).
The schedules live in `apps/api/src/crons.ts` and `wrangler.toml`. Reminders do nothing, and do not
open the database, until both VAPID keys are set. Expired data in dev and staging is not
cleaned up unless you run `wrangler dev --test-scheduled`.

**VAPID keys:** generate once per environment, for example with
`npx web-push generate-vapid-keys` (any tool that gives a P-256 key pair as base64url works:
the public key is the 65-byte uncompressed point, the private key the 32-byte scalar). Set both
with `wrangler secret put`. Changing the keys means every device has to turn reminders on again.

`SERVE_DRAFT_CONTENT` (workstream F) is off unless set to `true`, and only works when
`ENVIRONMENT` is `development`: staging and production never serve draft content, whatever it
says. The dev Worker sets it to `true` in `apps/api/wrangler.toml` (`[env.dev.vars]`) so the family
can try the pilot drafts on dev.revisionden.com; a config test fails if staging or production set
it. Set it in `apps/api/.dev.vars` to try the drafts locally; the app then shows a
"DRAFT CONTENT" banner. Load content into a database with
`DATABASE_URL=... pnpm --filter @revisionden/api content:sync`.

`STYLE_TESTER` (workstream J) works the same way: off unless `true`, and only when `ENVIRONMENT`
is `development`. The dev Worker sets it so testers see "Tester: try any style" in Settings →
Effect style (any effect style and theme, nothing unlocked for real); a config test fails if
staging or production set it.

Local `wrangler dev` uses the top-level values (`localhost:8787` API, `localhost:5173` web).
The rate limiters use Cloudflare's Workers rate limiting binding; their `namespace_id` values are
our own numbers, not account ids.

## OAuth callback URLs

Register these in the Google and Microsoft apps (one app per provider can hold all three):

- `https://api-dev.revisionden.com/api/auth/callback/google` (and `/microsoft`)
- `https://api-staging.revisionden.com/api/auth/callback/google` (and `/microsoft`)
- `https://api.revisionden.com/api/auth/callback/google` (and `/microsoft`)

The callback is on the API host, not the app host, so moving the production app to
`app.revisionden.com` changes nothing in Google or Microsoft. After sign-in the API sends the
browser back to `WEB_ORIGIN`, which is also Better Auth's only trusted origin.

Production passkeys use the RP ID `revisionden.com` (the registrable domain). WebAuthn accepts it
from `app.revisionden.com`, and passkeys keep working if the app ever moves to another subdomain.
Dev and staging keep their own host as the RP ID, so their passkeys never mix with production's.

Scopes: email and profile only. The API keeps only the email: the name is blanked and the
picture is never fetched or stored.

## Database migrations

Migrations are generated from `packages/db/src/schema.ts` with
`pnpm --filter @revisionden/db db:generate` and applied with
`DATABASE_URL=<branch url> pnpm --filter @revisionden/db db:migrate`. Deploys run
`pnpm --filter @revisionden/db db:migrate:deploy` instead, which uses Neon's HTTPS driver (no
Postgres port or WebSocket needed) and the same migrations table, so the two can be mixed. Made-up seed data: `DATABASE_URL=<dev url> pnpm --filter @revisionden/db db:seed`.

## One-off set-up steps

1. ~~Create the GitHub repository; push `main`, `staging`, `dev`.~~ Done.
2. Add branch protection to `main`, `staging`, `dev`: pull requests required, CI must pass
   (and "End-to-end and accessibility" for `staging` and `main`).
3. ~~Buy the domains in Cloudflare.~~ Done for revisionden.com (2026-11-24); .co.uk optional.
4. ~~Create the Neon project in the London region with branches `dev` and `staging` off `main`.~~
   Done (G, 2026-11-25).
5. Create Google and Microsoft OAuth apps with callback URLs for each environment.
6. ~~Create the Cloudflare AI Gateway and R2 buckets.~~ Done (G). Still to do in the dashboard:
   set a spend limit on the gateway as a backstop to the per-child cap, and create the gateway
   token (`AI_GATEWAY_TOKEN`).
7. Create the Cloud Run service per environment (see "Maths engine on Cloud Run").
8. Add the secrets in "Still needed from the product owner" and "Deploys from GitHub Actions".
9. ~~Create the R2 buckets and apply the migrations to each Neon branch.~~ Done (G).
