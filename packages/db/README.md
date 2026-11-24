# @revisionden/db

Drizzle schema, migrations and made-up seed data for Neon Postgres. Owned by workstream B (see
`docs/WORKSTREAMS.md`). The data model is described in `docs/ARCHITECTURE.md`.

- `src/schema.ts`: every table. Never add a column for a student's real name, birth date, email,
  photo or school name; `src/schema-guard.test.ts` fails if you do.
- `migrations/`: generated SQL. After changing the schema run `pnpm db:generate` and commit the
  new migration.
- `src/testing.ts`: `createTestDb()` gives a migrated in-process Postgres (PGlite) for tests, so
  CI needs no database.
- `src/neon.ts`: `createNeonDatabase(url)` for the Worker (Neon HTTP driver).

```bash
pnpm --filter @revisionden/db test
DATABASE_URL=... pnpm --filter @revisionden/db db:migrate
DATABASE_URL=... pnpm --filter @revisionden/db db:seed
```
