# Product facts

Tags: #product #rules #limits #defaults

> Maintained page. Short, verified facts about what RevisionDen does. Update it in the same change
> as any code or rule change that alters a fact. Detail: `docs/PRODUCT_RULES.md`.

## Users and accounts

- One parent account per family; signs in with Google or Microsoft. Apple sign-in deferred (needs
  a paid Apple developer membership).
- Students have no outside account: nickname (2–16 letters, numbers, underscore), avatar code and
  year group only. Devices linked by a one-time QR token (10 minutes, single use), then a passkey.
- Nicknames are unique within a family. A family is created the first time a parent signs in.
- The link token is redeemed with the family id from the QR code; a wrong family id does not use
  the token up. Tokens and sessions are stored only as hashes.
- A student device session lasts 12 hours, then the student unlocks again with the passkey.
  Parents can unlink a device, which ends its session.
- Rate limits per address: 30 a minute on sign-in and device routes, 20 a minute on AI routes.
  Implemented in `apps/api`.

## Subjects

- GCSE: English Language, English Literature, Maths, Statistics, Combined Science, Biology,
  Chemistry, Physics, French, Spanish, German, History, Drama, Film Studies. A-Level: Maths,
  Further Maths, Computer Science, Physics. Implemented in `packages/core/src/onboarding.ts`.
- Exam boards and tiers are picked in the app; "not sure" is allowed and reminded later.
- GCSE Film Studies is offered only by WJEC Eduqas. Boards per subject and tiered GCSEs are listed
  in `docs/PRODUCT_RULES.md` "Onboarding".
- Onboarding takes Years 9 to 13 (9–11 GCSE, 12–13 A-Level). Exams are worked out from the year:
  Year 11 and 13 sit them next summer (2027 in school year 2026/27), Year 10 and 12 a year later,
  Year 9 two years later.

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
- 14 rewards unlock the 15 locked avatar items: one each, except the 100-day streak, which unlocks
  two (crown and Alien skin). `packages/core/src/rewards.ts`, `avatar.ts`.
- 14 rewards, each unlocking one avatar item: `packages/core/src/rewards.ts`.
- Only `verified` items reach students. Drafts are served only with `SERVE_DRAFT_CONTENT=true` in
  development (never staging or production), with a "DRAFT CONTENT" banner; quarantined and
  retired items never. Implemented in `packages/core/src/learning.ts` and `apps/api`.
- Starting test per subject: about 5 minutes (300 s, up to 10 questions, one per topic first),
  Test mode; its answers set first mastery. Lessons are Learn mode at feedback level 1.
- Wrong lesson answers become flashcards. Flashcard buttons Again/Hard/Good/Easy = SM-2 quality
  1/3/4/5; each shows when the card comes back. Reviewing a deck card earns 2 XP (see
  contradictions). Students can add their own cards (up to 300 characters a side).
- XP is totalled per day in UK time; a streak day counts once, the first time the day reaches the
  daily goal. Command-word lessons are items tagged `command-word` (none verified yet).
- Worked maths answers are checked by the maths engine (`MATHS_ENGINE_URL`); long answers are not
  marked yet ("marked by AI soon").
- Effort scores (e.g. CBI: Commitment, Behaviour and Inspiration, 1–4, 4 best) shape habits, never
  the predicted grade.

## Web app

- Learning screens: `/learn/subject/:id` (topics, mastery, weak spots), `/learn/subject/:id/start`
  (starting test), `/learn/subject/:id/practice`, `/learn/topic/:id`, `/learn/command-words`,
  `/cards` (flashcards: Due today, All decks, My cards; 3D flip card, reduced motion respected).
