### Fixed

- G13b: the **Changelog fragment** check now counts only a newly added (or renamed-in) `changes/unreleased/*.md` file. Editing or deleting another change's fragment no longer passes (Codex review on #453). `check-pr` reads `git diff --name-status`; tests in `scripts/changelog.test.mjs`.
