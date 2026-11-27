### What's new

- Fixed: on a phone, the Bug, Idea, Something confusing and Other choices on the bug report form are easy to tap again.

### Fixed

- F26 (Codex on train #454, fix forward from #418): `.feedback__kind` is back in the shared rule with `.feedback__toggle` (44px `--tap-target` height, bold), and `.feedback__problem` has its own rule; a stray selector had given the type options the problem-code layout. New e2e: each type option is at least 44px tall at 390px.
