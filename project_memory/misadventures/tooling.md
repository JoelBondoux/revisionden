# Tooling misadventures

Tags: #tooling #ci

- **`node --test scripts/` fails** with "Cannot find module" on Node 22 when given a directory.
  Use a glob: `node --test scripts/*.test.mjs`. Also: a failure from a bad invocation is not a
  real "red" step; check the failure message is about the behaviour under test.
- **GitHub CLI in cloud sessions can fail authentication** (`GH_TOKEN` invalid) even when git push
  works through the proxy. Pull requests then cannot be opened with `gh`; report it rather than
  pushing to protected branches.
