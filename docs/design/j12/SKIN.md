# J12: one look for the whole student app (Doodle Diary skin, mockups only)

The owner: "The current styling is an odd mixture of doodle and the default we'd previously been
working with." [AUDIT.md](AUDIT.md) lists every mixed element. This page proposes one skin for all
of them and shows it on real screens. No product code has changed.

## How the mockups were made

The skin is a single throwaway stylesheet that Playwright injects into the real app pages (`dev`
with the mock API, made-up data). It restyles the shared components only, so the screenshots are
the real screens, not drawings. The three map layouts are the J12 layouts from
[README.md](README.md) with the same skin on top. The single-screen lesson and flashcard layouts
are a second small stylesheet on top of that. Neither stylesheet is in this pull request; the
build would put the same rules into the design tokens and components.

## The skin, as shared tokens and components

| Part                             | In the skin                                                                                                                                                                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tokens                           | `ink` (pen colour), `ink-soft`, `paper` (card surface), `page` (notebook background), `highlight` and `highlight-soft`, `wobble` and `wobble-sm` (the hand-drawn corner shapes), `lift` (a hard 3 × 4 px pen shadow). Light and dark sets. |
| Page                             | Notebook paper: warm off-white with faint ruled lines (night paper in dark mode). The doodle pattern setting still works on top.                                                                                                           |
| Headings                         | Page titles (h1) and card titles (h2) in Patrick Hand, one size up, with a wavy biro underline on page titles. Nothing else.                                                                                                               |
| Body text, questions and answers | **Nunito, unchanged.** Question prompts, answer options, flashcard text, feedback, labels and numbers are never handwritten.                                                                                                               |
| Cards, tiles, stat boxes         | Paper surface, 2 px ink edge with wobbly corners, and the pen shadow.                                                                                                                                                                      |
| Buttons                          | The same fill colours as today (so contrast is unchanged), with a 2 px ink edge, small wobbly corners and the pen shadow. They press down 2 px when tapped. Disabled buttons get a dashed edge and no shadow.                              |
| Chips, tabs, toggles, pills      | Paper with an ink edge. The selected one is coloured in with highlighter (bright yellow with dark text, in every theme, 11:1).                                                                                                             |
| Progress bars                    | An inked outline with a highlighter scribble fill (diagonal strokes). Success bars scribble in the success colour.                                                                                                                         |
| Topic hexes                      | Every outline in ink. Locked hexes are lightly hatched. Mastered keeps its highlighter hatching.                                                                                                                                           |
| Tab bar                          | A paper strip under a pen line. The current tab is circled in highlighter.                                                                                                                                                                 |
| Header buttons, toasts, inputs   | Paper, ink edge, small wobbly corners. Inputs are at least 44 px tall.                                                                                                                                                                     |
| Focus                            | A 3 px outline drawn **outside** the edge (4 px gap), so neither the wobble nor the pen shadow can hide it. Today's focus ring is a box shadow, which the pen shadow would replace, so the skin must switch to an outline.                 |

## Screens in the skin

| File                                                                             | What it shows                                                                            |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `skin/a-skin-light.png`, `-dark`, `-colourblind`                                 | Map layout A (collapsed units)                                                           |
| `skin/b-skin-light.png`, `-dark`, `-colourblind`                                 | Map layout B (one unit at a time)                                                        |
| `skin/c-skin-light.png`, `-dark`, `-colourblind`                                 | Map layout C (your path)                                                                 |
| `audit/lesson-single.png`, `-dark`                                               | Lesson question, single screen                                                           |
| `audit/lesson-answered-single.png`, `-dark`                                      | After Check: the right answer ringed green, feedback and Continue in the pinned bar      |
| `audit/cards-single.png`, `-dark`                                                | Flashcard question, single screen                                                        |
| `audit/cards-answer-single.png`, `-dark`                                         | Answer with Explain and the four ratings pinned above the tab bar                        |
| `audit/cards-explain-single.png`, `-dark`                                        | Explain: the answer shrinks to a strip, the steps sit under it, the ratings stay in view |
| `audit/rewards-skin.png`, `progress-skin.png`, `settings-skin.png` (and `-dark`) | Other screens in the same skin, unchanged layout                                         |

## Single-screen layouts (owner rule, 2026-11-26)

The rule is in `docs/PRODUCT_RULES.md` (Screen layout). Measured at 390 × 844:

| Screen              | Today                                      | In the mockup                                                                               |
| ------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Lesson, question    | 1.16 screens, Check in view                | Fits; Check is in a pinned bar                                                              |
| Lesson, after Check | Jumps 131 px; exit and progress go off top | No jump: the question stays put; verdict, answer, "Why?" and Continue sit in the pinned bar |
| Flashcard, question | 1.05 screens                               | Fits (1.0)                                                                                  |
| Flashcard, answer   | Ratings sit right on the tab bar           | Fits; ratings pinned above the tab bar                                                      |
| Flashcard, Explain  | Jumps 43 px; ratings under the tab bar     | Fits; the answer becomes a strip, so the steps and ratings are all in view                  |
| Map                 | 10.8 screens                               | 1.3 to 1.5 screens (layouts A to C)                                                         |

