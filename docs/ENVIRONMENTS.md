# Environments and set-up

> Live document. What each environment needs and the one-off set-up steps. Secret values are
> never written here or committed anywhere.

## Accounts (owned by the product owner)

| Service                                            | Used for                                     | Status                        |
| -------------------------------------------------- | -------------------------------------------- | ----------------------------- |
| GitHub (`JoelBondoux/revisionden`, public for now) | Code, CI                                     | To create                     |
| Cloudflare                                         | Domain, web hosting, Workers, R2, AI Gateway | Account exists; domain to buy |
| Neon                                               | Postgres                                     | Account exists                |
| Google Cloud                                       | Cloud Run (maths engine, content jobs)       | Account exists                |
| Anthropic API                                      | Live AI                                      | To set up, with monthly limit |
| OpenAI or Gemini API                               | Second checker, photo reading                | Optional                      |

## Domains

`revisionden.com` (primary) and `revisionden.co.uk` (redirects to .com), registered with
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

`DATABASE_URL`, `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `AI_GATEWAY_URL`, `ANTHROPIC_API_KEY`,
`MATHS_ENGINE_URL`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`.

## One-off set-up steps

1. Create the GitHub repository; push `main`, `staging`, `dev`.
2. Add branch protection to `main`, `staging`, `dev`: pull requests required, CI must pass.
3. Buy the domains in Cloudflare.
4. Create the Neon project in the London region with branches `dev` and `staging` off `main`.
5. Create Google and Microsoft OAuth apps with callback URLs for each environment.
6. Create the Cloudflare AI Gateway and R2 buckets (one per environment, 24-hour lifecycle rule).
7. Create the Cloud Run service per environment (scale to zero) and workload identity for GitHub.
8. Add the secrets above.
