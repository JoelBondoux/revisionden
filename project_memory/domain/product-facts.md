# Product facts

Tags: #product #rules #limits #defaults

> Maintained page. Short, verified facts about what RevisionDen does. Update it in the same change
> as any code or rule change that alters a fact. Detail: `docs/PRODUCT_RULES.md`.

## Users and accounts

- One parent account per family; signs in with Google or Microsoft. Apple sign-in deferred (needs
  a paid Apple developer membership).
- Each sign-in provider is optional, but at least one must be set up; the welcome page shows only
  the configured ones (`GET /v1/auth/providers`). The owner is starting with Google only.
- Students have no outside account: nickname (2–16 letters, numbers, underscore), avatar code and
  year group only. Devices linked by a one-time QR token (10 minutes, single use), then a passkey.
- Nicknames are unique within a family. A family is created the first time a parent signs in.
- Year group: Years 9 to 13 only (core schema and database check `students_year_group_range`,
  migration 0006).
- Google and Microsoft access, refresh and ID tokens are never stored: blanked in Better Auth's
  account hook (`apps/api/src/auth.ts`). Only the provider account id is kept.
- Export: a parent downloads all their and their own children's data as JSON (`GET /v1/export`,
  "Download your family's data" on the onboarding family list); secrets left out.
- Inactive accounts: a family unused (no parent or student request) for over 12 calendar months
  is deleted automatically with everything in it, including the parents' sign-in records. Use is
  recorded at most hourly in `families.last_active_at`. A parent returning after 11 months or
  more sees a warning (`GET /v1/family/activity`); no emails.
- The 15-minute cron also deletes expired link codes, student and parent sessions, passkey
  challenges and sign-in checks (`apps/api/src/cleanup.ts`).
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
- GCSE Film Studies is offered only by WJEC Eduqas. GCSE Statistics only by AQA and Pearson Edexcel. Boards per subject and tiered GCSEs are listed
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
  50 XP), max 2 in a row. Gift days: come with streak milestones (1, 2, 3, 5, 10 for 7, 30, 100,
  365, 1,000 days), added once when the reward is saved (`GET /v1/student/rewards`), only
  given away (arrive as a skip day for the friend), +20 XP for gifting. Implemented in
  `packages/core/src/streaks.ts` and `xp.ts`.
- XP per correct answer: flashcard 5, multiple choice 10, short answer or numeric 15, working 20,
  long answer 30; part marks earn part.
- The 14 original rewards keep their ids and avatar items (the 100-day streak unlocks two: crown
  and Alien skin). They are now part of the five-year catalogue (see "Rewards progression").
- XP per correct answer: flashcard 5, multiple choice 10, short answer or numeric 15, worked maths
  20, extended answer 30; part marks earn part.
- 14 rewards unlock the 15 locked avatar items: one each, except the 100-day streak, which unlocks
  two (crown and Alien skin). `packages/core/src/rewards.ts`, `avatar.ts`.
- 14 rewards, each unlocking one avatar item: `packages/core/src/rewards.ts`.
- Only `verified` items reach students. Drafts are served only with `SERVE_DRAFT_CONTENT=true` in
  development (never staging or production), with a "DRAFT CONTENT" banner; quarantined and
  retired items never. Implemented in `packages/core/src/learning.ts` and `apps/api`.
- Starting test per subject: about 5 minutes (300 s, up to 10 questions, one per topic first),
  Test mode; its answers set first mastery. Lessons are Learn mode at feedback level 1.
- Wrong lesson answers become flashcards. Flashcard buttons Again/Hard/Good/Easy = SM-2 quality
  1/3/4/5; each shows when the card comes back. Deck XP is per completed session, not per card: 20 XP for a
  session of 5+ cards (ends when the due queue is empty or at 20 cards), whatever the ratings; at
  most 2 rewarded sessions a day; self-ratings never change mastery (owner, 2026-11-25). Students can add their own cards (up to 300 characters a side); a card with an email, a UK mobile number or a family nickname is refused, as for feedback.
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
  rail from 768px wide). Welcome and lessons hide the nav to keep focus. Only a linked student
  device gets the student nav: elsewhere (signed out, or a parent) About, Policies, Feedback and
  the other app pages show a small header with the logo, Sign in, Policies and About.
