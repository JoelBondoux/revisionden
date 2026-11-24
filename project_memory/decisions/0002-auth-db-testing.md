# 0002: Parent sign-in, student devices and database tests

- Status: accepted
- Date: 2026-11-24

## Context

Parents sign in with Google or Microsoft and no passwords are allowed anywhere. Students have no
outside account. CI runs on free minutes and must not need a real database.

## Decision

- Parent sign-in: Better Auth inside our Worker, tables `auth_*` in Neon via the Drizzle adapter.
  Email and password sign-in is off. A database hook blanks the provider's name and picture and
  drops IP address and user agent, so only the sign-in email is kept.
- Student devices: not Better Auth users. A parent issues a one-time link token (10 minutes,
  single use, stored hashed); the device registers a WebAuthn passkey checked with SimpleWebAuthn
  and gets its own 12-hour session (`student_sessions`, cookie `__Host-rd_student`). The web app
  host is the passkey relying party.
- Database driver: Neon serverless HTTP driver in Workers (no TCP, no Hyperdrive needed yet).
- Tests: PGlite (Postgres compiled to WebAssembly, in-process) with the real migrations, so CI
  needs no database. Sign-in is tested end to end with the provider token endpoint stubbed;
  passkeys with a software authenticator so the real WebAuthn checks run.
- Rate limits: Cloudflare Workers rate limiting binding in deployed environments, an in-memory
  limiter with the same interface locally and in tests.

## Consequences

- No third-party auth service or per-user cost; we own the session data.
- Better Auth's schema requires `name` and `image` columns on `auth_users`; they stay blank and are
  allowlisted in the privacy schema guard.
- The Neon HTTP driver has no interactive transactions; single-use steps are written as one
  conditional `UPDATE … RETURNING` instead.
- PGlite matches Postgres closely but is single-connection; real concurrency is only approximated.
