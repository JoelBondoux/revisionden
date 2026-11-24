# Testing protocol

> Live document. Every contributor (human or AI session) follows it. Change it by pull request.

## 1. Red, green, refactor (mandatory)

All behaviour is built test-first:

1. **Red:** write the smallest test that describes the next piece of behaviour. Run it and
   **see it fail for the right reason** (not a typo or missing import). Paste the failing
   output into the PR description or commit message body when it is not obvious.
2. **Green:** write the least code that makes it pass. Run the whole package's tests.
3. **Refactor:** tidy names and structure with all tests green. No new behaviour here.

Commit at green or after refactor, never at red on a shared branch. A bug fix starts with a test
that reproduces the bug.

## 2. Test layers

| Layer                 | Tool                                                              | Where            | Runs                          |
| --------------------- | ----------------------------------------------------------------- | ---------------- | ----------------------------- |
| Unit (pure logic)     | Vitest                                                            | `packages/core`  | Every push, every PR          |
| Unit (scripts)        | `node --test`                                                     | `scripts/`       | Every push, every PR          |
| Component             | Vitest + Testing Library                                          | `apps/web`       | Every push, every PR          |
| API integration       | Vitest + Hono `app.request`, Postgres via PGlite or a Neon branch | `apps/api`       | Every push, every PR          |
| Contract              | Shared Zod schemas used by both web and API                       | `packages/core`  | Every PR                      |
| Maths engine          | pytest                                                            | `services/maths` | Every push, every PR          |
| Content validation    | JSON Schema + answer checks (maths answers checked by the engine) | `content/`       | Every PR touching content     |
| End-to-end            | Playwright (phone, tablet, desktop viewports)                     | `e2e/`           | PRs into `staging` and `main` |
| Accessibility         | axe-core inside Playwright; WCAG 2.2 AA                           | `e2e/`           | PRs into `staging` and `main` |
| AI marking evaluation | Golden set of answers with known marks; tolerance ±1 level        | `evals/`         | Weekly and on prompt changes  |

## 3. Coverage gates

| Package          | Minimum lines and branches |
| ---------------- | -------------------------- |
| `packages/core`  | 90%                        |
| `apps/api`       | 80%                        |
| `apps/web`       | 70%                        |
| `services/maths` | 90%                        |

CI fails below the gate. Raising a gate is welcome; lowering one needs a reason in the PR.

## 4. Rules

- Tests describe behaviour in plain words (`moves up when the average beats the target boundary`).
- No real personal data in fixtures: use made-up nicknames and generic schools.
- Tests do not call real AI providers. Use recorded fixtures; the eval suite is the only place
  real models are called, and it is never run in CI by default.
- Time and randomness are injected so tests are repeatable.
- A flaky test is a bug: fix it or delete it the same day.

## 5. Running tests

```bash
pnpm install
pnpm test            # all TypeScript unit and component tests
pnpm test:coverage   # with coverage gates
pnpm test:scripts    # repo scripts, scripts/verify and the evals harness (fakes only)
UPDATE_SNAPSHOTS=1 node --test scripts/verify/audit.test.mjs   # refresh the audit snapshot
cd services/maths && pip install -r requirements-dev.txt && python -m pytest -q
```