- The web app loads nothing from third parties (no analytics, fonts or beacons): only its own
  origin and its API host. The deployed smoke test fails otherwise.
- The learning path is a topic map: one hexagon per topic, grouped by unit. States: mastered
  (gold, tick), in progress (violet, fill level shows mastery %), weak spot (orange, pulsing
  glow), locked (grey). Each unit ends in a challenge that unlocks at 80% unit mastery. A Next
  mission card suggests what to do next. The Cards tab shows how many flashcards are due.
- Mascot: Pip, an angular geometric fox (orange `#FF7A2F`). Brand violet `#6C47F5`; font Nunito,
  self-hosted (no Google Fonts request). Every text colour pair meets 4.5:1 contrast.
- Works offline for the app shell; API calls are never cached. Pages always come fresh from the
  server when online. The app checks `/version.json` on start, on return to the foreground and
  every 15 minutes and shows "A new version of RevisionDen is ready." with Refresh; an API reply
  that suggests the app is out of date makes it reload by itself once per new build. iPad users get an "Add to Home
  Screen" help page (`/install`), because iPadOS has no install prompt.
- The web app calls the real API on dev and staging (parent session cookie, or the student
  device cookie). MSW mocks with made-up data are used only in local development and tests, and
  must use real API paths (`apps/api/routes.json`). Parents sign in from the welcome page
  (Better Auth) and land on "Who's revising?" (`/family`, `GET /v1/onboarding/family`), or on
  `/onboarding` if they have no children yet. Tapping a child there opens the parent's view
  (the parent home `/parent?student=<id>` with that child chosen), never student screens; each child has "Rewards you set" and
  "Link a device" (product owner, 2026-11-25). Students use only their own linked device. Signed out, any screen shows the sign-in buttons
  and returns to the same page after sign-in. Sign out is on the welcome page and `/family`. The topic map and Cards badge wait for F2's
  `GET /v1/student/map` and `GET /v1/student/cards/due`.
- Every "Something went wrong" shows a reference code like `RD-7K2M9Q` (no I, L, O or U), also
  in the API logs with no personal data, so a family can report it. Implemented in
  `packages/core/src/error-ref.ts`, `apps/api/src/errors.ts`, `apps/web/src/api/client.ts`.
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
- Parent devices (H2): the parent turns on "Reward news" on the parent home (`/parent`), saved
  in `parent_push_subscriptions`. One push per parent-set reward when its target is met and it is
  not given (`parent_rewards.reached_notified_at`). It does not count towards the child's 2 a
  day; it respects the child's nightly quiet hours and time zone but not the school-hours window
  or the child's reminder switch. Text "<nickname> reached a reward target: <title>" from
  `GET /v1/parent/notifications/latest` (last 24 hours). The service worker knows a device is a
  parent device from the `/push-audience` entry it is given when push is turned on. Code:
  `apps/api/src/notifications/parent-rewards.ts`.

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

- Domain `revisionden.com` is registered with Cloudflare (2026-11-24). Hosts: `revisionden.com` and
  `api.revisionden.com` (production), `staging.` and `api-staging.` (staging), `dev.` and `api-dev.` (development).
- Live since 2026-11-25 (workstream G): API Workers on all three API hosts; web app on `dev.` and
  `staging.`. The production web app waits for the operator details (its build fails without them).
- Workers: `revisionden-api-dev`, `revisionden-api-staging`, `revisionden-api` (API) and
  `revisionden-web-dev`, `revisionden-web-staging`, `revisionden-web` (web, static assets only).
- Database: Neon project `revisionden` in London (`aws-eu-west-2`), Postgres 17, database
  `revisionden`; branch `main` is production, `staging` and `dev` branch off it.
- Uploads: R2 buckets `revisionden-uploads-<dev|staging|production>` in the EU jurisdiction, each
  with a rule deleting objects (and unfinished uploads) after 24 hours.
