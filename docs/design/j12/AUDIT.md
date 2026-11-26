# J12 audit: one look, and single screens

Two owner notes, both from 2026-11-26:

- "The current styling is an odd mixture of doodle and the default we'd previously been working
  with."
- "Most pages where interacting is happening should be a single screen rather than needing to
  scroll a lot."

This page records where the student app stands today. The proposal is in [SKIN.md](SKIN.md).

## How it was measured

- The app on `dev`, run with `vite` and its mock API (made-up demo data only), in a 390 × 844
  Playwright phone with default text. The style is Doodle Diary, the default.
- The lesson uses a real verified GCSE item from the repository (N1, ordering numbers) instead of
  the mock's one-line demo question, so the question has a realistic length. The map uses the same
  97-topic GCSE Maths data as [README.md](README.md).
- The yellow "Draft content" banner is hidden, because it only shows on development builds.
- "Height" is the whole page, including the version footer, divided by 844. "Primary in view"
  means the screen's main button is fully on screen and not under the tab bar, as the page loads
  (or just after the step named).

Screenshots of today's screens are `audit/<screen>.png`. The same screens in the proposed skin
are `audit/<screen>-skin.png` (`-skin-dark.png` for dark), and the single-screen versions are
`audit/<screen>-single.png`.

## Interactive screens today (390 × 844)

| Screen                                  | Height       | Primary in view                                                                         | Covered by the rule  |
| --------------------------------------- | ------------ | --------------------------------------------------------------------------------------- | -------------------- |
| Map (`map`)                             | 10.8 screens | Yes (Go, Start), but the topics run on for 10 more screens                              | Yes                  |
| Flashcards, question (`cards`)          | 1.05         | Yes (Show answer)                                                                       | Yes                  |
| Flashcards, answer (`cards-answer`)     | 1.17         | Just: the four rating buttons sit right on top of the tab bar                           | Yes                  |
| Flashcards, Explain (`cards-explain`)   | 1.31         | **No**: the page jumps down 43 px and the rating buttons go under the tab bar           | Yes                  |
| Lesson, question (`lesson`)             | 1.16         | Yes (Check)                                                                             | Yes                  |
| Lesson, after Check (`lesson-answered`) | 1.33         | Continue yes, but the page jumps 131 px, so the exit button and progress go off the top | Yes                  |
| 5-a-day (`daily`)                       | 1.16         | Yes (Check)                                                                             | Yes                  |
| Plan (`plan`)                           | 1.0          | No action yet ("Coming soon")                                                           | Yes                  |
| Papers (`papers`)                       | 1.0          | No action yet ("Coming soon")                                                           | Yes                  |
| Rewards (`rewards`)                     | 4.55         | Yes (Save title), but chapters and collections need 3.5 more screens                    | Yes (reward moments) |
| My stats, the Progress tab (`progress`) | 2.28         | No single action; the charts run on                                                     | Yes (the "Me" page)  |
| Settings (`settings`)                   | 7.16         | No single action                                                                        | No (a settings list) |

Not measured: the starting test and set complete. Both need a full run through the mock to reach,
and they share the lesson's layout, so the lesson findings apply to them.

The worst offenders are the **map** (fixed by any of the three J12 layouts), **Rewards**, and the
**flashcard Explain step**, where the main buttons end up hidden under the tab bar.

## Doodle or default, element by element

"Doodle" means it already uses the Doodle Diary look (ink outline, wobbly corners, paper,
highlighter or hand lettering). "Default" means the earlier look (soft violet, rounded, 3D
under-shadow).

| Element                               | Where it is doodle                                   | Where it is still default                                                                                     |
| ------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Page background                       | Doodle pattern everywhere; diary paper in the lesson | Lavender page colour under the pattern on every tab screen                                                    |
| Page headings (h1)                    | "Topic map" (hand lettering, wavy underline)         | Cards, Plan, Papers, My stats, Settings, Level on Rewards: plain Nunito Black                                 |
| Card headings (h2)                    | Map: "Next mission", the subject name                | 5-a-day, Today, XP per day, This device, Your title, Chapter, deck names                                      |
| Cards                                 | Map: the summary, 5-a-day and Next mission cards     | Plan, Papers, Rewards, My stats tiles, Settings, the flashcard panel and both card faces                      |
| Buttons                               | Lesson answer options                                | Every real button: Go, Start, Show answer, Explain, Check, Continue, Save title, the ratings, Back, Next step |
| Chips, tabs and toggles               | None                                                 | Subject chips, flashcard tabs (Due today, All decks, My cards), the Week, Term and Year toggle                |
| Pills                                 | The streak pill on the map                           | The streak pill in the lesson                                                                                 |
| Progress bars                         | None (all use the J10f outline)                      | Daily goal, 5-a-day, lesson, flashcard session, level and today's time                                        |
| Tab bar                               | None                                                 | White bar with a violet selected tab                                                                          |
| Header buttons (Get help, sound, bug) | None                                                 | Lavender chips and circles                                                                                    |
| Topic hexes                           | Mastered (highlighter hatching)                      | In progress, weak, locked and challenge hexes keep the default violet, orange and grey outlines               |
| Toasts                                | None                                                 | The dark "locked topic" toast                                                                                 |
| Inputs and selects                    | None                                                 | The title pickers on Rewards, and every form field                                                            |
| Settings rows (link tiles)            | None                                                 | Every row                                                                                                     |
| Lesson feedback                       | The right-answer ring (J10f)                         | The feedback panel and its text                                                                               |

**In short:** the doodle look covers the map's top cards, the map heading, the mastered hexes and
the lesson question. Everything else, including every button, chip, progress bar and the tab bar,
is still the default. That's why it feels like a mixture.

## Found on the way (not changed here)

- **Flashcard name (WCAG 2.5.3, Label in Name).** The card's spoken name is "Turn over to see the
  answer", but it doesn't include the words on the card ("Question", the topic and the front
  text). axe flags this on `/cards` today, in every theme, with or without the skin. The
  flashcards aren't J's area, so this is noted for their owner.
