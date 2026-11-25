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

**Formula (implemented in `packages/core/src/levels.ts`).** The XP to go from level L to L + 1
is `min(750, 300 + 50 × (L − 1))`: 300 XP for level 2, rising by 50 a level until it reaches
750 XP at level 10 and stays there. Level 20 needs 12,000 XP in total and level 100 needs
72,000 XP. Each prestige star after level 100 needs another 7,500 XP (ten levels' worth).

**Assumptions behind the tuning** (exported constants, checked by tests):

- A practice day earns about **60 XP** (the 50 XP daily goal plus a little more).
- A school year has about **250 practice days** (most school days plus some in the holidays),
  so about 15,000 XP a year and about 300 XP a week.
- That gives a level-up about every week at first and every two to three weeks from level 10;
  about level 24 after Year 9, then about 20 levels a year, and level 100 about 4.8 school years
  in (late in Year 13). Students who practise less still level up, just more slowly.

**Which XP counts** (`packages/core/src/reward-xp.ts`): XP from answers and completed flashcard
sessions only (never minutes or taps); XP earned **late at night (22:00 to 05:59 UK time)** does not count; at most **300 XP a
UK day** counts (five times the daily goal). The XP still shows and still counts for the daily
goal; it just does not move levels, chapters or seasonal challenges.

**Flashcards and pacing.** A completed flashcard session of 5+ cards earns 20 XP, at most 2 a day
(40 XP), below the 50 XP daily goal. A student who only did flashcards would earn about
40 × 250 = 10,000 XP a school year, slower than the 15,000 the curve assumes (60 XP × 250 days),
so tapping through cards can never outpace real practice. The "flashcards reviewed" milestones
count cards in completed sessions.

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

**How it works (`packages/core/src/chapters.ts`, `catalogue/chapters.ts`).** Each chapter has 30
steps: 29 steps one every 400 chapter XP (12,000 XP fills a chapter, a little under a year of
daily practice) and a finale. Chapter XP is reward XP earned during that chapter's school year
(school years start on 1 September). Once a chapter is full, extra XP from that year spills into
the earliest unfinished earlier chapter, which is how a mid-way joiner can still collect
chapters 1 to 3; nothing spills forward. Steps 10, 20 and 25 are epic Pip outfits, other even
steps are rare. The Year 11 and Year 13 finales are given when the last GCSE or A-Level exam is
sat. A-Level students (Year 12 and up) count as having sat their GCSEs, so the GCSE finisher set
carries over. Nothing resets at A-Level: level, XP and every earned item carry over.

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

A set is a list of reward ids from any source (levels, chapters, milestones). The six hobby
sets give an epic bonus (a Pip outfit or frame plus a title); each term's seasonal drop is also a
set whose bonus is a "collector" title (`packages/core/src/catalogue/collections.ts`).

### 5. Seasonal drops

- Each term (6 a year, 30 over five years) brings about 8 to 12 new original items tied to a
  short challenge (for example "master 3 topics this half-term").
- Exam-season drops reward revision consistency, not cramming.
- Missed drops come back later as collection items, so nothing is gone for good.

The 2026/27 drops are in `packages/core/src/catalogue/seasons.ts`: six back-to-back windows
(1 Sep to 1 Nov, 2 Nov to 3 Jan, 4 Jan to 21 Feb, 22 Feb to 11 Apr, 12 Apr to 6 Jun, 7 Jun to
31 Aug), 8 items each at rising challenge targets (3 common, 3 rare, 2 epic). The challenge
counts right answers or daily-goal days inside the window only; the summer exam-term drop
counts goal days (consistency, not cramming). Each drop comes back for the same window a year
later. Later years' drops are added as data each term.

## Rarity

Each rarity has its own reward sound, bigger as the rarity rises (`PRODUCT_RULES.md`, sound
effects).

| Rarity    | Typical source                                                  | Share of items |
| --------- | --------------------------------------------------------------- | -------------- |
| Common    | Levels, early milestones                                        | About 50%      |
| Rare      | Every 10th level, chapter steps, mid milestones                 | About 30%      |
| Epic      | Chapter finales, collections, big milestones                    | About 15%      |
| Legendary | Year 11 and Year 13 finishers, 1,000-day streak, Subject master | About 5%       |

The catalogue validator test checks the shares stay within 6 points of these. Today (369
rewards): common 52.6%, rare 30.6%, epic 14.6%, legendary 2.7%.

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

**Built so far** (the rest arrive as seasonal data each term): 99 level rewards and 5 prestige
stars, 150 chapter steps, 55 milestones, 12 collection bonuses and 48 seasonal items for
2026/27 (369 in total). The catalogue is data in `packages/core/src/catalogue/`; each entry has
an id, name, rarity, source, one stated target (a stat, a collection or a seasonal challenge),
the items it gives and its gift days. The 14 original reward ids are unchanged, so rewards
already earned stay earned. Avatar items only unlock from the reward that locks them in
`AVATAR_CATALOGUE`; new avatar items are always appended to their layer so saved avatar codes
keep working.

## Guard rails (tested)

- No reward stat measures time spent, sessions or app opens; late-night XP never counts.
- No randomness anywhere in the rewards code; every reward has a fixed, stated target.
- Avatar items are rejected until their reward is earned.
- Each reward is stored once (student + reward id), so gift days that come with it are added
  once.

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

**Built (R5):** `parent_rewards` table; routes in `apps/api/src/routes/rewards.ts` (add, edit,
delete, mark given; editing or deleting a given reward answers 409); target = a catalogue
reward, a stat reaching a number (level, streak and the rest) or a UK date. The student's
`/rewards` screen shows them under "From home" with progress and a "Target met" celebration;
the parent manages them at `/family/:id/rewards` (linked from the family list and the parent
home at `/parent`). Not built yet: the panel on the parent stats dashboard (workstream K).

**Parent notification (H2):** when a target is met and the reward is not marked given, each
parent device with "Reward news" turned on (parent home, `/parent`) gets one web push, once per
reward (`parent_rewards.reached_notified_at`, migration 0007). The push has no payload; the
service worker fetches "<nickname> reached a reward target: <title>" from
`GET /v1/parent/notifications/latest`. It waits out the nightly quiet hours and time zone set for
that child; the weekday school-hours window and the child's reminder switch do not apply. It is
not one of the child's 2 reminders a day. If no parent device has it on, nothing is used up: the
parent is told once they turn it on (while the reward is still not given). Code:
`apps/api/src/notifications/parent-rewards.ts`, run by the 15-minute cron.

## Bug Hunter track (hidden)

Requested by the product owner on 2026-11-25. Rewards students who help make the app better.

- A student who reports a bug (bug icon or error report) that the operator then **confirms** gets
  **+50 XP** and moves one step along the **Bug Hunter** track.
- The track is hidden: it appears in the student's rewards only after their first confirmed bug.
- Steps (customisations, all original art): 1 bug badge; 2 "Bug Hunter" title; 3 magnifying-glass
  avatar item; 5 circuit-board profile frame; 8 Pip "debug" outfit; 12 glitch avatar effect;
  20 legendary "Exterminator" set.
- Fair play: one reward per distinct bug. Duplicates of a bug already confirmed for someone else
  earn a smaller "Thanks for confirming" (+10 XP, no track step). At most 3 confirmed-bug rewards a
  week. Parents' reports are thanked but do not earn student rewards. The operator's decision is
  final; nothing is automatic.

## Secret achievements

- A set of achievements whose names and conditions are hidden until earned. The rewards page shows
  them as locked "???" cards with a count ("Secret achievements: 3 of 24 found"), plus a vague hint
  for some (for example "Something about comebacks…").
- Earning one reveals it with its own reward sound tier and a celebration.
- Conditions follow learning, never screen time, late nights or spending (the principles above).
  Examples: a perfect set straight after a wrong answer streak ("Comeback"), practise every
  enrolled subject in one week, a 10-answer combo, fix 3 weak spots in a day, finish a timed paper
  with every question on pace, review 100 flashcards in finished sessions in a week, gift a day to
  3 different friends.
- They are defined as data in the reward catalogue like other rewards (with `secret: true`), so
  they are tested and can be added each term.

## Content pipeline for new items

- Items are original SVG art in the app's style, inspired by the student's hobbies (music,
  football, skateboarding, films, gaming) and never copying games, brands or characters.
- New items are added each term as data (catalogue entries plus SVG layers), reviewed in a pull
  request like any other change.
