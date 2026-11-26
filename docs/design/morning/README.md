# Morning walkthrough, 26 November 2026

Screens that changed overnight, captured at phone width (390 × 844) in light and dark mode. Each
pair is `<screen>-light.png` and `<screen>-dark.png`; `-end` files show the bottom of a long page.

These are the final shots of the night (I14), retaken after the fixes from the first walkthrough
(I11) landed.

## How they were made

- The app on `dev` (869cc6c), run with `vite` and its built-in mock API (MSW), so every screen
  shows made-up demo data. No real people or accounts.
- The browser was a Playwright phone (touch, 390 px wide), with the device's colour scheme set to
  light or dark. The app's theme was left on System, and the effect style was the default, Doodle
  Diary.
- The child screens use the first mock child (NovaFox). The images were shrunk to 1× and reduced
  to 128 colours to keep the repository small.
- The full end-to-end suite passed on the same commit (108 of 108).

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

## The first walkthrough's list

- [x] **1. A right answer had a red ring (Doodle Diary).** It is now green: a green fill and a
      double green border (`03b`, `03c`).
- [x] **2. Locked Challenge hexagons nearly vanished in dark mode.** They now have a light outline
      (`01-child-home-end-dark`).
- [x] **3. The Explain steps opened below the fold.** The page now scrolls to them, with Back and
      Next step in view (`04c`).
- [x] **4. The bug-report button covered content.** In the student app it now sits in the top row
      beside Get help and the sound button (`01`, `02`, `04`). Lessons and parent pages keep the
      corner button, with room left below the page.
- [x] **5. The Subjects page's two rows of choices had no labels.** They now have "Exam board" and
      "Tier" headings (`07-parent-subjects`).
- [x] **6. Get help appeared three times on the topic map.** It is now twice: the top row and the
      footer (`01-child-home`).
- [ ] **7. A stray "·" in the footer.** It has moved rather than gone: when the version line wraps,
      the "·" now starts the second line, on its own before Get help (all `-end` shots).
- [x] **8. Faint progress tracks.** The empty part of each bar is now a solid grey-purple in both
      modes (`01`, `02`, `03a`, `04`).

The two mock-data mismatches are fixed too: the Cards badge and the Cards page both say 2, and
parent home's Subjects link opens the child.

## New things that look off

None of these stops a screen from working.

1. **Empty progress tracks may now be too heavy.** At 0% the flashcard session bar is a solid grey
   bar the full width of the card (`04a`), and the empty part of the daily-goal and level bars is
   darker than before. A child could read an empty bar as full or switched off.
2. **The corner bug button still sits beside content on parent pages.** On parent Subjects it
   rests next to the subject chips as you scroll (the "French" chip in `07-parent-subjects`). It
   doesn't cover a chip in these shots, but the parent pages have no top row to move it into.
3. **Unlocked level circles are muddy in dark mode.** On Rewards the first three circles (unlocked)
   have dark hatching over yellow, which makes their numbers hard to read (`02-rewards-dark`).
   This was there in the first walkthrough too, but wasn't listed.
4. **The "+10 XP" floater crosses the question title** for a moment after a right answer (`03b`).
   It fades within a second, so this is minor.