- AI Gateway `revisionden`: authenticated (Cloudflare requires it for new gateways, so the API
  needs `AI_GATEWAY_TOKEN`), logging on but the API sends `cf-aig-collect-log-payload: false` so
  prompts and answers are never stored, cache off, 120 requests a minute.
- Deploys: GitHub Actions. Push to `dev` deploys dev, push to `staging` deploys staging, and
  production deploys after the release bump on `main`. Each deploy migrates the database first,
  then the API, then the web app, then checks `/health` shows the new version.
- `GET /health` always answers with the version: `ok` (200) when configured, `misconfigured`
  (503) while a required secret is missing. Dev and staging deploys accept `misconfigured`;
  production does not.
- The app shows its version in a small footer on every page (links to About).

## Verification (no mistakes on the education side)

- Every item, topic leaf, mark scheme and diagram has at least one citation (official where one
  exists), stored with the content and not shown in the app. Full protocol: `docs/VERIFICATION.md`.
- Release needs: quote found in source, blind answer by a second provider, adversarial review,
  exact checks, schema validation, and human approval (or a zero-defect 10% batch sample).
- No AI-generated images for teaching; diagrams are code-drawn from verified data.
- Reports quarantine an item immediately; `pnpm content:audit` reports the evidence for any item.
- Essay and homework marking: two independent AI markings citing mark-scheme criteria; a gap of
  more than one level (one mark for mark-point schemes), uncertainty or a marking that does not
  cite the scheme is shown as "check with your teacher", never guessed. When they agree, the
  lower of the two marks is given. Implemented in `packages/core/src/double-marking.ts`.
- Quote check: sources are fetched only from official hosts (Pearson, AQA, OCR, Eduqas, WJEC,
  gov.uk) and cached outside git with their SHA-256. "page N" may be the PDF page or the printed
  page; a specification code must be the nearest code before the quote. Unconfirmable = fail.
  Only an exact match (after normalising) passes; a near match (letters only, or words with
  small insertions or reordering, with a confidence) is flagged for a reviewer to confirm.
  Pilot (2026-11-24): 110 of 110 citations found, 108 exact and 2 near.
- Item type names are the same everywhere (content, database, API, app): multiple_choice,
  short_answer, numeric, worked_maths, flashcard, extended_answer. Item JSON in the `items`
  table: `body` is what the student sees (prompt, marks, options, unit, hint, front, back);
  `answer` is server-only (`key` = the content answer, `verify`, `explanation`, `steps`,
  `markScheme`). Defined in `apps/api/src/learning/content-sync.ts`.
- Extended answers: blind marking replaces the blind answer (three exemplars, top, middle and low,
  marked by a second provider without the intended levels; all three must match exactly), and
  every one needs individual human approval; review batches always include them.
- Blind answer must come from a different provider from the writer (Claude by default) and be
  highly confident; any adversarial-review problem fails the item. Real models never run in
  tests or CI.
- Exact checks: units, chemical equation balancing and equation-sheet lookups, for facts named
  in an item's `exact` block; equation sheets live in `content/equation-sheets/`.
- Review queue at `/review` for parent accounts given a reviewer role (subject-specialist,
  content-lead, parent-reviewer) in `reviewer_roles`; decisions store the role only. Batch
  samples: 10% of the batch, at least 30, plus every item needing approval; seed recorded; one
  confirmed error fails the batch and re-checks the batch, writer prompt and source.
- Report a problem stores only item, version and a reason (no free text) and hides the item at
  once (status `quarantined` in `items`, kept through content syncs; restored on "no error";
  lifted after a confirmed error only when a newer version is synced). A confirmed error queues a score recalculation job and re-checks the item. The
  parent-portal PDF export of the audit report is not built yet.

## Study plan

- Sessions drag between days and open an editable detail panel. Edits can become per-student rules
  ("Always do Maths on Wednesdays") that the planner applies every week; rules can be toggled or
  removed; conflicts are reported, not silently broken. Detail: `docs/PRODUCT_RULES.md`.

## Build environments

- Content and verification sessions run in the `revisionden` cloud environment, which can reach
  the exam board sites (Pearson, AQA, OCR, WJEC/Eduqas) and gov.uk. Other sessions use the default
  environment, which cannot.
