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
- **`pnpm add` rewrites `pnpm-lock.yaml` in pnpm's own style**, but the repository keeps the
  lockfile Prettier-formatted, so `pnpm format:check` fails. After adding a dependency run
  `pnpm exec prettier --write pnpm-lock.yaml`.
- **`docker build` in a Claude cloud session fails pip installs with "certificate verify
  failed"** because the session proxy re-signs TLS. This is sandbox-only (CI is fine). For a
  local check, build a throwaway Dockerfile copy that trusts `/root/.ccr/ca-bundle.crt` via
  `PIP_CERT`; do not commit that change. The Docker daemon may also need starting
  (`sudo dockerd &`).
