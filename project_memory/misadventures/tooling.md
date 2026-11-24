# Tooling misadventures

Tags: #tooling #ci

- **`node --test scripts/` fails** with "Cannot find module" on Node 22 when given a directory.
  Use a glob: `node --test scripts/*.test.mjs`. Also: a failure from a bad invocation is not a
  real "red" step; check the failure message is about the behaviour under test.
- **`gh auth status` reports an invalid token in Claude cloud sessions, but the CLI still works.**
  The session's token is a placeholder that the network proxy swaps for real credentials, so the
  status check fails while REST calls succeed. GraphQL is blocked, which breaks `gh pr create` and
  `gh pr list`. Use the REST API instead, e.g.
  `gh api repos/JoelBondoux/revisionden/pulls -f title='...' -f head='feature/x' -f base='dev' -f body='...'`
  and `gh api repos/JoelBondoux/revisionden/pulls?state=open`.
- **`pnpm add` leaves `pnpm-lock.yaml` failing `pnpm format:check`.** pnpm writes the lockfile in
  its own style and Prettier checks it. Run `npx prettier --write pnpm-lock.yaml` after changing
  dependencies (pnpm still reads it), or add the lockfile to a root `.prettierignore`.
- **Vitest returns an empty string for `import css from './file.css?raw'`.** Read the file with
  `readFileSync(join(__dirname, 'file.css'))` instead; `new URL(..., import.meta.url)` fails
  under jsdom because the URL is not `file:`.
- **`new Request(url, { mode: 'navigate' })` throws in Node.** To test a service worker's page
  handling, pass a plain object `{ url, method: 'GET', mode: 'navigate' }` instead.
- **The root ESLint config has no `react-hooks` plugin**, so an
  `eslint-disable react-hooks/...` comment is itself a lint error.
- **`docker build` in a Claude cloud session fails pip installs with "certificate verify
  failed"** because the session proxy re-signs TLS. This is sandbox-only (CI is fine). For a
  local check, build a throwaway Dockerfile copy that trusts `/root/.ccr/ca-bundle.crt` via
  `PIP_CERT`; do not commit that change. The Docker daemon may also need starting
  (`sudo dockerd &`).
