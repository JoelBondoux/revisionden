# Exam practice (timed papers)

> Live document. Requested by the product owner on 2026-11-25. Students sit a full paper in real
> time, then get marks and commentary, including pacing. Workstream X (queued).

## What the student does

1. Choose a paper for one of their subjects (board, tier and paper number match their enrolment).
2. Choose **Exam conditions** (no hints, no feedback, one clock, no pausing except a single
   "I need a break" that is recorded) or **Practice** (pause allowed, same marking at the end).
3. Sit the paper. The clock counts down from the paper's official time, with their access
   arrangement applied (for example 25% extra time, set by the parent). Each question records
   the time spent on it; going back to a question adds to its time.
4. At the end (or when time runs out) everything is marked together, like Test mode.

## Results and commentary

- **Marks** per question and in total, with the grade it would have earned against the most recent
  published grade boundaries (the same boundary data the feedback levels use).
- **Pacing:** the target time per question is its marks × the paper's minutes per mark (official
  duration ÷ total marks; both from the board's specification or sample paper, cited). The report
  shows time spent against target for every question, flags questions that took more than 1.5×
  their target, questions rushed (under 0.5× with marks lost) and where the student ran out of
  time, and suggests a plan (for example "Aim to finish section A by minute 35").
- **How to do better:** per question, the marks lost and the mark-scheme point missed. For long
  answers, AI commentary marked "Marked by AI. This is a guide…", following the double-marking rule
  in `PRODUCT_RULES.md`. Pacing advice is worked out by rules, not AI.
- Weak topics from the paper feed the study plan and the topic map; the paper counts towards the
  "Full past papers" milestones.

## Where the papers come from (copyright)

Exam boards own past papers and mark schemes, so the app does not copy them in. Two kinds of paper:

| Kind                     | What it is                                                                                                                                                                                                               | Marking                                                                                                                                                                                                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Board-style papers**   | Built from our own verified items to the official paper's structure: same sections, question types, mark totals and duration (structure cited from the specification and sample assessment materials). Fully in the app. | In the app: maths engine, rules and verified mark schemes; AI only for long answers (double-marked).                                                                                                                                                                                       |
| **Official past papers** | The app opens the board's own PDF from its website (link, never a copy). The student writes on paper or in the app's working pad, tapping "Next question" so each question is timed.                                     | Self-marking with the board's published mark scheme (opened from the board's site, not copied), with the app guiding mark entry per question; or a photo of each answer marked by AI through the Mark my homework flow, labelled as AI marking. Pacing commentary works the same for both. |

Board-style papers come first (no copyright risk, fully automatic marking). Official past papers
follow, as links only; the legal review (`docs/LEGAL.md`) should confirm the approach before release.

## Rules

- Timings, mark totals and grade boundaries are facts and follow `docs/VERIFICATION.md` (official
  citation required). No made-up durations.
- Healthy limits: a paper can run past the daily study cap; the cap then pauses other activities for
  the rest of the day. No papers in quiet hours unless the parent allows it.
- Parents see results, pacing and time taken on the parent dashboard.
- Sounds and game-feel effects stay off during the paper (exam calm); the results screen uses the
  normal set-complete celebration.
