# 0012: Every screen is swept for contrast in every look, on every pull request

- Status: accepted (lead ruling, 2026-11-26, on the owner's report of white text on light fills)
- Date: 2026-11-26

## Context

The owner saw light looks showing white text on a pale background. Contrast was checked per
screen in a few specs, but nothing covered every screen in all 10 looks, light and dark, so a
look change could break a screen nobody tested.

## Decision

- `e2e/tests/contrast-sweep.spec.ts` covers every route in `apps/web/src/routes.tsx` (and
  `LESSON_PATHS`) plus the main dialogs (prize box, Leave this lesson?, Subject selection, avatar
  editor), in all 10 looks, light and dark, with reading tints off. The phone runs every look;
  the desktop runs the default look.
- The route table enforces itself: a route added to `routes.tsx` without a row in the sweep fails.
- Tier 1, every pull request (the `contrast` job in `.github/workflows/e2e.yml`): computed styles only. Text 4.5:1
  (3:1 when large: 24px, or 18.66px bold) against the nearest opaque background; buttons, inputs,
  switches and tabs 3:1 by fill or border (WCAG 1.4.3, 1.4.11). Text over page art, gradients
  or shadows is left to tier 2.
- Tier 2, painted (`.github/workflows/contrast-painted.yml`, `CONTRAST_SWEEP=1`): what is really
  drawn. Text in every box, UI parts' edges, and the first focus rings. Runs nightly, on demand,
  on pull requests that touch the looks or design CSS, and as a gate before staging (its `gate`
  job, for deploy workflows to need).
- Known failures are listed in `e2e/tests/contrast-known.json` and tracked by one entry in
  `operations/contradictions.md`. A sweep fails on a failure not listed and on a listed one that
  is now fixed, so each fix removes its line in the same change. J fixes them as lists arrive.

Detail: `docs/TESTING.md` ("Contrast sweep").
