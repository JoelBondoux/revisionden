# All-themes mockup: visibility checks

Run from the repo root after `pnpm install` (Playwright is a dev dependency):

```bash
node docs/mockups/checks/check-track-contrast.cjs docs/mockups/all-themes-pip.html
node docs/mockups/checks/check-pip-ring.cjs docs/mockups/all-themes-pip.html
```

## Map nodes vs road and page (3:1, WCAG 1.4.11)

A node passes when its halo, ring, border or fill clears 3:1 against every road colour it touches and against the page (10th-percentile of sampled page pixels, so textures count). Before the halo fix: 16/60 passed.

| Style | Mode | Node | Seen by | vs road | vs background | Result |
|---|---|---|---|---|---|---|
| doodle-diary | light | done | border+fill | 4.64 | 13.57 | pass |
| doodle-diary | light | current | border+fill | 5.8 | 5.7 | pass |
| doodle-diary | light | locked | border+fill | 5.94 | 6.24 | pass |
| sticker-book | light | done | halo+border+fill | 4.23 | 11.7 | pass |
| sticker-book | light | current | halo+border+fill | 4.23 | 11.7 | pass |
| sticker-book | light | locked | halo+border | 4.82 | 11.7 | pass |
| pop-burst | light | done | halo+fill | 13.54 | 4.74 | pass |
| pop-burst | light | current | halo+fill | 6.79 | 4.74 | pass |
| pop-burst | light | locked | halo+fill | 6.79 | 4.74 | pass |
| starlight | light | done | border+fill | 13.66 | 11.4 | pass |
| starlight | light | current | border+fill | 3.3 | 8.21 | pass |
| starlight | light | locked | border+fill | 3.55 | 8.89 | pass |
| comic-pop | light | done | border+fill | 6.46 | 10.02 | pass |
| comic-pop | light | current | border+fill | 5.34 | 10.02 | pass |
| comic-pop | light | locked | border+fill | 18.88 | 10.02 | pass |
| garden-grow | light | done | border+fill | 3.78 | 5.21 | pass |
| garden-grow | light | current | border+fill | 3.83 | 5.21 | pass |
| garden-grow | light | locked | border+fill | 5.51 | 5.37 | pass |
| pixel-arcade | light | done | border+fill | 15.83 | 11.56 | pass |
| pixel-arcade | light | current | border+fill | 3.99 | 12.58 | pass |
| pixel-arcade | light | locked | border+fill | 4.87 | 15.93 | pass |
| petal-glow | light | done | border+fill | 4.17 | 7.15 | pass |
| petal-glow | light | current | border+fill | 3.85 | 6.6 | pass |
| petal-glow | light | locked | border+fill | 4.61 | 5.82 | pass |
| turbo-drive | light | done | halo+border+fill | 8.68 | 6.53 | pass |
| turbo-drive | light | current | border+fill | 5.82 | 7.45 | pass |
| turbo-drive | light | locked | halo+border+fill | 9.72 | 6.53 | pass |
| rainbow-parade | light | done | halo+border+fill | 8.87 | 5.67 | pass |
| rainbow-parade | light | current | border+fill | 8.87 | 5.67 | pass |
| rainbow-parade | light | locked | halo+border+fill | 11.31 | 5.67 | pass |
| doodle-diary | dark | done | border+fill | 4.64 | 14.17 | pass |
| doodle-diary | dark | current | border+fill | 6.73 | 7.83 | pass |
| doodle-diary | dark | locked | border+fill | 7.93 | 8.4 | pass |
| sticker-book | dark | done | halo+border+fill | 4.23 | 12.45 | pass |
| sticker-book | dark | current | halo+border+fill | 4.23 | 12.45 | pass |
| sticker-book | dark | locked | halo+border | 3.2 | 3.99 | pass |
| pop-burst | dark | done | halo+fill | 13.54 | 4.74 | pass |
| pop-burst | dark | current | halo+fill | 6.79 | 4.74 | pass |
| pop-burst | dark | locked | halo+fill | 6.79 | 4.74 | pass |
| starlight | dark | done | border+fill | 13.66 | 11.4 | pass |
| starlight | dark | current | border+fill | 3.3 | 8.21 | pass |
| starlight | dark | locked | border+fill | 3.55 | 8.89 | pass |
| comic-pop | dark | done | halo+border+fill | 5.21 | 10.56 | pass |
| comic-pop | dark | current | halo+border+fill | 5.21 | 10.56 | pass |
| comic-pop | dark | locked | border+fill | 11.68 | 10.56 | pass |
| garden-grow | dark | done | border+fill | 8.51 | 8.89 | pass |
| garden-grow | dark | current | border+fill | 5.32 | 8.89 | pass |
| garden-grow | dark | locked | border+fill | 4.39 | 7.33 | pass |
| pixel-arcade | dark | done | border+fill | 15.83 | 11.56 | pass |
| pixel-arcade | dark | current | border+fill | 3.99 | 12.58 | pass |
| pixel-arcade | dark | locked | border+fill | 4.87 | 15.93 | pass |
| petal-glow | dark | done | border+fill | 5.31 | 8.9 | pass |
| petal-glow | dark | current | border+fill | 3.03 | 8.18 | pass |
| petal-glow | dark | locked | border+fill | 3.12 | 6.65 | pass |
| turbo-drive | dark | done | halo+border+fill | 8.68 | 6.53 | pass |
| turbo-drive | dark | current | border+fill | 5.82 | 7.45 | pass |
| turbo-drive | dark | locked | halo+border+fill | 9.72 | 6.53 | pass |
| rainbow-parade | dark | done | halo+border+fill | 7.61 | 6.51 | pass |
| rainbow-parade | dark | current | border+fill | 7.61 | 6.51 | pass |
| rainbow-parade | dark | locked | halo+border+fill | 5.48 | 3.5 | pass |

