# Product rules

> Live document. These are the agreed rules. Each one is implemented in `packages/core` with tests.
> Change a rule here and in its tests in the same pull request.

## Feedback levels

| Level | Student sees results             |
| ----- | -------------------------------- |
| 1     | After every question             |
| 2     | After every 5 questions          |
| 3     | At the end of a topic            |
| 4     | At the end of a full timed paper |

- Tracked per topic.
- **Move up:** the average of the last 3 sets is at or above last summer's grade boundary (as a
  percentage) for the student's target grade, for their board and tier.
- **Move down:** the average falls below the boundary one grade under target. Can happen with
  fewer than 3 sets.
- No target yet: use the predicted grade. Boundaries update each August.
- Implemented: `packages/core/src/feedback-level.ts`.

## Learn and Test modes

- Learn shows results live as the student interacts.
- Test hides results until the student submits. One attempt.

## XP, streaks, skip days and gift days

- A streak day counts when the daily goal is met.
- **Skip days** are earned by hitting the weekly goal. They protect the student's own streak.
  Up to 2 in a row.
- **Gift days** come with some rewards (for example streak badges). They can only be given to a
  friend, never used on the student's own streak. Gifting earns 20 XP.
- Details settled in code:
  - XP per correct answer: flashcard 5, multiple choice 10, short answer 15, numeric 15, working
    20, long answer 30. Part marks earn part of it (rounded). Wrong answers earn 0.
  - Daily goal defaults to 50 XP. Weekly goal defaults to the daily goal met on 5 days; each week
    hit earns 1 skip day (paid once per week).
  - A skip day keeps the streak but does not add to it. A day with no activity counts as missed.
  - A gifted day arrives as a skip day for the friend (still limited to 2 in a row).
- Implemented: `packages/core/src/xp.ts`, `packages/core/src/streaks.ts`.

## Study plan rules

