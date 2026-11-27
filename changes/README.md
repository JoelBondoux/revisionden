# Changelog fragments

Each pull request adds one file here instead of editing `CHANGELOG.md`:
`changes/unreleased/<your-branch>.md` (for example `changes/unreleased/F21-card-sizes.md`). The
name only has to be unique, so pull requests never conflict over the changelog.

Use only these headings, each followed by `- ` bullet lines (indent a line to continue a bullet):

```markdown
### What's new

- One plain-English line a family would notice (shown on the About page).

### Added

- What was added, for the team.

### Changed

- What changed.

### Fixed

- What was fixed.
```

Leave out the headings you don't need. `pnpm changelog:check` checks every fragment. To preview the
result, run `pnpm changelog:assemble` and then undo it with `git checkout CHANGELOG.md changes/`.
Don't commit an assembled changelog: the release workflow on `main` folds the fragments in and
deletes them. A pull request with nothing to record (only tests or CI, or a pure merge) needs no
fragment; otherwise label it `no-changelog` if there is truly nothing to say.
