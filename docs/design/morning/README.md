# Morning walkthrough (I11), 26 November 2026

Screens that changed overnight, captured at phone width (390 × 844) in light and dark mode. Each
pair is `<screen>-light.png` and `<screen>-dark.png`; `-end` files show the bottom of a long page.

## How they were made

- The app on `dev` (df74ca1), run with `vite` and its built-in mock API (MSW), so every screen
  shows made-up demo data. No real people or accounts.
- The browser was a Playwright phone (touch, 390 px wide), with the device's colour scheme set to
  light or dark. The app's theme was left on System, and the effect style was the default, Doodle
  Diary.
- The child screens use the first mock child (NovaFox). The images were shrunk to 1× and reduced
  to 128 colours to keep the repository small.
- The full end-to-end suite passed on the same commit (102 of 102).

| File                         | Screen                                                        |
| ---------------------------- | ------------------------------------------------------------- |
| `01-child-home`              | Topic map (child home), top and bottom                        |
| `02-rewards`                 | Rewards, top and bottom                                       |
| `03a-lesson-question`        | A lesson question before answering                            |
| `03b-lesson-correct-moment`  | A quarter of a second after a right answer (+10 XP floating)  |
| `03c-lesson-correct-settled` | The same moment once the animation has settled                |
| `04a/b/c-flashcard-*`        | Flashcard front, back, and the Explain steps                  |
| `05-settings-style-picker`   | Settings: the effect style picker (Doodle Diary and six more) |
| `06-get-help`                | Get help, top and bottom                                      |
| `07-parent-subjects`         | Parent Subjects page for one child, top and bottom            |

## Looks broken or off

None of these stops a screen from working. Most need a design decision.

1. **A right answer has a red ring (Doodle Diary).** In a lesson, the right answer gets a thin
   green border inside a red ring, and no green fill. The red-pen ring is deliberate (see
   `features/juice/styles/doodle-diary.css`), but red usually means wrong, and the green fill other
   styles use is gone. At a glance it can read as a wrong answer (`03b`, `03c`).
2. **Locked Challenge hexagons nearly vanish in dark mode.** They are near-black on the dark navy
   background (`01-child-home-dark`).
3. **The Explain steps open below the fold.** On a phone, tapping Explain opens the steps under the
   rating buttons, mostly hidden behind the bottom bar. Nothing on screen moves, so it can look as
   if nothing happened (`04c`).
4. **The bug-report button covers content.** The floating button sits over the end of the Show
   answer button (`04a`) and over the level circles on Rewards (`02-rewards`).
5. **Subjects page: the two rows of choices have no labels.** The exam board row (AQA, Pearson
   Edexcel …) and the tier row (Foundation, Higher) both end in "Not sure", with no heading to say
   which is which (`07-parent-subjects`).
6. **Get help appears three times on the topic map**: the header pill, a card, and the footer
   (`01-child-home`). That may be intended, but it is a lot on one screen.
7. **The footer has a stray "·" at the end of the version line**, left over when the line wraps
   (all `-end` shots).
8. **Faint progress tracks.** In light mode the empty part of the flashcard session bar is cream
   on cream (`04a`), and so is the lesson's top progress bar (`03a`).

Mock data only (not product bugs):

- The Cards tab badge says 12 due, but the Cards page says "Due today (2)": two mocks disagree.
- Parent home's Subjects link uses a child id the family mock doesn't have, so it opens "We could
  not find that child". These shots use the family mock's child.