- Installable PWA. Main nav tabs: Learn, Cards, Plan, Papers, Progress (bottom bar on phones, side
- Installable PWA. Main nav tabs: Map, Cards, Plan, Papers, Progress (bottom bar on phones, side
  rail from 768px wide). Welcome and lessons hide the nav to keep focus.
- The learning path is a topic map: one hexagon per topic, grouped by unit. States: mastered
  (gold, tick), in progress (violet, fill level shows mastery %), weak spot (orange, pulsing
  glow), locked (grey). Each unit ends in a challenge that unlocks at 80% unit mastery. A Next
  mission card suggests what to do next. The Cards tab shows how many flashcards are due.
- Mascot: Pip, an angular geometric fox (orange `#FF7A2F`). Brand violet `#6C47F5`; font Nunito,
  self-hosted (no Google Fonts request). Every text colour pair meets 4.5:1 contrast.
- Works offline for the app shell; API calls are never cached. iPad users get an "Add to Home
  Screen" help page (`/install`), because iPadOS has no install prompt.
- Until the real API and sign-in land, the web app runs on an MSW mock API with made-up data.
- Parent onboarding is at `/onboarding` (family list, add a child, school report, link a device,
  finish); the student scans the QR code to `/link` and sets up a passkey.
- Avatars are drawn as layered SVG from the avatar code (`apps/web/src/features/avatar`).

## Content

- Content is JSON in `content/`, checked by `pnpm content:validate` (schemas in
  `content/schemas/`). Every item has `source_ref` and `checked_by`; every topic-tree leaf has a
  specification reference; trees are at most 3 levels deep. Detail: `docs/CONTENT_PLAN.md`.
- Every maths answer (numeric and worked maths items, and model solutions) is verified by the
  maths engine before content can merge.
- Every item, topic leaf, mark scheme and diagram carries official citations and a verification
  record (`docs/VERIFICATION.md`); verified content needs quotes and every pipeline check, and is
  immutable (edits create a new version). `pnpm content:validate --audit <id>` prints the audit trail.
- Diagrams are SVG drawn by code from verified data; no AI-generated or raster teaching images.
- Pilot: GCSE Maths Higher, Pearson Edexcel 1MA1 (content references N1 to S6). Every pilot
  citation has a verbatim quote from the 1MA1 specification Issue 2 (or, for the quadratic
  formula, the DfE subject content DFE-00233-2013), with page and SHA-256. All pilot content is
  still `draft`: blind answer, adversarial review and human approval are still to do.
- Citation `supports` names only what the quote itself backs. A specification quote backs the
  question being in scope (`question`, `topic`); maths answers are backed by the maths engine,
  not by a citation. Sourcing record: `docs/sourcing/gcse-maths-1ma1-pilot.md`.

## Maths engine

- `services/maths`: SymPy, no AI. `POST /check-working` returns the 0-based index of the first
  line of working that does not follow from the previous line, and whether the final answer is
  correct. Input is limited to safe maths (single letters, a few functions, 200 characters).

## Reminders

- Web push per device, turned on by the student from Settings (the permission prompt appears
  only after a tap). iPhone and iPad need the app on the Home Screen first.
- Two kinds: a planned-session reminder (from 16:30 on a day with a planned session) and a
  streak reminder (from 19:00 when the streak is 1+ days). Neither is sent once the student has
  practised that day; each kind at most once a day; at most 2 reminders a day (fixed).
- Quiet hours by default: 21:00–07:30 every night and 08:30–15:30 on weekdays (school hours).
  The parent can change all these times, the time zone (default Europe/London) and switch each
  kind or all reminders off. Implemented in `apps/api/src/notifications/schedule.ts`.
- Pushes carry no text; the service worker fetches it from the API (generic text if locked).
  The cron runs every 15 minutes and does nothing until the VAPID keys are set.

## AI

- Every AI-marked result says: "Marked by AI. This is a guide to help you improve, not your
  teacher's mark." AI never rewrites a student's work.
- Quick feedback: Claude Haiku 5.5. Long answers and homework: Claude Opus 5.5. Maths: no AI.
- Question banks are written in subscription working sessions; live AI is capped per child.
- AI spend cap: US$2.50 per child per calendar month (UTC) by default (`AI_MONTHLY_CAP_USD`),
  checked before every call; every billed attempt counts. Up to 3 attempts per call.
- Short answers: rules first (accepted answers and official mark-point wording, not when the
  answer contains a negation), then Claude Haiku 5.5 only for the remaining mark points, citing
  each point and quoting the student's words. Unsure → "Check with your teacher", never a guess.
- Requests with the student's nickname, ids, avatar code, year group, an email or a phone number
  are refused before sending. Gateway logs keep no prompt or answer.
- Implemented in `apps/api/src/ai/`.

## Versions and releases

- Format `xx.xx.xxx`; started `00.01.000`; every push to `main` bumps the patch automatically.

## Hosting

- Domain `revisionden.com` is registered with Cloudflare (2026-11-24). Planned hosts: `revisionden.com` and
  `api.revisionden.com` (production), `staging.` and `api-staging.` (staging), `dev.` and `api-dev.` (development).

## Verification (no mistakes on the education side)

- Every item, topic leaf, mark scheme and diagram has at least one citation (official where one
  exists), stored with the content and not shown in the app. Full protocol: `docs/VERIFICATION.md`.
- Release needs: quote found in source, blind answer by a second provider, adversarial review,
  exact checks, schema validation, and human approval (or a zero-defect 10% batch sample).
- No AI-generated images for teaching; diagrams are code-drawn from verified data.
- Reports quarantine an item immediately; `pnpm content:audit` reports the evidence for any item.
- Essay and homework marking: two independent AI markings citing mark-scheme criteria; a gap of
  more than one level, or uncertainty, is shown as "check with your teacher", never guessed.

## Study plan

- Sessions drag between days and open an editable detail panel. Edits can become per-student rules
  ("Always do Maths on Wednesdays") that the planner applies every week; rules can be toggled or
  removed; conflicts are reported, not silently broken. Detail: `docs/PRODUCT_RULES.md`.

## Build environments

- Content and verification sessions run in the `revisionden` cloud environment, which can reach
  the exam board sites (Pearson, AQA, OCR, WJEC/Eduqas) and gov.uk. Other sessions use the default
  environment, which cannot.
