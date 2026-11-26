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

- **Right answer:** a burst of the effect style's own particles from the chosen option (18,
  growing with the combo from 4 in a row; see "Themed particles" below), the option turns green, "+XP" pops above the feedback, XP counter rolls up, rising chime (U's sound bank).
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
- **Prize box (J17):** rewards earned by an answer or a flashcard session arrive in the den prize
  box (see "Themed particles and the prize box" below). It is not a mystery box: it only appears
  after the rewards are already earned, holds exactly those, and shows each one's reason.

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
- **ButtonTile** in a **ButtonTiles** grid (J15a, owner request 2026-11-26): a chunky button with
  a big icon over a short label (2–3 words, no helper sentence), two to a row on phones and more on
  wider screens. Used on parent home and Policies, and offered to W9 for Me; `LinkTile` stays where
  a description is needed. Each effect style gives it its own look and press (inked sketch, peeled
  sticker, glossy candy, starry glass, comic panel, garden pot, 8-bit block); the press sound and
  vibration are U's `buttonPress` for the active style, which plays on every link tap. An optional
  `badge` (a count, or who a policy is for) is read as part of its name. `tone="help"` is Get help's
  own calm tile.
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

## Avatar motion (E9, owner request 2026-11-26)

- The student's own avatar can move as a puppet: whole parts (the figure, the head, the eyes, the
  mouth) move with CSS transforms, so hats, hair and glasses ride along with the head whatever the
  child wears. Hair that hangs behind the body (long hair, ponytails) moves in step with the head
  but stays behind the top.
- `<AvatarSvg code motion="idle|nod|hop|hmm|tap|still" />`; still by default, so options and lists
  never move. `useAvatarMotion({ paused })` gives the props and `react('nod' | 'hop' | 'hmm' | 'tap')`.
- Idle: slow breathing with a small bounce (6.4s loop), a blink every 5.2s, a slow look left and
  right (8.8s loop); the loops are multiples of `--motion-pulse`, so nothing pulses fast. Reactions play once: **nod** for a right answer (700ms), **hop** with a squint
  and a bigger smile for a goal or level (900ms), a gentle **hmm** head tilt for a wrong answer
  (1.4s), and a quick **tap** squash when the avatar is tapped (450ms). Same feel as Pip: ease-in-out loops, reactions on `--ease-out` and `--ease-spring`.
- Small moves only (at most 4px up, 7 degrees of tilt), so nothing leaves the frame: checked for
  every hat, hair style, skin and held item.
- `paused` (questions and Test mode) stops the idle loop; reactions still play. Nothing runs in a
  hidden tab. Reduced motion: the avatar stays still and reactions do nothing.
