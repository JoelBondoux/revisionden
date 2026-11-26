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
  turns green, "+XP" pops above the feedback, XP counter rolls up, rising chime (U's sound bank).
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
- **A question coming back** (learning from mistakes, F5): a gold line above the question says
  why: "Here's another one like it. You've got this.", "Another go at this one: you've got
  this.", "Let's try an easier one on this.", "A quick one you know." or "Warm-up: this one
  came up last time." After a wrong answer the feedback adds "No worries: we'll have another go
  at this in a moment"; after a second miss, "This one's tricky today, so we'll come back to it
  another day" with the "Learn it first" links. A right retry adds "Comeback! You got it this
  time." A slow right answer adds "Nice one. That took a little while, so it'll come back
  another day to make it stick." Same sounds as any answer; no penalty or fail words, retries
  can build a combo, and a lesson always ends on a success.
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
- **LinkTile** (icon, title, one-line description, chevron; shrinks and wraps its text anywhere so it
  fits a 320px screen at 200% text, J11): a tappable card for "go to X" lists
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
- **Doodle background**: our own original thin line doodles in Pip's angular style, packed like a
  hand-drawn sticker sheet (J8b; the technique of WhatsApp's chat wallpaper, none of its art). A
  1080px tile generated by `apps/web/src/design/doodleTile.ts` from a fixed seed: a few hero
  doodles at about 3× (Pip reading, a stack of books, a lab bench, a rocket, a globe, a calculator,
  a ringed planet, a trophy), then as many medium doodles as fit (160 motifs across school
  subjects, space, nature, music, sport, food, tech and everyday things; never two copies of one
  motif within 240px, or two heroes within 520px, measured across the seams). Each doodle's real outline (worked out from its SVG by
  `doodleGeometry.ts`: paths, arcs, circles and transforms, wrapped in a convex outline) stays at
  least 4px plus the line width clear of every other, so nothing ever overlaps, then tiny fillers (dots, rings, sparkles, plus
  signs, little stars, dashes) in the gaps, each kept 4px clear of its neighbours across the edges.
  Upright or tilted by up to 25°, one 1.4px line weight, no fills; anything crossing an edge is
  drawn again on the other side, so the repeat has no seams. The output is committed as
  `doodle-scatter.svg` and checked by a test; after changing the generator, run
  `UPDATE_DOODLES=1 npx vitest run src/design/doodleTile.test.ts` in `apps/web`. Very faint (7%
  ink), behind solid cards, no animation, off in high contrast and forced colours, and switchable
  off. Tokens and checks: `apps/web/src/design/themes.ts`. Before and after: `docs/design/j8b/`.
- **Hand-drawn (J8c, owner decision 2026-11-26):** the shipped tile uses the doodles redrawn as if
  sketched in a notebook (`apps/web/src/design/doodleSketch.ts`, from a fixed seed). Lines wobble
  a little and overshoot at the corners, about one stroke in six is drawn twice, and about a third
  of the closed shapes get a light scribbled fill at half strength. Generic sketchbook techniques
  only, no particular book's look; the tiny fillers stay crisp. Placement uses the hand-drawn
  outlines, so nothing overlaps; about 58KB gzipped. Before and after: `docs/design/j8c/`.
- **Text on gold** always uses `--color-text-on-gold` (dark), in every theme: gold buttons,
  gold and streak pills, earned reward steps, the combo badge and the mastered-topic checkmark on the map.

## Avatar builder layout (J9, owner request 2026-11-25)

- The preview never scrolls away; only the options scroll or change tab. The layout follows the
  builder's own width (a container query), so it is the same on the "Make it yours" page and in
  the parent's "Build an avatar" sheet.
- Narrow (under 600px of builder: phones and the sheet): the preview, Shuffle and the tabs are
  pinned at the top. Once the options have scrolled up about a preview's height, the preview
  shrinks (160px to 96px tall). Its bottom margin grows by the same amount, so the options never
  move.
- Wide (600px or more: tablets and desktops): the preview, Shuffle and the tabs are a sticky
  column on the left, with the options on the right.
- Tabs follow the ARIA tabs pattern: arrow keys move and select, wrapping round; Home and End;
  only the selected tab is in the Tab order. Picking a tab after scrolling brings the new tab's first options into view,
  just below the pinned stage (level with its top when wide); instant with reduced motion.
- Every change (an item or Shuffle) gives the preview a short squash-and-pop (transform only;
  none with reduced motion). The options panel keeps a minimum height, so switching tabs never
  moves what comes after the builder.
- Locked items get their spoken name from the visible text plus hidden words ("Crown, locked.
  Unlock: 100-day streak"), so what is seen is what is said (WCAG 2.5.3).

## Effect styles (J10, owner decision 2026-11-26)

- One effect style is active at a time. It sets the look and motion of the game-feel moments
  (combo badge, stars, bursts, confetti, "+XP"), the Home screen (topic map) and Rewards. The
  owner picked **Doodle Diary** as the free default (J10d). The other styles unlock through normal
  progress on the owner's ladder, never by buying (J10b, `docs/REWARDS.md` "Effect styles"):
  Sticker Book at level 3, Pop Burst at level 5, Garden Grow at
  5 topics mastered in a subject, Starlight at 10 topics mastered, Comic Pop at level 20 and Pixel
  Arcade at level 40. The child picks in Settings → Effect style, where
  locked styles show a three-colour preview and "Locked. Unlock: …". More styles may follow once
  the owner has reviewed them.
- **Full looks (J15s, owner direction 2026-11-26).** The owner, trying styles on dev: "When I
  change theme only the Today box on the Map page changes." Each style is now a full look for the
  **whole** app: it sets the shared design tokens (page and surface colours, edges, text, the main
  colour, the progress track, map hex fills, corner radii, shadows, the heading font and the
  background pattern's ink) in light and dark, in `features/juice/styles/looks.ts`, mirrored in
  the style's stylesheet. Every shared component reads those tokens, so cards, buttons, button
  tiles, chips, the bottom nav, the map, progress bars and headings all follow the style, and each
  style has its own background pattern (`styles/patterns/`). Doodle Diary is the base look (paper,
  biro ink, hand-lettered headings); Pixel Arcade squares every corner, Comic Pop inks every edge,
  Starlight swaps hard shadows for glows, and so on. Cue colours (right, wrong, warning, gold,
  streak) are never part of a look, so the colour-blind palette works in every style. Body text,
  questions and answers stay Nunito. `looks.test.ts` checks every look sets every token, matches its
  stylesheet, and keeps every text pair at AA (and shapes at 3:1) in light, dark and colour-blind;
  `e2e/tests/looks.spec.ts` runs axe on the map and Me in all 7 styles, light and dark. This
  replaces J13a's "styles change accents only" (#268, not merged).
- Pop Burst (J10b): jelly cards with a chunky bottom edge, a gold jelly mission card, gold wins,
  round confetti; the badge stamps in from big and the stars drop in. Starlight (J10b): night-sky
  cards with a soft glow, mastered topics are outlined in starlight and earned steps glow; the badge brightens
  into view and the stars rise and settle.
- A style is one entry in `apps/web/src/features/juice/styles/registry.ts` plus one stylesheet in
  which every rule is scoped to `:root[data-effect-style='<id>']`. A test checks that scoping, so
  removing or swapping a style never leaves bits of it behind. `EffectStyleProvider` sets
  `data-effect-style` on `<html>` and remembers the choice on this device (`localStorage`
  `revisionden.effectStyle`). A saved style that isn't unlocked falls back to Doodle Diary.
  `index.html` starts with Doodle Diary, so the first paint is already in the default style.
  The provider sits inside the router (`EffectStyleRoute`, J10e): it makes no request at all on Get
  help (`/help`, `/parent/help`), checks again each time the picker
  opens (so a style earned in the last lesson can be picked straight away), and retries a failed
  load (for example a 401 before unlocking) on the next screen change.
- Doodle Diary (J10d, the default): a diary full of pen doodles. On Home, page titles are
  handwritten (Patrick Hand, self-hosted, SIL Open Font Licence, listed under open-source
  licences) with a wavy biro underline; the Today strip and the chosen unit's card are boxes sketched in
  pen with wobbly corners (the rows inside stay plain), and the chosen unit badge is coloured in
  with highlighter (J12b); mastered topics are outlined in ink and coloured in
  with highlighter scribbles. On Rewards, earned steps are solid highlighter yellow with dark ink numbers (AA in light and
  dark, J10g) and locked ones are dashed
  pencil outlines. In lessons the surround is diary paper (night paper in dark mode) and the
  question sits on a plain white card (dark card in dark mode); a right answer gets a ring and a light
  wash in the success colour (green; blue with colour-blind friendly colours), so it never reads
  as a red "wrong" mark (J10f; red is for wrong only). The combo badge and "+XP" are written in red pen, stars are drawn in pen and coloured
  in, and bursts and confetti are quick pen strokes. Sounds use U's paper-and-ink pack (Sticker
  Book's until a Doodle Diary pack lands): `EffectStyleProvider` calls `useFeedbackStyle` with the
  active style.
- Sticker Book (J10a): wins are stickers slapped onto the page. Each sticker has a white die-cut
  edge, a slight tilt and a soft offset shadow; bursts and confetti are paper scraps. On Home, the
  Today strip and its Next mission row are cards taped into the book, the 5-a-day row is a paper
  note, the streak is a sticker, and mastered topics are gold stickers stuck on at slight angles.
  On Rewards, earned chapter steps are stickers and locked ones are dashed outlines. Stickers keep
  their paper colours in dark mode, like real stickers, with dark ink text (AA). The combo badge
  and stars "slap" in (transform and opacity only), with no animation under reduced motion.
- The lesson surround follows the active style (J10a2, owner rule 2026-11-26: "not a school
  app", "fun around the learning", "calm question screens"). The question and its answers sit on
  `.lesson__stage`, which a style may give a plain, high-contrast card, but never texture,
  stickers, tilt or motion behind the text. Sticker Book turns the dark arena into warm paper
  (night paper in dark mode) by re-colouring the `--arena-*` tokens, with the question on a plain
  white card (a dark card in dark mode); a test checks those colours meet AA.
- Garden Grow (J10c): leafy cream cards with a soft green edge, today's mission as a garden
  patch, mastered topics in bloom (petal edge), petal confetti; wins grow up from their stem.
  Comic Pop (J10c): bold ink outlines and hard offset shadows, today's mission a yellow comic
  panel, halftone-dot bursts; wins slam in from big. Pixel Arcade (J10c): square corners and
  chunky borders, neon on night blue, square pixels that don't spin; wins step in a block at a
  time and nothing blinks. They use the app's own fonts (no extra font files).
- Empty progress tracks (the lesson and flashcard bars, `--arena-track`; other bars,
  `--color-track`) and the outline of a Challenge hex (`--color-challenge-edge`) reach 3:1 against
  what they sit on, in every theme and surround (WCAG 1.4.11, J10f, from the morning walkthrough
  #185). Tests: `themes.test.ts` (`NON_TEXT_PAIRS`), `tokens.test.ts` and the surround test.
  Since J10g an empty track is an outline (an inset 2px ring in the track colour) with nothing
  inside, so 0% reads as empty rather than a full grey bar; the fill sits inside the ring.
- "+XP" in a lesson pops just above the feedback, in the gap under the question card, with a short
  rise (`float-up-short`); it never crosses the question or its answers (J10g, calm question
  screens). No style puts a pattern behind an earned level's number on Rewards (J10g).
- No style puts a shadow filter on a topic hex: on the map it would double the topic's name.
- Pen-line exception (lead, approved 2026-11-26): small SVG pen lines may draw themselves by
  animating `stroke-dashoffset`, as Doodle Diary's margin doodles and answer loops do. Only on
  short paths, a handful at a time, never behind question text, and off under reduced motion.
  Everything else stays transform and opacity only.
- Every style plays its own sounds and vibration through the sound workstream's events (U6).
  Wiring the style into those events follows once U's PR is on dev.

## Dev style tester (J12c, owner request 2026-11-26)

On the dev environment only, Settings → Effect style has a dashed "Tester: try any style" box
("Dev only: doesn't unlock anything for real."): any of the seven styles, Light or Dark, and
Standard or Colour-blind colours, applied at once. The API decides: `GET
/v1/student/rewards/effect-styles` adds `testerStyles` only when `ENVIRONMENT=development` and
`STYLE_TESTER=true` (set for `env.dev` in `apps/api/wrangler.toml`; a config test checks staging
and production never set it, and local MSW mocks send it). The web shows the box only when that
list arrives, so a stray build cannot show it. The style being tried is saved on the device
(`revisionden.effectStyleTester`), apart from the real choice, and only counts while the server
still sends the list; "Reset to my unlocked style" clears it. Trying a style grants no reward,
changes no unlock and records nothing on the server.

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
