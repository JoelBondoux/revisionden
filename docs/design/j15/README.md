# J15: less wordy, less boxy, more juice (mockups only)

Owner feedback on the J13 skin, 2026-11-26: "Something's missing. Too wordy, too boxy, not enough
eye candy, movement or enticing call to action." Then a second owner idea: Pip in a round button at
the top left, animating, which takes you to a Home dashboard.

These are drawn mockups. They come from a small throwaway prototype (`prototype.html`, made-up data,
the real Doodle Diary tokens and fonts), not from the app. No product code has changed.

## What changes

| Owner note           | What the mockups do                                                                                                                                                                                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Too wordy            | No helper sentences. Every block is an icon, a number and a 1–2 word label ("Up next", "Fix these", "This week"). Today's goals are three rings with numbers under them.                                                                             |
| Too boxy             | No card-in-card. Sections sit straight on the notebook page, divided by slanted colour fields (highlighter yellow behind the main action, sky blue behind the unit name). Only things you can tap have an ink edge.                                  |
| Not enough eye candy | Big rings, a flame, day dots, a gift, the fox. The topic map is a pen-drawn trail of big hexes with no outer card.                                                                                                                                   |
| Not enough movement  | Pip's idle loop; the main button gently bobs; rings fill and numbers count up when Home opens; the gift wiggles; the next topic glows. Reduced motion: all of it stops (still poses, no bob, numbers appear at once): see `home-reduced-motion.png`. |
| No enticing CTA      | One big, bright button per screen: **Fractions ▶** on Home, **Go!** on the next topic, **Check / Continue** in the lesson. Nothing else on the screen is that colour.                                                                                |

## Pip, the Home button

- A 60 px round button at the top left of every student screen except the lesson player and test
  mode. Accessible name "Home". The sound and bug buttons stay on the right. It never covers content.
- Idle actions, one at a time with rests between: blink, wave, stretch, read a book, peek at a
  timer, cheer (when a goal is hit) and nap (outside study hours). See `pip-poses.png` and
  `pip-idle.mp4`.
- **Lesson and test mode:** Pip sits top right as a small picture, not a button (the lesson already
  has its own exit, so a second way out would be easy to tap by mistake). No idle motion, reactions
  only: a nod and a cheer on a right answer, an encouraging look on a wrong one.
- Reduced motion: a still pose (the book or the stars show; nothing moves).
- Per style: the ring and fill take the style's accent (yellow highlighter in Doodle Diary, glossy
  pink in Pop Burst). The fox art is unchanged. Final poses would get a proper illustration pass;
  these are quick shapes on the existing Pip.

## Home (Pip's destination)

One screen at 390 × 844, with nothing below the tab bar:

1. Level and XP ring, streak, and today's goal rings (XP, 5-a-day, cards due).
2. **Up next**: the one big mission button (bobbing).
3. **Fix these**: weak spots as a sideways chip row (a contained scroller).
4. Friends-league rank chip (dashed: a placeholder until FL ships).
5. **This week**: the reward week as day dots and a gift.

Numbers count up and rings fill on arrival (K5's count-up). At 320 px nothing goes sideways; on a
short screen the page scrolls down instead of squashing (`home-320.png`).

## Map: topics only

The Today strip moves to Home, so the map shows only topics:

- unit hexes along the top;
- the unit's name and progress on a colour field;
- the unit's topics as a winding pen trail.

The next topic is the biggest hex, glowing, with its own **Go!**. Weak topics are orange. Locked topics are hatched.

## Tap Pip to go Home

`tap-to-home.mp4` (Doodle Diary: a page turn) and `tap-to-home-pop.mp4` (Pop Burst: a bouncy pop-in).
Each is about 0.3 s, never blocks input, and is an instant swap with reduced motion. This uses the
same per-style transition idea as J15a.

## Lesson

- The question and an optional figure sit at the top, on the open page.
- The answers are four big sticker buttons in thumb reach, above one wide **Check** button.
- On a right answer:
  - the answer turns green with a tick, and "Nailed it! +10 XP" appears;
  - the combo pops and the progress bar fills;
  - Pip nods, and **Check** becomes **Continue**.
- See `lesson-right.mp4`. The question is a stand-in for a real verified item.

## Files

| File                                      | What                                                     |
| ----------------------------------------- | -------------------------------------------------------- |
| `home-light.png`, `home-dark.png`         | Home, Doodle Diary                                       |
| `home-pop.png`                            | Home, Pop Burst accents (same layout)                    |
| `home-320.png`, `home-reduced-motion.png` | Home at 320 px; Home with motion off                     |
| `map-light.png`, `map-dark.png`           | Map, topics only                                         |
| `lesson-question.png`, `lesson-right.png` | Lesson: answer chosen; after Check                       |
| `pip-poses.png`                           | blink, wave, stretch, read, timer, cheer, nap            |
| `pip-idle.mp4`                            | Pip's idle loop on Home (sped up: every 1.5 s, not ~8 s) |
| `tap-to-home.mp4`, `tap-to-home.gif`      | Map → tap Pip → Home (Doodle Diary)                      |
| `tap-to-home-pop.mp4`, `lesson-right.mp4` | The same in Pop Burst; a right answer in the lesson      |
| `prototype.html`                          | The throwaway prototype (opens from a checkout)          |

## Still to decide

- Whether Home replaces the Map as the first screen after sign-in (the mockups assume yes).
- How often Pip moves: the recording is sped up; the build would rest about 8 seconds between
  actions, and stop after a minute without input so it never nags.

## Pip's outfits and touches (owner direction, 2026-11-26)

`pip-outfits.png` shows the real, code-drawn Pip that the build uses (J15b).

- **He leans out of his round frame:** the top of the ring sits behind his head, the bottom in front of his body. The arm grows from the shoulder in every pose.
- **Outfits by subject:** one worn item (a pencil, glasses, goggles, a collar, a hat, a headset...). On Home he also has a subject prop and a faint tint.
- **Unisex touches:** a moustache, a bow, freckles or nothing. They rotate by day and are never tied to a subject or to the student.
- **Idle actions:** the third row shows them as stills. With reduced motion only the still shows.