- Placement (the bigger avatar at the bottom right, in the Me nav item) is J's (J15b).

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
- **Looks match the approved all-themes mockup (J15s revision, rev 5.1, 2026-11-26).** Each look
  takes the mockup's page art, split into a wash (`--page-wash`, soft gradients) and a texture
  (`--page-texture`: notebook lines, halftone, scanlines, stars), layered over the page colour by
  `design/base.css`. **Settings always win over a look** (Codex review of train #337): the texture
  shows only with Background pattern on; high contrast and forced colours get a plain page; a
  reading tint replaces the page and surface colours and removes the wash and texture; the
  dyslexia-friendly font replaces every heading and style font. Text drawn straight on the page
  (headings, notes, the version footer) reads AA on the **painted** page, wash and texture
  included (`e2e/tests/looks.spec.ts`: the letters are found by drawing the text in black and in white, then measured in their real colour against the page drawn without them; faint text fails, never skips, J15s-b and J15s-c); so Pop Burst's
  dark wash is a deep purple-to-plum, not the mockup's purple-to-peach. A look also takes its
  heading font, self-hosted with @fontsource (Baloo 2 for Sticker Book, Pop Burst, Starlight and
  Garden Grow; Bangers for Comic Pop; Press Start 2P for Pixel Arcade; Patrick Hand for Doodle
  Diary). **Vivid and night pages show in dark mode**: Pop Burst's purple page, Starlight's night
  sky and Pixel Arcade's arcade screen need light text, which the shared warning, danger and success
  colours are not made for, so light mode keeps a light page in those styles. To keep white text on
  the success button readable, night and vivid looks use a deeper main colour for buttons (Starlight
  violet, Pixel Arcade green, Pop Burst pink) and keep their bright colour (cyan, neon green, sunny
  yellow) as the highlight (`--color-primary-edge`). Lead ruling, 2026-11-26: accessibility comes
  first. The heading fonts are SIL OFL 1.1; every self-hosted font's licence ships in
  `apps/web/public/licences/fonts/`.
- **Living progress bars (J15s revision).** Every horizontal bar's fill (`.progress__fill`,
  `.arena-progress__fill`) is always gently on the move, in each style's own way: biro hatching
  (Doodle Diary), a rolling barber stripe (Sticker Book), a gloss sweep with bubbles (Pop Burst),
  drifting twinkling stars (Starlight), racing halftone dots (Comic Pop), drifting leaves (Garden
  Grow) and a marching chase light (Pixel Arcade). The motion stays inside the fill, the leading
  edge pulses, only background-position, transform and opacity animate, smooth timing only (no
  steps), off with reduced motion, and paused while the tab is hidden (`tab-hidden` on the root,
  set by `EffectStyleProvider`). In `features/juice/styles/bars.css`, checked by `bars.test.ts`.
- Pop Burst (J10b): jelly cards with a chunky bottom edge, a gold jelly mission card, gold wins,
  round confetti; the badge stamps in from big and the stars drop in. Starlight (J10b): night-sky
  cards with a soft glow, mastered topics are outlined in starlight and earned steps glow; the badge brightens
  into view and the stars rise and settle.
- **Three styles unlocked by the starting test (J16, U7, owner-approved 2026-11-26; never labelled
  by gender).** Petal Glow (`petal-glow`: soft pink and lilac petal cards, flower tiles on the map,
  drifting-petal bars, Fredoka headings), Turbo Drive (`turbo-drive`: angled cards, racing stripes,
  chevron bars, Russo One headings; its asphalt page is dark-mode only, like the other night styles)
  and the calmer Rainbow Parade (`rainbow-parade`: clean cards, a soft rainbow stripe across the page,
  glitter bars, Baloo 2 headings; the rainbow is decoration only, never a state cue). They are full
  looks like the others (AA in light, dark and colour-blind, page art obeying the pattern and
  contrast settings) and come with their own sounds (U7), particles (J17) and map tiles (J15c).
  Petal Glow's open topics get a soft petal-edged tile and Turbo Drive's open tiles a light edge, so
  every node stands out 3:1 from the road. Unlocked by the existing `starting-test` reward
  (`packages/core/src/catalogue/effect-styles.ts`).
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

## Page transitions (J15a, owner request 2026-11-26)

Opening a page from a button tile plays the effect style's own move on the main area, and Back
plays it in reverse: Doodle Diary a page turn, Sticker Book a peel, Pop Burst a bouncy pop-in,
Starlight a twinkle fade, Comic Pop a panel zoom, Garden Grow a grow-in and Pixel Arcade a stepped
8-bit slide. Each is 350ms at most, uses transform and opacity only, and never blocks a tap (it is
a CSS animation on the page, nothing on top of it). `ButtonTile` marks the navigation
(`state.via = 'tile'`) and `PageTransition` (in `features/juice/transitions/`, mounted for every
route) adds `page-enter` (and `page-enter--back` on Back) to `#main`; each style's stylesheet draws
it. With reduced motion the page just swaps. Get help (`/help`, `/parent/help`) and the Quick exit
never transition. An ordinary link does not either.

## Pip, the Home button, and Home (J15b, owner direction 2026-11-26)

