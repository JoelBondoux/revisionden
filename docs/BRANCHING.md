# Branches, environments and versions

> Live document.

## Branches

```
feature/<workstream>-<short-name>  ──PR──▶  dev  ──PR──▶  staging  ──PR──▶  main
```

| Branch      | Purpose                                                | Who merges                                       | Required checks                                        |
| ----------- | ------------------------------------------------------ | ------------------------------------------------ | ------------------------------------------------------ |
| `feature/*` | One piece of work                                      | The author opens a PR into `dev`                 | CI green                                               |
| `dev`       | Integration of finished features                       | Any session after CI is green and review is done | CI                                                     |
| `staging`   | Release candidate, deployed to the staging environment | Product owner or lead session                    | CI + end-to-end + accessibility                        |
| `main`      | Production                                             | Product owner                                    | All of the above, staging checked by the product owner |

- Never push directly to `dev`, `staging` or `main`. Always a pull request.
- Keep feature branches short-lived (a few days). Rebase on `dev` before opening the PR.
- Use conventional commit messages: `feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`.

## Environments

| Environment | Web                       | API                           | Database              |
| ----------- | ------------------------- | ----------------------------- | --------------------- |
| Development | `dev.revisionden.com`     | `api-dev.revisionden.com`     | Neon branch `dev`     |
| Staging     | `staging.revisionden.com` | `api-staging.revisionden.com` | Neon branch `staging` |
| Production  | `revisionden.com`         | `api.revisionden.com`         | Neon `main`           |

Deploys run from GitHub Actions on merge to each branch once the deploy workstream is done.

## Versions

- Format: `xx.xx.xxx` (major.minor.patch), stored in `/VERSION`. Started at `00.01.000`.
- **Every push to `main` bumps the version** automatically (`.github/workflows/release.yml`):
  - patch by default;
  - put `[minor]` in the merge commit message when a stage ships;
  - put `[major]` for the public launch.
- The workflow also tags the release (`v00.01.001`), dates the changelog section and merges the
  release commit back into `staging` and `dev`.
- Every PR adds a line under **Unreleased** in `CHANGELOG.md`.
