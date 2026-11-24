# RevisionDen

A family revision tutor for GCSE and A-Level students: it finds weak spots, plans revision around
exams and keeps students motivated with streaks, rewards and a friendly fox called Pip.

- Version: see [`VERSION`](VERSION) (format `xx.xx.xxx`)
- Plan: [`docs/PLAN.md`](docs/PLAN.md)
- How we test: [`docs/TESTING.md`](docs/TESTING.md)
- Branches and releases: [`docs/BRANCHING.md`](docs/BRANCHING.md)
- Architecture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Privacy: [`docs/PRIVACY.md`](docs/PRIVACY.md)
- Who is building what: [`docs/WORKSTREAMS.md`](docs/WORKSTREAMS.md)
- Changes: [`CHANGELOG.md`](CHANGELOG.md)

## Quick start

```bash
pnpm install
pnpm test
pnpm --filter @revisionden/web dev
```

Maths engine:

```bash
cd services/maths
pip install -r requirements-dev.txt
python -m pytest -q
```

## Layout

| Path             | What it is                                                         |
| ---------------- | ------------------------------------------------------------------ |
| `apps/web`       | Installable web app (React + Vite)                                 |
| `apps/api`       | API on Cloudflare Workers (Hono)                                   |
| `packages/core`  | Domain rules with tests (feedback levels, streaks, mastery, plans) |
| `packages/db`    | Database schema and migrations (Neon Postgres)                     |
| `services/maths` | Maths engine (Python + SymPy) for Google Cloud Run                 |
| `content`        | Topic trees and question banks                                     |
| `docs`           | Live documentation                                                 |
