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

## Parent focus

- Parent picks a subject or a topic and a nudge: light, medium or strong.
- Weights added to the focus subject's share of sessions: light +10, medium +22, strong +38
  percentage points before normalising.
- The student gets double XP on the focus that week. Weak-spot picks still come first.

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
friendship (gift 3 days, gift to 5 friends), competition (top of friends league), and easy early
wins (starting test, 25 right in a row).