The page height can still be a little over 1.0 because the version footer sits below the task.
That's fine: the task and its button are all on the first screen.

What changes to get there:

- **Lesson:** the daily-goal bar and streak pill move out of the lesson (the map's Today strip
  has them; the lesson keeps its own progress bar). Pip's "Warm-up!" shrinks to one small line.
  Answer buttons are a little shorter. Check, then the feedback and Continue, live in a pinned
  action bar. The full explanation is behind "Why? Show the explanation". The automatic scroll
  after Check goes.
- **Flashcards:** the "Finish the session for 20 XP" note becomes the progress bar's label ("1 of
  5 cards, finish for 20 XP"). The deck name is one line. Show answer and the ratings are pinned
  above the tab bar. During Explain the answer shrinks to a strip.
- **Rewards and My stats** are the next biggest (4.6 and 2.3 screens). Not mocked here. The same
  approach applies: one summary card, with the rest behind tabs or "See all".

## Readability and contrast

- Body text stays in Nunito; only h1 and card titles use the hand font. Thanks to the J8 reading
  settings, the dyslexia-friendly font still replaces Nunito everywhere it's on.
- Button, text and success or danger colours are today's tokens, already checked for AA in light,
  dark and colour-blind (`themes.ts`, `NON_TEXT_PAIRS`). The skin adds:
  - ink edges (#2b2a3a on paper, 13:1; #ecebf6 on night paper, 14:1);
  - highlighter selections, always #ffe45c with #2b2a3a text (11:1).
- axe (WCAG 2.2 AA) was run on every skinned screen above, in light, dark, colour-blind light and
  colour-blind dark. Results are in "Checks" below.
- Wobbly corners are only a `border-radius`, so the hit area and the focus outline stay
  rectangular and complete.

## The unlockable styles

The lead suggested that the doodle skin becomes the app's base look, and the unlockables change
effects and sounds (and perhaps accents) only. **I agree, with one refinement: the unlockables also
own the "moment" screens.**

- **Base (always Doodle Diary):** every surface, card, button, chip, input, progress bar, the tab
  bar, hexes, headings and fonts. One look to design, test and keep accessible.
- **An unlockable style changes:**
  - **Effects and sounds:** bursts, confetti, combo badge, float-ups, set-complete stars and
    U's sound pack. This is what they already mostly do.
  - **An accent set:** a few tokens (highlight colour, the progress scribble colours, the mastered
    hex fill and the confetti palette). For example, Starlight's highlight is a pale star yellow on
    night paper, and Garden Grow's scribbles are leaf green. Every accent set has to pass the same
    contrast tests as the base (`NON_TEXT_PAIRS`) before it ships.
  - **The moment screens:** set complete, level up and reward reveals can take the style's full
    look. These are short celebrations, not places where you read or answer, so that's where a
    style earns its keep.
- **Not changed by any style:** body font, layout, the shape of cards and buttons, and anything
  in a question or answer.

Why not let each style reskin everything, as Sticker Book does today? Seven full skins means seven
times the contrast and layout checking, and the owner's complaint (a mixture) comes back as soon as
one style misses a component. Keeping the base fixed also means a new component only has to be
built once.

Today, Sticker Book, Pop Burst and the others restyle the map cards and lesson surroundings. Under
this proposal those rules shrink to an accent set plus their effects and moment screens.

## Proposed e2e check (for later)

A Playwright test, phone project only (390 × 844, default text), for each covered screen and each
step that changes the main button. It would stub the student API with `page.route`, as
`pages.spec.ts` already does for parent pages, because the e2e app has no mock API.

```ts
const SINGLE_SCREEN = [
  { path: '/map', button: /^go/i },
  { path: '/cards', button: /show answer/i },
  { path: '/cards', before: /show answer/i, button: /^good/i },
  { path: '/learn/topic/demo-topic-a', button: /^check$/i },
  // …and the starting test, 5-a-day, recall, set complete and the Me page
];

for (const s of SINGLE_SCREEN) {
  test(`${s.path}: the main button is on screen at 390 × 844`, async ({ page }) => {
    await stubStudentApi(page);
    await page.goto(s.path);
    if (s.before) await page.getByRole('button', { name: s.before }).click();
    const main = page
      .getByRole('button', { name: s.button })
      .or(page.getByRole('link', { name: s.button }))
      .first();
    await expect(main).toBeInViewport({ ratio: 1 });
    // Not hidden under the tab bar, and the page didn't jump to show it.
    const nav = await page.locator('.main-nav').boundingBox();
    const box = await main.boundingBox();
    if (nav && box) expect(box.y + box.height).toBeLessThanOrEqual(nav.y);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
}
```

This test would fail today on the flashcard Explain step and on the lesson after Check (the page
jumps), so it lands with the layout work, not before.

## Checks

axe (WCAG 2.2 A and AA) on the skinned screens at 390 × 844, in light, dark, colour-blind light
and colour-blind dark (32 runs):

- Map layouts A, B and C, the lesson, Rewards, My stats and Settings: no problems.
- Flashcards: one finding, on the flip card's name ("Label in Name"). It is on today's screen too,
  without the skin; see AUDIT.md.

No skinned screen scrolls sideways at 390 px.
