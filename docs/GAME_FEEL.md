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
  applies to the answers in order. Combos never span sessions. All daily caps and healthy limits
  still apply.

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
- Waiting on others: the chime rising a step per combo needs a pitch step in U's sound bank;
  star notes use the existing celebration sound. Flashcard sessions get the full treatment once
  F3 (flashcard sessions, #45) is on dev (J2b or with J4).