- The `revisionden` environment can also reach the three Neon database hosts and the six
  revisionden.com hosts (added for workstream G, to run migrations and check the live sites).

## Rewards progression

- Rewards span five years (Year 9 to Year 13): levels 1–100 plus prestige, a themed track per school
  year, long milestones (streaks up to 1,000 days, questions up to 25,000, Subject master), item
  collections, and new seasonal items each term; about 650 unlocks in total. Rewards follow learning,
  never screen time; no loot boxes; everything carries over to A-Level; parents can add real-world
  rewards. Detail: `docs/REWARDS.md`.
- Built (workstream R): 369 catalogue rewards as data in `packages/core/src/catalogue/` (99 level,
  5 prestige, 150 chapter, 55 milestone, 12 collection bonuses, 48 seasonal for 2026/27). Rarity
  shares 52.6 / 30.6 / 14.6 / 2.7% (common / rare / epic / legendary), checked within 6 points.
- Level curve: XP from level L to L + 1 is min(750, 300 + 50 × (L − 1)); level 20 at 12,000 XP,
  level 100 at 72,000 XP; a prestige star every 7,500 XP after that, up to 5. Assumes 60 XP a
  practice day and 250 practice days a school year (`packages/core/src/levels.ts`).
- Reward XP: only answer XP counts; nothing from 22:00 to 05:59 UK time; at most 300 XP a UK day
  (`packages/core/src/reward-xp.ts`). Flashcard deck reviews do not count yet (see contradictions).
- Year chapters: 30 steps each (a step every 400 chapter XP, 12,000 fills a chapter); spill-over
  into earlier unfinished chapters for mid-way joiners; Year 11 and 13 finales on the last exam;
  Year 12+ count as GCSE finished (`packages/core/src/chapters.ts`).
- Seasonal drops: six back-to-back windows a school year, 8 items each, re-released the same
  window a year later; challenges count right answers or goal days inside the window.
- A topic counts as mastered at 80% for milestones (`packages/core/src/reward-stats.ts`).
- Parent-set rewards (`parent_rewards` table): title up to 60 characters, optional note up to 200,
  target = a catalogue reward, a stat reaching a number, or a UK date. Editable and deletable until
  the parent marks it given; then kept as history (409). Shown to the student with a "From home"
  badge and a celebration when the target is met. Routes in `apps/api/src/routes/rewards.ts`;
  screens `/rewards` (student, linked from Settings) and `/family/:id/rewards` (parent, linked from
  the parent home `/parent`).
- Newly earned rewards are saved (and announced as "New!") by `rewardsView`, used by the student's
  `GET /v1/student/rewards` and the parent's full `GET /v1/students/:id/rewards`. The parent's
  `GET /v1/students/:id/parent-rewards` and the stats pages use the read-only `rewardsProgress`.
- New avatar items: chapter finale tops (chapter hoodie, bomber jacket, GCSE finisher jacket,
  sixth-form coat, A-Level finisher jacket), rooftop scene, and the Frost Fest drop (bobble hat,
  paper lantern, frosty night scene). Always appended to a layer so saved avatar codes still work.

## Statistics dashboards

- Student "My stats" (from the Progress tab) and a parent stats dashboard, both read-only, built
  from data already held. Periods: week (Mon–Sun), term, school year; family time zone.
- Active study time: time between answers; a gap over 5 minutes ends the session and is not
  counted; time past the daily cap is not counted. Accuracy: correct ÷ marked answers (part marks
  as fractions; unmarked left out). Subject mastery: average of its topic mastery scores.
- Student view never uses red or "worse" wording; drops are shown to the parent. Empty panels say
  "Not set up yet", never zeros. PDF export is made in the browser with nicknames only.
- Terms until real dates are entered: autumn 1 Sep–31 Dec, spring 1 Jan–31 Mar, summer
  1 Apr–31 Aug; the school year is 1 Sep–31 Aug. Goal lines: 50 XP a day (Week), 250 XP a week
  (Term). Daily cap 2 hours (provisional, `DEFAULT_DAILY_CAP_MINUTES`, until wellbeing settings).
