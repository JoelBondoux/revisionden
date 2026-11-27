### What's new

- Home is tidier. Your goals now say what they count ("Daily goal: 30 of 50 XP", "0 of 2 questions today", "3 cards to review"), "Fix these" shows your two weakest topics with a "See all" link instead of a row that ran off the screen, and the "Friends league · Soon" pill is gone.
- Screens look as they will at launch: no version line at the bottom of every page (it's on About), and on the test site draft questions are marked by one quiet line at the very bottom instead of a big banner at the top. On Me, "More" is now called "Subjects, family and feedback".

### Added

- UX-1 PR B (owner-approved UX report and lead's ruling, 2026-11-27): Home's goals are labelled in words; "Fix these" shows the two weakest topics as wrapping chips clamped to two lines (`title` and name keep the full topic) plus "See all N" to `/map` (three did not keep Home on one 390 × 844 screen, `home.spec`); the "Friends league · Soon" pill is gone. Draft content is marked by `DraftNote`, one slim line at the end of lessons, the starting test and Cards, replacing `DraftBanner`. `VersionFooter` is removed from every layout (About keeps "This version"). Me's "More" tile and page are "Subjects, family and feedback". Red-first: `e2e/tests/home-tidy.spec.ts`.
