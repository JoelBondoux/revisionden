# 0012: Every look meets WCAG 2.2 AA contrast, measured on the painted page

- Status: accepted (owner request, lead ruling, 2026-11-26)
- Date: 2026-11-26

## Context

On 2026-11-26 the owner saw white text on light backgrounds in several light themes. The same
day the new looks (J15s, J16) showed a pattern: colours were checked against the theme's
`--color-background` token, while the text actually sat on page art, gradients, the lesson arena
or a pale button fill. Codex and the painted-page check found several such cases (Pop Burst dark
page, lesson "+XP", "Best combo", header XP and comeback text), each fixed one at a time.

## Decision

- **Standard.** Every screen, in every look, in light and dark (and the colour-blind and reading
  tint variants), meets WCAG 2.2 AA:
  - text 4.5:1, large text (24 px, or 18.66 px bold) 3:1 (1.4.3);
  - buttons, inputs, checkboxes, radios, chips, focus rings and other UI parts 3:1 against what is
    behind them (1.4.11);
  - the accessible name of a control contains its visible label (2.5.3).
- **Measured on the painted page.** Contrast is measured against the pixels actually behind the
  text (page art, gradients, arena, button fill), with the shared painted helper
  (`e2e/tests/support/painted.ts`), not against a theme token. Text too faint to sample is a
  failure, not a skip.
- **Token rules** (`docs/GAME_FEEL.md`): text on the page uses `--color-text*` or
  `--color-primary-edge`; text on the lesson arena uses `--arena-glow`; gold (`--arena-gold`) is
  never used as text on the page; white text is only allowed on a fill that is measured to pass.
- **Enforced in CI** (W21, `e2e/tests/contrast-sweep.spec.ts`, being added after this decision), in two
  tiers over every route, its main dialogs, all looks, light and dark:
  - every pull request: a fast check of each text and UI colour against its nearest painted
    background (blocking), plus a guard that fails if a route is missing from the sweep;
  - the full painted-page sweep: nightly, on any pull request that changes a look's styles, and as
    a required check before anything is promoted to staging.
    Known failures are listed in `e2e/tests/contrast-known.json` (one open entry in
    `operations/contradictions.md`) and are marked expected-to-fail, so each fix turns its check
    green and a regression turns it red. A new look, route or dialog is not finished until both
    tiers pass for it.
- **Accessibility beats a look.** If a look's colour cannot pass on a surface, the colour changes,
  or the look keeps that surface plain in that mode (as with the dark-only night pages).

Detail: `docs/PRODUCT_RULES.md` ("Accessibility: contrast"), `docs/GAME_FEEL.md`, `docs/TESTING.md`.
