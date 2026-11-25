# 0005: Domains and the public sales site

- Status: accepted (product owner, 2026-11-25)
- Date: 2026-11-25

## Context

`revisionden.com` was planned as the production web app. The product owner wants a public
website on the main domain that explains RevisionDen to parents and young people, shows the
planned prices and links to the policies, with the app on its own host.

## Decision

- **`revisionden.com`** is the public sales site; **`www.revisionden.com`** redirects (301) to it,
  keeping the path.
- **`app.revisionden.com`** is the production app (workstream G moves it). `api.revisionden.com` is
  unchanged. `dev.revisionden.com` and `staging.revisionden.com` stay as the app's test hosts.
- The site has a staging copy on **`www-staging.revisionden.com`** (kept out of search engines).
  There is no dev copy.
- **Stack (workstream M):** `apps/www`, a plain TypeScript static site generator with no
  framework and no client-side JavaScript. Pages are pure functions that return HTML;
  `node src/build.ts` (Node 22's built-in TypeScript support, so no extra build tool) writes
  `apps/www/dist`. Chosen over Astro to keep dependencies and page weight to a minimum and to
  make every page testable as a string.
- **Hosting:** Cloudflare Workers with static assets: `revisionden-www` (production, apex and
  www) and `revisionden-www-staging`. A tiny Worker does the www redirect and adds security
  headers (a content security policy that allows only the site itself).
- **No third-party requests:** fonts are self-hosted (Nunito from `@fontsource/nunito`); no
  analytics, trackers, embeds or CDN scripts. Tests and the content security policy enforce it.
- **One source:** the design tokens are read from `apps/web/src/design/tokens.css` and the
  policies from `docs/legal/*.md` at build time; neither is copied.
- **Build variables:** `WWW_ENVIRONMENT` (`staging` or `production`), optional `WWW_APP_URL` and
  `WWW_SITE_URL`; the operator details use the web app's names (`VITE_OPERATOR_NAME`,
  `VITE_CONTACT_EMAIL`, `VITE_SUPPORT_EMAIL`, `VITE_POLICY_EFFECTIVE_DATE`) so the GitHub
  environment variables are shared. A production build fails without the operator name and
  contact email; the trading name is never committed (decision 0003).
- "Sign in" and "Start free" go to `https://app.revisionden.com` (staging:
  `https://staging.revisionden.com`).

## Consequences

- The web app's production Worker must move from `revisionden.com` to `app.revisionden.com`
  (workstream G) before the site's first production deploy, or the two custom domains clash.
- The API's production `WEB_ORIGIN` and `PASSKEY_RP_ID`, and the OAuth callback set-up, follow the
  app to `app.revisionden.com` (workstream G).
- Deploys: `.github/workflows/deploy-www.yml`, called from the staging and production deploy
  workflows as its own job. It needs only the two Cloudflare repository secrets.
- Everything the site says follows the product rules: features exist on dev or are marked
  "coming soon"; prices only from `docs/PRICING.md` and decision 0004, shown as "Premium, coming
  soon"; no testimonials, user counts, awards, endorsements or grade claims.
