# 0001: Technology stack

- Status: accepted
- Date: 2026-11-24

## Context

The product owner already uses Cloudflare, Google Cloud Run and Neon, and wants the lowest
possible running cost. The app must work on Android, iPad and desktop.

## Decision

- Installable web app (PWA): React + Vite, hosted on Cloudflare.
- API: Hono on Cloudflare Workers. Auth: Better Auth (open source, in our own account).
- Database: Neon Postgres, London region, Drizzle ORM, one Neon branch per environment.
- Uploads: Cloudflare R2 with auto-delete.
- Maths engine and batch content jobs: Python + SymPy on Cloud Run (scales to zero).
- AI: Anthropic (Claude Haiku 5.5 for quick feedback, Claude Opus 5.5 for marking long answers),
  with OpenAI or Gemini as the second checker; all through Cloudflare AI Gateway.
- Monorepo with pnpm workspaces; GitHub Actions for CI.

## Consequences

- Almost everything fits free plans; AI is the only variable cost.
- No app store fees or reviews; installing to the home screen is a manual step for users.
- Apple sign-in deferred (needs a paid Apple developer membership).
