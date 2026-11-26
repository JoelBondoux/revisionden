# J12: topic map redesign, three directions (mockups only)

The owner's note: "the topic page is just too long, this needs a redesign." These are mockups for
the owner to choose from. No product code has changed yet.

## How they were made

- The app on `dev`, run with `vite` and its built-in mock API (MSW). Made-up demo data only, no
  real people or accounts.
- The map data is dev-like GCSE Higher Maths: the real topic tree (6 units, 97 topics) built with
  the real `buildTopicMap`. Number (16 topics) and Algebra (25 topics) are open because they have
  questions; Ratio, Geometry, Probability and Statistics are locked. A made-up Year 11 student is
  part-way through Number and just starting Algebra. Daily goal 30 of 50 XP, 5-a-day not started.
- The mockups use the real topic hexes, honeycomb and Doodle Diary style (the default). The layout
  code was throwaway and is not in this pull request.
- Playwright, Chromium. "Phone" is 390 × 844. "320" is 320 × 568 (the smallest phones we support).
  "text200" is the same with text at 200%. Images are at 1× and reduced to 128 colours.
- Every page height below is the whole scroll height, footer included. A "screen" is one viewport
  height.

## What's on every design

- **One "Today" strip** replaces the daily-goal card, the 5-a-day card and the Next mission card.
  It holds the XP bar, the next mission with Go, and 5-a-day with Start. The install prompt, when the
  phone offers one, would be one more short row in the strip (it does not show in these test
  browsers).
- The subject chips and streak stay where they are.
- **"Current unit"** means the unit that holds your next mission (here Algebra, because of the
  weak spot "Simplifying, expanding and factorising").

## Page length

| Page                   | 390 × 844              | 320 × 568              | 320, text at 200%       |
| ---------------------- | ---------------------- | ---------------------- | ----------------------- |
| **Before** (today)     | 9,124 px, 10.8 screens | 9,298 px, 16.4 screens | 15,817 px, 27.8 screens |
| **A** Collapsed units  | 1,134 px, 1.3 screens  | 1,322 px, 2.3 screens  | 3,061 px, 5.4 screens   |
| **B** One unit at once | 1,183 px, 1.4 screens  | 1,311 px, 2.3 screens  | 2,931 px, 5.2 screens   |
| **C** Your path        | 1,269 px, 1.5 screens  | 1,452 px, 2.6 screens  | 3,244 px, 5.7 screens   |

All three are about 7 to 8 times shorter than today. On a 390 × 844 phone each fits in roughly
1.3 to 1.5 screens. At 320 × 568 the screen itself is a third shorter, so the same content takes
2.3 to 2.6 screens. None of the three scrolls sideways at any of these sizes.

## The designs

### Before

`before-phone-light-first-screen.png`, `before-phone-light-full.png`. The first screen is header,
chips, three cards and the title of the first unit. Then every unit follows as a full honeycomb, 3
hexes to a row, for 97 topics.

### A. Collapsed units

`a-phone-light.png`, `-dark`, `-colourblind`, `a-320.png`, `a-320-text200.png`,
`a-phone-show-all.png`.

Each unit is one row: a mastery ring, the unit name and "Next: ‹topic›". Only the current unit is
open. It shows the next 4 topics from where you are (3 on a small phone), with "1 topic mastered
before these" above and "Show all 25 topics" below (`a-phone-show-all`). Tap any row to open it.
The four locked units fold into one dashed row, "4 more units coming soon".

- **Pros:** shortest page; every unit's progress is visible at once; plain headings and buttons, so
  it is the easiest to build and the most accessible.
- **Cons:** least "game-like"; you see only 4 hexes until you tap "Show all".

### B. One unit at a time

`b-phone-light.png`, `-dark`, `-colourblind`, `b-320.png`, `b-320-text200.png`,
`b-phone-all-units.png`.

A strip of unit tabs, each with a small ring, scrolls sideways under the Today strip. One unit's
honeycomb is shown, 7 topics at a time (5 on a small phone, 4 with big text), starting at the page
with your next topic. The ‹ and › buttons step through it, and the challenge hex is on the last
page. "All units" opens a sheet listing every unit with "5 of 16 topics mastered"
(`b-phone-all-units`).

- **Pros:** keeps a full-size honeycomb on screen; it feels like a game level; switching units is
  one tap.
- **Cons:** you can't see all units at once without opening the sheet; with 6 units the tab strip
  already scrolls sideways (more subjects make that worse); paging inside a unit is a second thing
  to learn.

### C. Your path

`c-phone-light.png`, `-dark`, `-colourblind`, `c-320.png`, `c-320-text200.png`,
`c-phone-see-all.png`.

A row of small hex badges, one per unit, joined by a dotted line. The current unit is bigger and
yellow, and locked units show a padlock. Under it, the current unit is a path: "1 topic done", then
the next 4 topics as hexes stepping down a dotted line with their names beside them, then "20 more
topics, then the challenge". "See all" opens a grid of all units (`c-phone-see-all`).

- **Pros:** the most journey-like and motivating; "what's next" is unmistakable; topic names get a
  full line, so they read better than under a hex.
- **Cons:** hardest to build and to keep accessible; the path shows only 4 topics; the badge row
  scrolls sideways on small phones and loses its labels with big text.

## Accessibility

| Check                             | A                                                                         | B                                                                                               | C                                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 320 px, text 200%                 | Fits. Rows wrap. Honeycomb drops to 2 hexes per row with bigger hexes.    | Fits. Tab strip scrolls sideways (allowed for a scroller). 2 hexes per row, 4 per page.         | Fits only with a fallback: the path turns into one centred column and badge names hide (except current). |
| Headings                          | h1 page, h2 "Today", h2 per unit (the row's button is inside the heading) | h1, h2 "Today", h2 for the shown unit                                                           | h1, h2 "Today", h2 "Your path", h3 current unit                                                          |
| Expanded or collapsed             | Native `aria-expanded` on every unit button                               | Tabs with `aria-selected`, needs arrow-key handling; the page change is announced (`aria-live`) | No open or closed state; the badges need hidden text ("Ratio, coming soon")                              |
| Keyboard                          | Tab through rows, Enter or Space opens; nothing custom                    | Needs the tab pattern (arrow keys, Home and End) plus the sheet's focus trap                    | Plain links and buttons, but the zig-zag reading order needs care                                        |
| Reduced motion                    | Nothing moves (open and close is instant)                                 | Swipe and scroll-snap must jump without animating                                               | The path is static; any "walk along the path" animation must be off                                      |
| Dark and colour-blind             | Fine, uses the theme colours                                              | Fine                                                                                            | Fine (the current badge keeps a fixed yellow so its number stays readable)                               |
| axe (WCAG 2.2 AA, light and dark) | No problems                                                               | No problems                                                                                     | No problems                                                                                              |

**A handles accessibility best.** It is ordinary headings and disclosure buttons, so screen readers
announce "Algebra, collapsed, heading level 2" with no custom keyboard code, and it reflows cleanly
at 320 px with 200% text. B needs the full tabs pattern and a dialog. C needs a separate big-text
layout.

## Found on the way (not changed here)

At 320 px with text at 200%, today's map already overflows sideways. All three designs fix the
first two of these for the map:

- **Unit headers:** the "% mastered" text runs off the right edge, because the header doesn't wrap.
- **Hex labels:** long one-word topic names overflow their hexes, because hexes are a fixed 96 px.
  The mockups size hexes in `rem` and drop to 2 per row with big text.
- **Bottom navigation:** five tabs are wider than the screen at 200% text, on every page. The
  navigation is not J's area, so this is noted for its owner.
