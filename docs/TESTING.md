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
pnpm --filter @revisionden/web build && pnpm --filter @revisionden/e2e e2e   # end-to-end + axe
E2E_BASE_URL=https://dev.revisionden.com pnpm --filter @revisionden/e2e e2e  # against a live site
E2E_BASE_URL=https://staging.revisionden.com pnpm --filter @revisionden/e2e smoke  # deployed smoke
E2E_BASE_URL=https://staging.revisionden.com E2E_WWW_URL=https://www-staging.revisionden.com pnpm --filter @revisionden/e2e smoke  # plus the public site
UPDATE_ROUTES=1 pnpm --filter @revisionden/api test   # refresh apps/api/routes.json after a route change
```

**Mocks mirror the real API.** `apps/api/routes.json` lists every real route (generated from the
Hono app; its test fails when it is out of date). Web tests fail if an MSW handler, shared or set
by one test, names a route that is not in it (`apps/web/src/test/apiRoutes.ts`), except the few in
`PENDING_ROUTES` that another workstream has agreed but not built.

**Deployed smoke test** (`e2e/smoke`, `pnpm --filter @revisionden/e2e smoke`): health ok, Google
offered, Google sign-in starts with the right callback (stops before Google), the parent family
route exists and refuses a signed-out request with a reference code, policy pages, the Google
button, the signed-out `/family` prompt, and that `/`, `/family`, `/legal`, a policy and `/about`
request nothing from third parties (only the web origin and its API host; it caught Cloudflare's
injected Web Analytics beacon on staging, 2026-11-25). The local suite checks the same for the
built app. It signs nobody in: there is no test backdoor. With `E2E_WWW_URL` set it also checks the
public site (`apps/www`) requests nothing from other origins and sends its content security policy;
`apps/www`'s own tests check every built page for third-party resources and broken links.
Still checked by a person after each staging deploy: signing in with Google and landing on
"Who's revising?", adding a child, linking a device with the QR code and passkey, and the
student using the app on that device.

End-to-end tests (`e2e/tests`) run at phone (390×844), tablet (820×1180) and desktop (1280×800)
in Chromium, fail on any axe WCAG 2.2 A/AA violation or sideways scrolling, and always run with
`--trace off` (turn traces on only to debug one test). Without `E2E_BASE_URL` they serve the built
app with `vite preview`. CI: `.github/workflows/e2e.yml`.
Passkey tests use Chromium's virtual authenticator (CDP `WebAuthn.addVirtualAuthenticator`):
one holding a generated passkey for the page's host checks the real unlock prompt, and an empty
one checks the "Ask a parent to link this device" message. The API is stubbed with `page.route`.
