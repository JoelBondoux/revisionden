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
- Skip days: earned by weekly goal, max 2 in a row. Gift days: come with rewards, only given away,
  +20 XP for gifting.
- Effort scores (e.g. CBI: Commitment, Behaviour and Inspiration, 1–4, 4 best) shape habits, never
  the predicted grade.

## Content

- Content is JSON in `content/`, checked by `pnpm content:validate` (schemas in
  `content/schemas/`). Every item has `source_ref` and `checked_by`; every topic-tree leaf has a
  specification reference; trees are at most 3 levels deep. Detail: `docs/CONTENT_PLAN.md`.
- Every maths answer (numeric and worked maths items, and model solutions) is verified by the
  maths engine before content can merge.
- Pilot: GCSE Maths Higher, Pearson Edexcel 1MA1 (content references N1 to S6).

## Maths engine

- `services/maths`: SymPy, no AI. `POST /check-working` returns the 0-based index of the first
  line of working that does not follow from the previous line, and whether the final answer is
  correct. Input is limited to safe maths (single letters, a few functions, 200 characters).

## AI

- Every AI-marked result says: "Marked by AI. This is a guide to help you improve, not your
  teacher's mark." AI never rewrites a student's work.
- Quick feedback: Claude Haiku 5.5. Long answers and homework: Claude Opus 5.5. Maths: no AI.
- Question banks are written in subscription working sessions; live AI is capped per child.

## Versions and releases

- Format `xx.xx.xxx`; started `00.01.000`; every push to `main` bumps the patch automatically.

## Hosting

- Domain `revisionden.com` is registered with Cloudflare (2026-11-24). Planned hosts: `revisionden.com` and
  `api.revisionden.com` (production), `staging.` and `api-staging.` (staging), `dev.` and `api-dev.` (development).