- Subject mastery averages practised topics; change is replayed from marked answers (period start
  for the student, 4 weeks for the parent). Healthy habits are for this week; quiet hours are the
  reminder quiet hours. A rest day is a finished day with no study at all: answers and flashcard
  reviews both count as study.
- Level bar and parent-set rewards come from the rewards progression (same numbers as the Rewards
  page), read with the read-only `rewardsProgress`: it counts earned-but-unseen rewards and saves
  nothing, so the stats pages and the parent's parent-rewards view never use up the student's
  "New!" rewards (only the student's own Rewards page saves and announces them). Plan, school report effort and predicted/target grade panels show "Not set up yet"
  (adapters in `apps/api/src/stats/adapters.ts`) until those features land.
- Routes: `/progress` (My stats), `/parent/stats` (parent); API `GET /v1/student/stats`,
  `GET /v1/students/:id/stats`, `GET /v1/students/:id/dashboard`. Implemented in
  `packages/core/src/stats.ts`, `apps/api/src/stats/`, `apps/web/src/features/stats/`.
  Detail: `docs/PRODUCT_RULES.md` (statistics dashboards). Workstream K.

## Parent-set rewards

- Title (60 characters), optional note (200), target from any catalogue target type or a custom
  date; "from home" badge for the student; celebration and parent notification when met (H2,
  once per reward, see Reminders); parent marks "given" (locked after that); no student free
  text. Workstream R5. Detail: `docs/REWARDS.md`.

## Parent home

- `/parent` (workstream P): student switcher, per-child "Rewards you set" and "Reminder times"
  (`/parent/reminders/:id`), stats dashboard, add or manage children, family feedback, download your family's data
  (`/onboarding`), Reward news, app settings and policies. Tapping a child on `/family` (where a parent lands after
  signing in) opens `/parent?student=<id>` with that child chosen; also linked from `/family`
  and Settings. No focus-suggestions page exists yet, so it has no card.

## Policies, About and feedback

- Policies live in `docs/legal/` (index `docs/LEGAL.md`): plain English first, then the full legal
  text, then changes. All eleven written as 1.0 drafts; drafts until reviewed by a UK solicitor.
  Shown at `/legal/<name>`, signed out, printable. Operator name, email and address are
  build-time placeholders, never in the repository.
- About page: version, environment, build date, commit, "What's new" (the `### What's new`
  lines in `CHANGELOG.md`), policy links, open-source licences, and "Need help? Email
  help@revisionden.com".
- Contacts: help and support `help@revisionden.com` (`VITE_SUPPORT_EMAIL`, that default when
  unset; on About, the feedback form, the accessibility statement and community rules); privacy,
  data rights and security `privacy@revisionden.com` (`VITE_CONTACT_EMAIL`). Both forward to the
  product owner (Cloudflare Email Routing).
- Feedback kinds: bug, idea, something confusing, other; text up to 500 characters with personal
  details refused; device details optional; parents see their family's feedback; never sent to
  GitHub automatically; 5 in any 24 hours per sender; device details off by default for students, on for parents; deleted 12 months after closing (cron).
  The form also offers "Prefer email? help@revisionden.com" and asks for only the personal details
  needed.
  Operator triage at `/admin/feedback` for sign-in emails in `OPERATOR_EMAILS`. Workstream L.
- Parents confirm the terms and privacy notice in onboarding (version stored in
  `policy_acceptances`); a changed version shows a "We've updated" prompt. A newly linked student
  device shows the young people's notice once (`revisionden.youngPeopleNotice` in local storage).
- The young people's notice has a friendly view built from the same file: 6 short-version cards,
  2 to 4 key points per part always visible, "Read more" and "Expand all", original icons and Pip;
  motion off under reduced motion. Format rules in `docs/LEGAL.md` (Friendly view).

## Sound

- Original Web Audio sounds, no files. Header quick mute and Settings (on/off, volume, tap sounds
  off by default), per device; follows the iOS silent switch where possible. No correct/wrong
  sounds in Test mode before submit. Sound is never the only signal. Workstream U.
- Reward sounds scale with rarity (common, rare, epic, legendary; 4+ variations each, no repeat
  in a row); milestone ladders and levels climb in pitch and fullness; one sound for several
  rewards at once; legendary at most 3 s and skippable (owner, 2026-11-25; U4).
- Reward sound details (U4, `apps/web/src/features/sound/rewardSounds.ts`, `rewardBank.ts`): tier
  = the reward's rarity, except prestige stars always play legendary (prestige 1 to 3 are epic in
  the catalogue). Ladder step = position in its milestone ladder; level step = level ÷ 10. Each
  step is 1.5 semitones higher (8 steps = an octave) and adds one harmony note (up to 4). Voice per
  chapter id (`chapter-<n>-…`); finisher fanfares for the chapter rewards that need
  `gcseFinished` or `aLevelFinished`. Biggest = tier, then finisher, then step. Played on the
  Rewards screen for `newlyEarned`; a tap or key press skips legendary.
