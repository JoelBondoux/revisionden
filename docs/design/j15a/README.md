# J15a: button tiles and page transitions

The owner, 2026-11-26: "Settings, parent and policies: can we try changing the horizontal blocks to
buttons (that are in theme), and animated movement into the inner pages that are theme-specific
too?"

These are screenshots of the real build (made-up demo data), at 390 × 844.

## Button tiles

Chunky buttons in a grid, two to a row on phones. Each has a big icon and a short label, with no
helper sentence. Each effect style draws them its own way, and the press sound and vibration come
from the active style's sound pack.

| Style        | Tile                                               | Screenshot                                          |
| ------------ | -------------------------------------------------- | --------------------------------------------------- |
| Doodle Diary | Hand-drawn sketch box, highlighter blob, hand font | `legal-doodle-diary.png`, `parent-doodle-diary.png` |
| Sticker Book | Peeled sticker with a white edge, tilted           | `legal-sticker-book.png`                            |
| Pop Burst    | Glossy violet candy with a gold icon               | `legal-pop-burst.png`, `parent-pop-burst.png`       |
| Starlight    | Night glass with a glowing star icon               | `legal-starlight.png`, `legal-starlight-dark.png`   |
| Comic Pop    | Comic panel, heavy ink, offset shadow              | `legal-comic-pop.png`                               |
| Garden Grow  | Pot shape on soil, leaf icon                       | `legal-garden-grow.png`                             |
| Pixel Arcade | 8-bit block with a neon edge                       | `legal-pixel-arcade.png`, `parent-pixel-arcade.png` |

Get help keeps its own calm tile and never transitions. Me (`/settings`) gets the tiles with W9's
new Me layout.

## Page transitions

`transitions.mp4` (and `transitions.gif`, Doodle Diary and Sticker Book only) opens a policy from
its tile, then goes Back, in each style in turn:

| Style        | Move                |
| ------------ | ------------------- |
| Doodle Diary | page turn           |
| Sticker Book | peel                |
| Pop Burst    | bouncy pop-in       |
| Starlight    | twinkle fade        |
| Comic Pop    | panel zoom          |
| Garden Grow  | grow-in             |
| Pixel Arcade | stepped 8-bit slide |

How they behave:

- Each takes 350ms at most.
- Back plays the move in reverse.
- They never block a tap.
- With reduced motion the page just swaps.