60/60 pass

## Pip ring vs disc, including the soft flag discs (3:1)

Lowest contrast between the ring (or its inner keyline) and any disc colour.

| Style | Mode | plain disc (Maths) | French | German | Spanish |
|---|---|---|---|---|---|
| doodle-diary | light | 11.77 | 6.38 | 4.63 | 6.26 |
| sticker-book | light | 11.77 | 6.38 | 4.63 | 6.26 |
| pop-burst | light | 11.77 | 6.38 | 4.63 | 6.26 |
| starlight | light | 11.77 | 6.38 | 4.63 | 6.26 |
| comic-pop | light | 15.82 | 8.58 | 6.22 | 8.41 |
| garden-grow | light | 11.77 | 6.38 | 4.63 | 6.26 |
| pixel-arcade | light | 11.77 | 6.38 | 4.63 | 6.26 |
| petal-glow | light | 11.77 | 6.38 | 4.63 | 6.26 |
| turbo-drive | light | 11.77 | 6.38 | 4.63 | 6.26 |
| rainbow-parade | light | 12.66 | 6.86 | 4.98 | 6.73 |
| doodle-diary | dark | 11.77 | 6.38 | 4.63 | 6.26 |
| sticker-book | dark | 11.77 | 6.38 | 4.63 | 6.26 |
| pop-burst | dark | 11.77 | 6.38 | 4.63 | 6.26 |
| starlight | dark | 11.77 | 6.38 | 4.63 | 6.26 |
| comic-pop | dark | 15.82 | 8.58 | 6.22 | 8.41 |
| garden-grow | dark | 11.77 | 6.38 | 4.63 | 6.26 |
| pixel-arcade | dark | 11.77 | 6.38 | 4.63 | 6.26 |
| petal-glow | dark | 11.77 | 6.38 | 4.63 | 6.26 |
| turbo-drive | dark | 11.77 | 6.38 | 4.63 | 6.26 |
| rainbow-parade | dark | 12.66 | 6.86 | 4.98 | 6.73 |