- **Pip v3** (`features/juice/pip/`, J15b-2, from the owner-approved all-themes mockup
  `docs/mockups/all-themes-pip.html`) is code-drawn original art in layers: a bigger head leaning
  out over the top of a round ring, **shoulders only** (no arm), the body clipped to the disc, a
  thin dark keyline inside the ring so it reads on any disc, the subject's worn item, and the
  subject **prop held in front of the ring** so it reads at button size. Outfits for all 16
  subjects: `outfits.ts` (`outfitFor`), art in `art.tsx` (generated from the mockup). Maths holds a
  calculator (no pencil); English Literature holds a book. French, German and Spanish wash the disc
  with soft flag colours (38%). Three gently-leaning looks with two versions each rotate by day
  (`lookFor`: A a tuft or tiny moustache; B a bow with lashes, or a clip with a little blush; C a
  stud earring with freckles, or a beanie, which becomes a bandana under a hat); never tied to the
  subject or the student, no flags or symbols, and Pip keeps his name.
- **The player's avatar** (`FramedAvatar.tsx`) sits in its own ring on the Me item, a little
  smaller than Pip: the body clipped to the disc, the head leaning out over the top, the avatar's
  square background hidden. E9 motion is untouched (idle, still with reduced motion).
- **The Home button**: Pip in a 56px round button, top left of every student screen and of
  lessons and tests (a row of its own there). Accessible name "Home"; the tap target is the circle,
  and his head leans out above it without covering anything. In a lesson or test, tapping him asks
  **"Leave this lesson?"** (Keep going, focused first; Leave). It is a true modal (J15b-2): it
  renders in its own layer, the rest of the page is `inert` while it asks, Tab and Shift+Tab stay
  on its two buttons, and Escape, Keep going or a tap outside close it and put focus back on Pip. The subject comes from the map or
  Home, kept in memory only (`subject.ts`, nothing saved on the device).
- **Idle loop** (`idle.ts`): one action about every 8 seconds (blink, a head tilt, an ear twitch,
  a look around; v3 has no arm), with slow shoulder breathing at rest, never the same twice running; naps outside 07:00 to 21:00; stops after a minute without
  a tap or key; still in lessons and tests. Moves ease in and out through in-between frames and
  return to rest, so nothing snaps. Reduced motion: a still pose. Breathing runs only while the
  idle loop is on (`PipFigure alive`, class `pip-figure--alive`), so being at rest never means
  breathing in a lesson, after a minute or with reduced motion (J15b-3, Codex review of #335).
- **Home** (`/home`, `features/home/`) is the first screen after signing in or unlocking and where
  Pip goes. One screen at 390 × 844, low on words: the level ring (count-up), streak, today's goal
  rings (XP, 5-a-day with Start or Continue, cards due), **one** big bobbing next-mission button
  (or "Pick a topic"), weak spots to fix, the friends league chip (soon), and this week's days with
  the reward gift. It reads the map, the week's stats (read-only, so Rewards keeps its "New!"
  moments), the 5-a-day and cards due. The map's Today strip moved here; the map is topics only.

## The lesson screen (J14, from the approved all-themes mockup rev 5.1)

The lesson and question player (topic lessons, practice, command words, the 5-a-day and recall)
follows the single-screen rule (`docs/PRODUCT_RULES.md`, Screen layout): at 390 × 844 with
default text the question, the answer input and the primary button (Check, then Continue) are all
in view without scrolling. At 320 px or 200% text the page may scroll up and down, never sideways.