- Defaults: on, medium volume, tap sounds off; saved in `localStorage` key `revisionden.sound`
  (storage errors are ignored). One AudioContext, made at the first tap or key press; paused when
  the app is hidden. Test mode: submit and one reveal for the set; timed papers: only the timer
  warning (once, at 1 minute left). Implemented in `apps/web/src/features/sound/`.
- Wired so far: lessons (correct, wrong, part marks, daily goal met, lesson complete), starting
  test (submit, reveal, timer warning), flashcards (flip, rating) and the Rewards screen (new
  rewards, U4). Gifts and plan sounds exist in the bank but wait for their screens.

## Owner decisions (2026-11-25)

- Hosting reuses the existing Cloudflare token and Neon key; only `revisionden`-named resources
  may be created or changed. New Neon project `revisionden` in London.
- AI marking text may be processed in the US (accepted for now); stored data stays in the UK or EU.
- The app is run by a sole trader; name and contact details come from build variables only.
  Policy contact: `privacy@revisionden.com`; no postal address shown.
  Decision 0003.

## Game feel

- Approved 2026-11-25 (mockup 22): practice screens use a dark "arena" style with particle bursts,
  combos, rising chimes, a set-complete celebration and a pulsing Next mission button; calm screens
  stay light. Combo bonus: +5 XP per right answer from the 3rd in a row (Learn mode; Test mode at the
  reveal). Never lives, timers, pay-to-continue, mystery rewards or streak guilt; after the daily cap
  the call to action becomes "See you tomorrow". Detail: `docs/GAME_FEEL.md`. Workstream J.

## Exam practice (planned)

- Timed papers sat in real time (exam conditions or practice), each question timed, all marked at
  the end. Pacing target per question = its marks × (official duration ÷ total marks); flags at
  1.5× slow and 0.5× rushed with marks lost. Board-style papers from our own verified items first;
  official past papers only as links to the board's site (never copied). Detail:
  `docs/EXAM_PRACTICE.md`. Workstream X (queued).

## Bug Hunter and secret achievements (planned)

- Bug icon on every screen opens the bug report sheet. A student's bug confirmed by the operator:
  +50 XP and a step on the hidden Bug Hunter track (badge, title, avatar item, frame, Pip outfit,
  effect, legendary set at 20). Duplicates +10 XP; at most 3 confirmed-bug rewards a week; parents
  are thanked, not rewarded.
- Built (L7): the bug button and confirm flow; rules in `packages/core/src/bug-hunter.ts`
  (`bugReward`). The week is Monday to Sunday, UK time, and the 3-a-week cap counts full and
  duplicate rewards; past the cap the student is thanked with no XP and no track step. Bug XP is
  added to total XP but not to the daily goal or streak. Students switch the button off in Settings
  (`revisionden.bugButton` in local storage). Confirmed count: `confirmedBugCount` in
  `apps/api/src/feedback/bugHunter.ts`, `GET /v1/student/bug-hunter`,
  `GET /v1/students/:id/bug-hunter`. The track items are R's.
- Secret achievements: hidden "???" cards with a found count; learning-based conditions only;
  defined in the catalogue with `secret: true`. Detail: `docs/REWARDS.md`.
