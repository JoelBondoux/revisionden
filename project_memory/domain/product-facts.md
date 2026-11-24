# Product facts

Tags: #product #rules #limits #defaults

> Maintained page. Short, verified facts about what RevisionDen does. Update it in the same change
> as any code or rule change that alters a fact. Detail: `docs/PRODUCT_RULES.md`.

## Users and accounts

- One parent account per family; signs in with Google or Microsoft. Apple sign-in deferred (needs
  a paid Apple developer membership).
- Students have no outside account: nickname (2–16 letters, numbers, underscore), avatar code and
  year group only. Devices linked by a one-time QR token (10 minutes, single use), then a passkey.

## Subjects

- GCSE: English Language, English Literature, Maths, Biology, Chemistry, Physics, Drama, Film
  Studies, French, History. A-Level: Maths, Further Maths, Computer Science, Physics.
- Exam boards and tiers are picked in the app; "not sure" is allowed and reminded later.
- GCSE Film Studies is offered only by WJEC Eduqas.

## Learning rules

- Feedback levels 1–4 (every question, every 5, end of topic, full paper), per topic.
  Up when the last-3-set average reaches last summer's boundary for the target grade; down below
  the boundary one grade under target. Implemented in `packages/core/src/feedback-level.ts`.
- Learn mode shows results live; Test mode only after submit, one attempt.
- Parent focus weights: light +10, medium +22, strong +38 percentage points; double XP on focus.
- Parent focus adds the points to the focus subject's share before normalising; a subject's base
  share follows how weak its topics are. Weak spots (below 60% mastery) come first; never more
  than 3 items in a row from one topic. Implemented in `packages/core/src/next-item.ts`.
- Skip days: earned by weekly goal (default 5 days with the daily goal met; daily goal default
  50 XP), max 2 in a row. Gift days: come with streak badges (1, 2, 3 for 7, 30, 100 days), only
  given away (arrive as a skip day for the friend), +20 XP for gifting. Implemented in
  `packages/core/src/streaks.ts` and `xp.ts`.
- XP per correct answer: flashcard 5, multiple choice 10, short answer or numeric 15, working 20,
  long answer 30; part marks earn part.
- 14 rewards, each unlocking one avatar item: `packages/core/src/rewards.ts`.
- Effort scores (e.g. CBI: Commitment, Behaviour and Inspiration, 1–4, 4 best) shape habits, never
  the predicted grade.

## AI

- Every AI-marked result says: "Marked by AI. This is a guide to help you improve, not your
  teacher's mark." AI never rewrites a student's work.
- Quick feedback: Claude Haiku 5.5. Long answers and homework: Claude Opus 5.5. Maths: no AI.
- Question banks are written in subscription working sessions; live AI is capped per child.

## Versions and releases

- Format `xx.xx.xxx`; started `00.01.000`; every push to `main` bumps the patch automatically.
