# @revisionden/api

Hono API on Cloudflare Workers: parent sign-in (Better Auth: Google, Microsoft), families,
students, enrolments, student device linking (one-time QR token, then a passkey) and rate limits.
Routes and data model: `docs/ARCHITECTURE.md`. Secrets and bindings: `docs/ENVIRONMENTS.md`.

```bash
cp .dev.vars.example .dev.vars   # fill in; never commit
pnpm --filter @revisionden/api dev
pnpm --filter @revisionden/api test:coverage   # PGlite, no database or network needed
pnpm --filter @revisionden/api check:bundle    # wrangler dry-run build
```

Tests sign parents in by writing a Better Auth session directly (`src/test/helpers.ts`) and drive
passkeys with a software authenticator (`src/test/soft-authenticator.ts`), so the real WebAuthn
checks run without a browser.
