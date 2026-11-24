# Rewards and progression

> Live document. Rewards must keep a student motivated for **five years of study**: GCSE
> (Years 9 to 11) and A-Level (Years 12 and 13). Rules here are implemented in `packages/core`
> with tests. Short facts live in `project_memory/domain/product-facts.md`.

## Principles

1. **Something to earn every week, something to chase every year.** Small wins often, big wins
   rarely, nothing that runs out.
2. **Rewards follow learning, not screen time.** They come from mastery, practice, verified
   progress and kindness, never from minutes spent or taps.
3. **Fair across subjects and levels.** Targets scale with the student's own course, so an A-Level
   student and a Year 9 student both have reachable goals.
4. **No pay-to-win and no loot boxes.** Every reward has a stated target; no random paid draws.
5. **Nothing is ever lost.** Everything earned carries over from GCSE to A-Level.
6. **Healthy limits.** No rewards for studying late at night or past the daily cap.

## The five layers

| Layer          | What it is                                                    | Spans                |
| -------------- | ------------------------------------------------------------- | -------------------- |
| Level          | XP levels 1 to 100, with a gentle curve                       | All five years       |
| Year chapters  | A themed reward track per school year (about 30 unlocks each) | One school year each |
| Milestones     | Long-term achievements (streaks, mastery, papers, grades)     | All five years       |
| Collections    | Sets of items; completing a set unlocks a bonus item          | All five years       |
| Seasonal drops | New items each term, earned through that term's challenges    | Each term            |

### 1. Levels (1 to 100)

- XP from correct answers, lessons, flashcards, papers and verified homework.
- Curve tuned so a student practising most days reaches about level 20 a year, level 100 near
  the end of Year 13. A level-up every week or two early on, every few weeks later.
- Every level unlocks something small (a colour, a frame, a title); every 10th level unlocks a
  rare item.
- After level 100: **prestige stars** (up to 5) and gold frames, so it never stops.

### 2. Year chapters

Each school year has its own themed track that opens in September and stays available forever.

| Chapter | Year    | Theme idea                | Finale reward                                                  |
| ------- | ------- | ------------------------- | -------------------------------------------------------------- |
| 1       | Year 9  | First steps into GCSE     | Chapter badge and hoodie                                       |
| 2       | Year 10 | Building up (mocks begin) | Rare jacket and scene                                          |
| 3       | Year 11 | Exam year                 | "GCSE finisher" legendary set, given when the last exam is sat |
| 4       | Year 12 | Sixth form                | Sixth-form wardrobe tier opens                                 |
| 5       | Year 13 | Final year                | "A-Level finisher" legendary set                               |

A student who joins mid-way (for example in Year 12) starts at that chapter; earlier chapters
remain earnable for collectors.

### 3. Milestones

| Kind                          | Steps                                                                    |
| ----------------------------- | ------------------------------------------------------------------------ |
| Streak days                   | 7, 30, 60, 100, 180, 365, 500, 750, 1,000                                |
| Questions answered correctly  | 100, 500, 1,000, 2,500, 5,000, 10,000, 25,000                            |
| Topics mastered (per subject) | 5, 10, 25, 50%, 75%, all topics ("Subject master")                       |
| Weak spots fixed              | 10, 25, 50, 100, 250                                                     |
| Full past papers              | 1, 5, 10, 25, 50, 100                                                    |
| Mock and assessment grades    | target hit once; target hit in every subject; beat target                |
| Flashcards reviewed           | 500, 2,500, 10,000                                                       |
| Kindness                      | gift days given: 3, 10, 25; different friends helped: 5, 15              |
| Friends league                | weekly win; 5 wins; 20 wins                                              |
| Exams                         | first GCSE exam sat; all GCSEs sat; first A-Level exam; all A-Levels sat |

Streak milestones also grant gift days (7 → 1, 30 → 2, 100 → 3, 365 → 5, 1,000 → 10).

### 4. Collections

Items belong to sets (for example "Gig kit", "Skate crew", "Pitch day", "Pixel world",
"Dino expedition", "Cinema night"). Completing a set unlocks a bonus item and a profile title.

### 5. Seasonal drops

- Each term (6 a year, 30 over five years) brings about 8 to 12 new original items tied to a
  short challenge (for example "master 3 topics this half-term").
- Exam-season drops reward revision consistency, not cramming.
- Missed drops come back later as collection items, so nothing is gone for good.

## Rarity

| Rarity    | Typical source                                                  | Share of items |
| --------- | --------------------------------------------------------------- | -------------- |
| Common    | Levels, early milestones                                        | About 50%      |
| Rare      | Every 10th level, chapter steps, mid milestones                 | About 30%      |
| Epic      | Chapter finales, collections, big milestones                    | About 15%      |
| Legendary | Year 11 and Year 13 finishers, 1,000-day streak, Subject master | About 5%       |

## Volume

| Source                                | Over five years |
| ------------------------------------- | --------------- |
| Level unlocks (100 levels + prestige) | About 110       |
| Year chapters (5 × about 30)          | About 150       |
| Milestones                            | About 70        |
| Collections bonuses                   | About 20        |
| Seasonal drops (30 terms × about 10)  | About 300       |
| **Total**                             | **About 650**   |

Rewards are not only avatar items: profile frames, titles ("Algebra Ace"), app colour themes,
Pip the fox outfits and extra gift days.

## Parent-set rewards

Parents can add their own real-world rewards to any target (for example "cinema trip at a
100-day streak" or "new game when the Year 10 mocks hit target"). Built in R5.

- The parent sets a title (up to 60 characters), an optional note (up to 200), and a target:
  any target type from the catalogue (streak days, questions correct, topics mastered, weak spots
  fixed, papers, mock or assessment grades, level) or a custom date.
- The student sees it in their track with a "from home" badge and their progress towards it.
- When the target is met: a celebration for the student and a notification for the parent.
- The parent marks it "given". Before that the parent can edit or delete it; once given it is
  kept as history and cannot be changed.
- The student cannot send free text to the parent about it (no chat).
- Progress also shows on the parent stats dashboard (`PRODUCT_RULES.md`, statistics dashboards).

## Content pipeline for new items

- Items are original SVG art in the app's style, inspired by the student's hobbies (music,
  football, skateboarding, films, gaming) and never copying games, brands or characters.
- New items are added each term as data (catalogue entries plus SVG layers), reviewed in a pull
  request like any other change.
