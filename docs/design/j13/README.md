# J13a: the Doodle Diary skin across the app

The owner said "yes, build the doodle look across the whole app" (2026-11-26). These screenshots
show the shared skin from J13a on today's screens. J13b will go through each screen in turn.

They were taken from the app on this branch, using the mock API with made-up demo data, at
390 × 844. The dev-only "Draft content" banner shows on the lesson and the flashcards.

| File                                         | What it shows                                                                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `screens-light.png`, `-dark`, `-colourblind` | Doodle Diary: map, Cards, Rewards, My stats, Settings, parent home and Policies                                     |
| `styles-map-light.png`, `-dark`              | The map in all seven styles: Doodle Diary, Sticker Book, Pop Burst, Starlight, Comic Pop, Garden Grow, Pixel Arcade |
| `styles-settings-light.png`, `-dark`         | Settings in all seven styles                                                                                        |
| `styles-lesson-light.png`, `-dark`           | A lesson question in all seven styles (each keeps its own lesson surround colours)                                  |
| `forced-colours.png`                         | The map and Settings with Windows contrast themes (forced colours), focus on the third Tab stop                     |

Each style changes only its accents: the highlighter colour (the chosen chip, tab or badge, and
the current tab), the progress scribble, the mastered-topic hatching, and its celebrations. The
shapes, fonts and layout are the same in every style.

## Checks

- **axe (WCAG 2.2 A and AA):** no problems on 8 pages (map, Cards, Rewards, My stats, Settings,
  a lesson, parent home, Policies). That covers all seven styles in light and dark, plus Doodle
  Diary in colour-blind light and dark: 128 page checks.
- **320 px with 200% text:** no page scrolls sideways. The Cards tabs scroll within their own
  row, which the single-screen rule allows.
