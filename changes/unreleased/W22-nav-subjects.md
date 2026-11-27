### What's new

- Home now has its own button in the bottom bar: Home, Learn (the map), Cards and Me. Plan and Papers are out of the bar until they're ready.
- Your subject now shows at the top of Home, Learn and Cards (for example "Maths ▾"). Tap it to switch subject, and the app remembers your choice. Pick a subject now lists the one you're on first, then the ones you can start, with the coming-soon subjects tucked into one line.

### Added

- UX-1 (owner-approved UX report, 2026-11-27): the main nav is Home, Learn (`/map`), Cards and Me (`BottomNav.tsx`, `navItemsFor`); Plan and Papers leave it while coming soon (back with `VITE_COMING_SOON_TABS=1`; routes kept). A subject switcher in the top bar on Home, Learn and Cards (`features/subjects`) opens a "Your subjects" sheet and "Add or change subjects" (the map's picker); the choice is kept per student on the device and shared by Home and the map. The picker orders the current subject, then subjects with questions, then folds the coming-soon ones (`pickerOrder`). Red-first: `e2e/tests/navigation.spec.ts`, `e2e/tests/subject-switcher.spec.ts`. A long subject name ("Computer Science") at 320px with text at 200% wraps inside its button instead of pushing Pip off the left of the top row (`subjects.css`; e2e in `subject-switcher.spec.ts`, Codex on #423).