- Sessions can be dragged to another day or edited (day, length, type, time of day, note).
- After a move or edit, the app offers to turn it into a rule (for example "Always do Maths on
  Wednesdays", "Keep Fridays free for football training", "Biology sessions are 25 minutes").
  "Just this week" changes only this week.
- Rules belong to a student, can be switched on and off or removed, and are applied every time the
  plan is built. Weak-spot priority and exam dates still apply within the rules.
- If rules conflict or leave too little time before an exam, the planner says so instead of
  silently breaking a rule.
- Edits show who made them (parent or student).

## Parent focus

- Parent picks a subject or a topic and a nudge: light, medium or strong.
- Weights added to the focus subject's share of sessions: light +10, medium +22, strong +38
  percentage points before normalising.
- The student gets double XP on the focus that week. Weak-spot picks still come first.
- Details settled in code:
  - Each topic's weight is (100 − mastery) + 5. A subject's share is the sum of its topics'
    weights, so the weakest topic overall gets the most picks. A topic focus adds the points to
    that topic's share instead.
  - Focus changes how many picks a subject gets; it never changes the order. Within a batch,
    weak spots (mastery below 60) come first, weakest first.
  - No more than 3 items in a row from one topic, counting the items served just before. If that
    cannot be kept (for example only one topic has items left), the batch is cut short.
  - Within a topic, due flashcards come before questions.
- Implemented: `packages/core/src/next-item.ts` (seeded randomness from `rng.ts`).

## Effort scores (for example CBI)

- Set up per school: name, scale (1–4, 1–5, letters, words), which end is best, grade columns.
- Converted to one internal effort meter (0–100%).
- A low effort score adds a short daily goal in that subject and a weekly parent check-in. It
  never changes the predicted grade.

## Predicted grade

- Built from mock and assessment results, quiz performance and the school's progress indicator.
- Always shown as an estimate.

## AI marking

- Every AI-marked result carries the label: "Marked by AI. This is a guide to help you improve,
  not your teacher's mark."
- AI never rewrites a student's work; it points out what to improve.
- Students confirm the transcription of photographed work before marking.

## Rewards (avatar unlocks)

Targets vary: streaks (7, 30, 100 days), grades (target hit in a mock, every target at an
assessment), practice (full past paper, 10 weak spots fixed, 10 topics mastered, perfect set),
friendship (gift 3 days, gift to 5 friends), competition (top of friends league for a week), and
easy early wins (starting test, 25 right in a row).

- Each reward unlocks one avatar item. Streak badges come with gift days: 7 days → 1, 30 days → 2,
  100 days → 3.
- Implemented: `packages/core/src/rewards.ts`.

## Nickname and avatar

- Nickname: 2–16 letters (A–Z), numbers and underscores, not on the block list. Strong words are
  blocked anywhere (number swaps such as `sh1t` and underscores are seen through); short words
  that hide inside ordinary words (for example "ass" in "class") only when they stand alone.
  Names pretending to be staff (admin, teacher, moderator) are blocked.
- Avatar code: version `1` then two base-36 characters per layer, in this order: skin, eyes,
  mouth, facial hair, hair style, hair colour, top, top colour, eyewear, headwear, held item,
  background colour, pattern, scene. Locked items are rejected unless their reward is earned.
- Implemented: `packages/core/src/nickname.ts`, `packages/core/src/avatar.ts`.

## Learning loop (workstream F)

- **Content gate.** Students only ever see items whose verification status is `verified`.
  Drafts are served only when `SERVE_DRAFT_CONTENT=true` in development (never in staging or
  production), and the app then shows a "DRAFT CONTENT" banner. Quarantined and retired items
  are never served. Answers to items that may not be served are refused (404).
- **Starting test** per subject: about 5 minutes (300 seconds, up to 10 questions), Test mode
  (no feedback until the end). One question per topic before a second from any topic, middle
  difficulty (3) preferred; no flashcards or long answers. Its answers set the first mastery for
  each topic it covers.
- **Lessons** run in Learn mode at feedback level 1: every answer is marked at once with the right
  answer, the explanation and, for maths working, the first line that goes wrong (maths engine,
  no AI). Long answers are shown with a "marked by AI soon" note and are not marked yet.
- **Mastery** of a topic is recomputed from the student's last 30 attempts after every answer.
- **Wrong answers** in a lesson (Learn mode, not the starting test) become a flashcard due at once,
  once per question.
- **Flashcard buttons:** Again (SM-2 quality 1, back in 10 minutes), Hard (3), Good (4), Easy (5).
  Each button shows when the card would come back, worked out by the scheduler. Reviewing a card
  in a deck earns 2 XP (approved flashcards design). Deck cards come from flashcard items in the
  student's enrolled subjects; students can add their own cards (front and back up to 300
  characters) to a topic.
- **Daily goal and streak:** XP is totalled per day in UK time (Europe/London). The first time a
  day's total reaches the daily goal (50 XP) the day counts on the streak, once. On the first goal
  day of a new week, last week is settled (a skip day if the weekly goal was hit). A streak with
  missed days shows as lapsed (or kept by skip days) before anything is saved.
- **Command-word lessons** (exam technique basics) are items tagged `command-word` in `content/`.
  None are verified yet, so the lesson says nothing is ready.
- Implemented: `packages/core/src/learning.ts`, `apps/api/src/routes/learn.ts`,
  `apps/api/src/routes/flashcards.ts`.

## Flashcards and mastery

- Flashcards follow SM-2: intervals 1 day, 6 days, then interval × ease; a wrong card comes back
  within 10 minutes. Due cards are ordered by how late they are compared with their interval.
- Mastery 0–100: weighted average of the last 30 attempts; weights halve every 30 days; two
  imaginary wrong answers as a starting point, so mastery is earned and fades without practice.
  A weak spot is a topic below 60.
- Implemented: `packages/core/src/spaced-repetition.ts`, `packages/core/src/mastery.ts`.
