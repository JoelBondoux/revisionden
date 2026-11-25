# Game feel ("juice")

> Live document. How RevisionDen should feel: punchy, colourful and satisfying, in a sleek teen
> style (never childish), with no manipulative hooks. Approved by the product owner on
> 2026-11-25 from mockup 22 ("Game feel") on the mockups canvas. Built in workstream J.

## Principles

1. **Every answer feels good to give.** Instant, rich feedback: motion, colour and sound together.
2. **Effort is celebrated, not pressured.** Celebrate progress loudly; never punish leaving.
3. **Teen, not toddler.** Deep purple "arena" backgrounds, neon accents, crisp type, original art.
   No cartoon candy, no copying any game's look, characters, sounds or names.
4. **Keep the established art direction** (product owner, 2026-11-25): Pip, the angular fox with
   subject outfits from mockup 6 ("Subject mascots"), stays the mascot, drawn in the same flat,
   geometric style. Game-feel effects sit around that art; they don't replace it.
5. **Sound and motion are optional.** Mute (workstream U) and reduced motion turn effects off; every
   effect has a visual or text equivalent.

## Where it applies

| Area                                                        | Treatment                                                    |
| ----------------------------------------------------------- | ------------------------------------------------------------ |
| Practice screens: lessons, flashcard sessions, set complete | Immersive dark "arena" (mockup 22): full effects             |
| Starting test and Test mode                                 | Arena look, but no right/wrong effects until the reveal      |
| Topic map, rewards, stats                                   | Light theme, bouncy buttons, entrance motion, reward reveals |
| Parent area, policies, settings                             | Calm: light theme, subtle motion only                        |

## Effects

- **Right answer:** particle burst from the chosen option (about 20 particles, 0.8 s), the option
  turns green, "+XP" floats up, XP counter rolls up, rising chime (U's sound bank).
- **Wrong answer:** small horizontal shake (0.4 s), the right option is highlighted, soft low tone.
  No red flashes, no "fail" words.
- **Combo:** from 2 right in a row a "COMBO ×n" badge pops in; the chime rises a step per combo
  (up to 6). A wrong answer quietly resets it.
- **Progress bar:** glowing fill with a springy overshoot.
- **Buttons:** chunky with a bottom edge, press-down "jelly" on tap; the main call to action
  pulses gently and has a moving shine.
- **Set complete:** stars pop in one by one with rising notes (3 stars at 5/5, 2 at 3–4, 1
  otherwise), confetti, XP tally, best combo, daily-goal bar fills, then **Next mission**
  (pulsing) and the line "Or take a break. Your streak is safe for today." when that is true.
- **Pip the fox** reacts with a short line (warm-up, combo, last question).
- **Reward reveals** use U's tiered reward sounds with a matching visual tier (common to
  legendary). A reveal always shows exactly what was earned and why: no mystery boxes.

## XP rule

- **Combo bonus:** from the 3rd right answer in a row, +5 XP per right answer (on top of the
  normal XP), in Learn mode only. In Test mode the combo is shown at the reveal and the same bonus
  applies to the answers in order. Combos never span sessions. A wrong recall check answer
  ("Remember this?", Q4) never resets the combo; a right one still adds to it. All daily caps and healthy limits
  still apply.

## Links (J7, owner request 2026-11-25)

No plain underlined text links. Use the shared components in `apps/web/src/components/links.tsx`:

- **LinkButton** (primary, secondary or quiet, optional icon): a link that looks like our buttons,
  for the main way on from a screen.
- **LinkTile** (icon, title, one-line description, chevron): a tappable card for "go to X" lists
  such as the parent home, settings and stats; wrap a list in `<ul className="link-tiles">`. The
  link's text is the title (its screen reader name, matching what it shows, WCAG 2.5.3), the
  description is read as its description, and the link stretches over the whole card.
- **LinkChip**: a small pill link inside a card ("Details", "Change").
- **TextLink**: only for links inside sentences and long prose (policies). Bold, coloured, a soft
  bar under it and an underline on hover; it stays inline for readability.

All render real links (router `Link` or `<a>`), keep a 3px focus ring and a 44px target, lift on
hover and squash on press (transform only; off with reduced motion). Outside links that open a new
tab say so to screen readers.

## Themes, colours and background (J8, owner request 2026-11-25)

- **Dark theme** (Settings → Appearance; System follows the device): deep violet surfaces, the same
  chunky buttons with white text, violet text in a lighter shade for contrast. Arena screens are
  already dark and look the same in both themes.
- **Colour-blind friendly colours**: right is blue (#1F6FD1) and wrong is orange (#B34F00), in
  answers, the arena, combo, progress, the map and stats. Icons and words always say it too.
- **Doodle background**: our own original tile of thin line doodles in Pip's angular style (fox,
  pencil, book, π, √, ÷, x², a graph, a lightbulb, a star, a trophy, a calculator, a test tube,
  headphones, a planet). Very faint (7% ink), behind solid cards, no animation, off in high
  contrast and forced colours, and switchable off. Tokens and checks: `apps/web/src/design/themes.ts`.
- **Text on gold** always uses `--color-text-on-gold` (dark), in every theme: gold buttons,
  gold and streak pills, earned reward steps, the combo badge and the mastered-topic checkmark on the map.

## Never (Children's Code and `REWARDS.md`)

- No lives or energy that run out and block learning; no waiting timers; no pay-to-continue.
- No countdowns or "come back or lose it" messages; no streak guilt. Reminders follow quiet hours.
- No random or mystery rewards; no near-miss tricks; no infinite "one more" loops past the daily
  cap. After the daily cap the call to action becomes "Great work today. See you tomorrow".
- No autoplay sound before the first tap; no flashing above 3 times a second (WCAG 2.3.1).

## Performance and accessibility

- CSS transforms and opacity only; particles capped; 60 fps on a mid-range Android phone.
- `prefers-reduced-motion` turns off particles, shakes, confetti and pulsing (state changes still
  shown with colour and text); screen readers get the result text through a live region.
- Contrast meets WCAG 2.2 AA on the dark arena background.

## Build status (workstream J)

- J1: tokens (`apps/web/src/design/tokens.ts`, `arena.css`) and effects (`apps/web/src/features/juice/`).
- J2–J3: lessons, the starting test (no right/wrong effects) and set complete
  (`apps/web/src/features/learn/SetComplete.tsx`). The "daily cap" for "See you tomorrow" is the
  daily reward XP cap (300 XP today), confirmed by the lead on 2026-11-25, until the study-time
  cap reaches the web app.
- J4: combo XP in `packages/core/src/xp.ts` and the learn API (Learn mode per answer; starting
  test at the reveal), stored in each answer's XP so rewards count it. The lesson shows the API's
  combo and the bonus in its feedback. Still to show: best combo at the starting test reveal.
- The chime rises a step per combo (U5): `play('correct', { step: comboStep(combo - 1) })`, a
  whole tone per step up to 6 (an octave). Waiting on others: star notes use the existing
  celebration sound. Flashcard sessions get the full treatment once
  F3 (flashcard sessions, #45) is on dev (J2b or with J4).
