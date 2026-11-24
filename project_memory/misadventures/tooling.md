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
- **A file-writing tool turned `\u00a0`-style escapes into the real characters**, which ESLint
  rejects (`no-irregular-whitespace`, `no-misleading-character-class`). Write invisible or
  special characters as escapes from a script, quote object keys (`'\ufb01': 'fi'`), and use
  alternation rather than a character class for joiners (`/\u200b|\u200d/`).
- **PDF text has spacing artefacts and repeated text.** pdf.js gives "( including", "formula ;",
  "variable (s)" and "n th" (superscript), and the Pearson 1MA1 specification repeats most
  Higher-tier text in the Foundation section. The quote checker first matched only the first copy
  and failed 9 of 13 sourced pilot quotes; it now ignores punctuation spacing, falls back to a
  spaceless match (noted in the check) and accepts any copy at the stated location.
- **Specification "page 5" is not PDF page 5.** Board specifications number pages from the start
  of the content (Pearson 1MA1: printed page 5 is PDF page 17). The quote checker accepts either.
- **`docker build` in a Claude cloud session fails pip installs with "certificate verify
  failed"** because the session proxy re-signs TLS. This is sandbox-only (CI is fine). For a
  local check, build a throwaway Dockerfile copy that trusts `/root/.ccr/ca-bundle.crt` via
  `PIP_CERT`; do not commit that change. The Docker daemon may also need starting
  (`sudo dockerd &`).