- **Order, top to bottom:** the lesson header (Pip as the Home button, the progress bar, the
  combo and XP), the question card, the answers (2 × 2 chunky buttons for multiple choice; a
  full-width field for typed answers), the clue and help, a one-line feedback and the action
  button. Secondary detail (the day's goal, intro text, help steps) sits behind a tap or below
  the action, never between the question and its answer.
- **The question stays a calm, plain card** in every style (J10a2); the style shows around it.
- **One Pip.** Pip v3 in the header is the lesson's Pip. He reacts to each marked answer
  (`features/juice/pip/reactions.ts`, fed by `LessonPlayer`'s `onAnswerReaction`, which defaults
  to `reactToAnswer`, so every lesson screen gets it):
  - right: a nod; from 3 right in a row, a cheer;
  - today's goal: a cheer (the avatar hops);
  - helped (after "Help me understand"): a gentle nod only, however long the streak;
  - wrong: an encouraging head tilt ("hmm"), never a frown.
    Each pose plays once (nod 900 ms, cheer 1200 ms, hmm 1400 ms) and goes back to rest; there is
    no idle motion in a lesson. Reduced motion: no reaction. An answer from before Pip appeared is
    ignored.
- **Answer field reflow:** the typed-answer field fills its row and can shrink, so at 320 px with
  200% text nothing scrolls sideways (it used to push the page 120 px; `e2e/tests/lesson.spec.ts`).
- **One compact header (J14b).** The lesson shows Pip v3 in its own header row with the way out
  (×), the progress bar and the XP; while it does, the layout leaves out its separate Pip row
  (`lessonPip.ts`; that row stays for a lesson's loading, error, empty and finished screens, so there
  is always a way Home: only the header's `LessonPip` claims him, J14c). The lesson screens are one
  list, `LESSON_PATHS` in `layout/lessonRoutes.ts`, shared by the routes and the layout, so command
  words gets the avatar too. The older speech-bubble Pip (`PipSays`) is gone: Pip's line is a speech bubble pointing up
  at him, beside the combo and the **student's framed avatar** (`LessonAvatar`), which holds still
  between answers and nods, hops or goes "hmm" with Pip (none with reduced motion). The question
  starts about 68 px higher at 390 × 844 (`e2e/tests/lesson.spec.ts`). The growing burst on a streak
  is W's `celebrate('correct', …, { combo })` (J17).
- Built: J14a (reactions, field reflow), J14b (compact header, avatar).

## The winding map (J15c, owner sign-off of the all-themes mockup, revision 5)

`apps/web/src/map/` (`WigglyMap.tsx`, `route.ts`, `bridges.ts`, `nodeArt.tsx`, `wiggly.css`,
`wiggly-styles.css`), reference `docs/mockups/all-themes-pip.html`.

- **The big subject box** at the top (Pip dressed for the subject, "Your subject", Change) opens
  **Subject selection**: every subject with Pip dressed for it, Back to the map.
- **One unit at a time**: a sideways pager (swipe, the arrow buttons, or the arrow keys on the
  focused pager) with dots; the heading says the unit and its mastery.
- **Each unit's route comes from a seed** (subject + unit, `layoutRoute`): S-bends, switchbacks, a
  long sweep or a curl (one segment bulges sideways; no true loop, so the road never crosses
  itself). It **climbs from the first topic at the bottom to the unit challenge at the top**, and
  opens scrolled to the current topic with done topics below it.
- **Nodes** are each style's own solid tiles (generated from the mockup): done, current, open
  (its %), weak (wrench and %), locked, and the challenge. The next mission's topic is the current
  node, with a **You are here** tag beside it. Labels are clamped to three lines (the full name is
  in the link's name) and use the app's text colour with a page-coloured halo.
- **Higher side branch**: for a Foundation student, topics marked `tier: 'higher'` sit on an
  optional dotted branch that forks off the route and rejoins it (smaller "H" nodes, "Higher ·
  optional"). **Either order**: topics sharing an `orderGroup` sit side by side and the route splits
  and rejoins. Both are optional fields on the map topic; without them nothing changes.
- **Bridges** (discovered, never shown up front): with links from content (D7/D8), opening a linked
  topic reveals its first bridge the next time the map shows (a note: "You might find this Physics
  topic useful: …"); tapping a bridge says why it helps and reveals the next link a moment later.
  Kept in memory for the session. With no links, nothing shows.
- **The path breathes**: each node drifts a few px on a slow sine (8 to 12 s, a little per style)
  and the road follows; off with reduced motion, under automation (so clicks find their target),
  and paused while the tab is hidden. The current node bobs and the tag sways (transform only).
- **Checks** (`e2e/tests/map.spec.ts`, ported from `docs/mockups/checks`): every unit's route at
  320 and 390 px has no overlapping nodes, labels or tags, nothing off screen, and no crossings;
  every done, current and open node clears 3:1 against the road and the page in every app style,
  light and dark.

## Themed particles and the prize box (J17, owner-approved mockup 2026-11-26)

Ported from `docs/mockups/all-themes-pip.html` (`FX`, `burst`, `PRIZE_BOX`, `openPrize`).

- **Particles** (`apps/web/src/features/juice/particles/`): each effect style throws its own:
  Doodle Diary pen squiggles, loops and stars; Sticker Book stickers and hearts; Pop Burst gold
  coins and sparkles; Starlight drifting stars (they float up); Comic Pop dots with a POW!, ZAP!,
  WOW! or BAM! word on big moments; Garden Grow petals and leaves that sway; Pixel Arcade pixels
  (smooth, no stepping). Petal Glow (petals and sparkle), Turbo Drive (speed streaks) and Rainbow
  Parade (twinkling rainbow glitter) are live since J16. An unknown style uses
  Doodle Diary's.
- **Sizes** (`burstFor`): right answer 18 (from 4 in a row, 8 + 2 × combo, flying further);
  daily goal hit 22; topic complete 22 with a word; level up 28 with a word; reward unlock 30
  with a word; a style unlock 12; the prize box's wobbles 6, its opening 26 with a word, each
  reward 12. Comic words also show on any burst at power 1.3 or more.
- **Limits:** at most 30 particles in one burst and 90 on screen at once (bursts past that are
  trimmed or dropped). Web Animations move only transform and opacity, and each particle is
  removed when it lands. The layer is `aria-hidden` and lets taps through. Reduced motion: no
  particles at all.
- **Where:** right answers, the daily goal being hit and lesson complete (topic complete) today.
  `celebrate('levelUp' | 'styleUnlock' | 'rewardUnlock', element)` and `burstAt(element, options)`
  (from `features/juice`) are ready for level-up and style-unlock screens, which do not exist yet.
- **Prize box** (`apps/web/src/features/juice/prize/`): a native `<dialog>`. The den box (fox-ear
  knobs, star latch) drops in, wobbles three times with the wobble sound and small puffs (tap it
  to skip), bursts its lid open with the open sound, then each reward pops out one by one with its
  kind, name and "For: …" reason, a step sound and a small burst. Then **Collect** (focused) and
  the reward's own tiered sound. Escape closes it; Tab stays inside; focus goes back where it was.
  With reduced motion it opens at once with the full list. The "New reward" line and **See your
  rewards** stay on the screen after Collect. The step sound is U8's three-step `prizeBox` sound (`nodePop` until it lands). Bursts
  play U8's `particleBurst` sound, at most once every 140 ms and only when something flies; until
  it lands they add no sound of their own.

## Never (Children's Code and `REWARDS.md`)

- No lives or energy that run out and block learning; no waiting timers; no pay-to-continue.
- No countdowns or "come back or lose it" messages; no streak guilt. Reminders follow quiet hours.
- No random or mystery rewards; no near-miss tricks; no infinite "one more" loops past the daily
  cap. After the daily cap the call to action becomes "Great work today. See you tomorrow".
- No autoplay sound before the first tap; no flashing above 3 times a second (WCAG 2.3.1).

## Performance and accessibility

- CSS transforms and opacity only; particles capped (30 a burst, 90 on screen); 60 fps on a
  mid-range Android phone.
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
