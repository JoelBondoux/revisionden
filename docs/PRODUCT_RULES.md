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
  - XP per correct answer: flashcard 5, multiple choice 10, short answer 15, numeric 15, worked
    maths 20, extended answer 30. Part marks earn part of it (rounded). Wrong answers earn 0.
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

The full five-year progression (levels 1 to 100, year chapters, milestones, collections,
seasonal drops, rarity, parent-set rewards) is in [`REWARDS.md`](REWARDS.md), including the level
formula and its assumptions. Summary of what is built:

- Catalogue as data (`packages/core/src/catalogue/`): every reward has one stated target (a stat,
  a collection or a seasonal challenge), a rarity, a source and the items it gives. The original
  14 targets are kept with the same ids: streaks (7, 30, 100 days), grades (target hit in a mock,
  every target at an assessment), practice (full past paper, 10 weak spots fixed, 10 topics
  mastered, perfect set), friendship (gift 3 days, gift to 5 friends), competition (top of
  friends league for a week), and easy early wins (starting test, 25 right in a row).
- Streak milestones come with gift days: 7 days → 1, 30 → 2, 100 → 3, 365 → 5, 1,000 → 10.
- Rewards never come from time spent or late-night study (22:00 to 05:59 UK time), at most
  300 reward XP count a day, and there are no random draws.
- Avatar items only unlock from the reward that locks them; locked items are refused when saving.
- Implemented: `packages/core/src/rewards.ts`, `levels.ts`, `chapters.ts`, `reward-xp.ts`,
  `reward-stats.ts`, `rewards-schemas.ts`; API `apps/api/src/routes/rewards.ts`.

## Nickname and avatar

- Nickname: 2–16 letters (A–Z), numbers and underscores, not on the block list. Strong words are
  blocked anywhere (number swaps such as `sh1t` and underscores are seen through); short words
  that hide inside ordinary words (for example "ass" in "class") only when they stand alone.
  Names pretending to be staff (admin, teacher, moderator) are blocked.
- Avatar code: version `1` then two base-36 characters per layer, in this order: skin, eyes,
  mouth, facial hair, hair style, hair colour, top, top colour, eyewear, headwear, held item,
  background colour, pattern, scene. Locked items are rejected unless their reward is earned.
- Catalogue (approved builder): skin 10, eyes 10, mouth 10, facial hair 5, hair style 16, hair
  colour 14, top 12, top colour 12, eyewear 9, headwear 12, held item 13, background colour 12,
  pattern 8, scene 9. 15 locked items: Alien and Robot skin, neon green and hot pink hair, gold
  hoodie, captain shirt, night vision, laser visor, crown, dino hood, trophy, dino buddy, pixel
  sword, jungle and space scenes. 14 rewards unlock them: one item each, except the 100-day
  streak, which unlocks two (crown and Alien skin).
- Shuffle picks only items the student can wear. Avatars are drawn as SVG shapes, never photos.
- Implemented: `packages/core/src/nickname.ts`, `packages/core/src/avatar.ts`.

## Onboarding

- The parent adds each child: nickname, avatar, school year, subjects, and an exam board and tier
  per subject. Years 9 to 11 take GCSE, Years 12 and 13 take A-Level. Changing level clears the
  chosen subjects. Only Years 9 to 13 are accepted (the API and a database check both refuse 7
  and 8).
- Subjects: GCSE English Language, English Literature, Maths, Statistics, Combined Science,
  Biology, Chemistry, Physics, French, Spanish, German, History, Drama, Film Studies. A-Level
  Maths, Further Maths, Computer Science, Physics.
- Boards offered: GCSE Film Studies WJEC Eduqas only; GCSE French, Spanish, German AQA, Pearson
  Edexcel, WJEC Eduqas; A-Level Maths and Further Maths AQA, Pearson Edexcel, OCR; A-Level
  Computer Science AQA, OCR, WJEC Eduqas; everything else AQA, Pearson Edexcel, OCR, WJEC Eduqas.
  "Not sure" is always offered. A subject with one board has it picked already.
- Tiered GCSEs (Foundation, Higher or Not sure): Maths, Statistics, Combined Science, Biology,
  Chemistry, Physics, French, Spanish, German. Other subjects have no tier.
- Each board or tier left as "Not sure" counts as one thing to check later.
- Final exams are in the summer: Years 11 and 13 at the end of the current school year (which
  starts in September), Years 10 and 12 a year later, Year 9 two years later.
- A new child has earned no rewards, so their avatar cannot use locked items.
- The school report step (upload, same school as a sibling, skip) stores nothing yet: report
  reading arrives in Stage 5.
- Implemented: `packages/core/src/onboarding.ts`, `apps/api/src/routes/onboarding.ts`,
  `apps/web/src/features/onboarding/`.

### "Who's revising?" (`/family`, parents only)

Product owner decision, 2026-11-25: **parent view only**.

- After sign-in a parent lands on `/family`, which lists their children (a family with none goes
  to `/onboarding`).
- Tapping a child opens the parent's view of that child: the stats dashboard with that child
  chosen (`/parent/stats?student=<id>`). It never opens student screens.
- Each child also shows "Rewards you set" (`/family/:id/rewards`) and "Link a device"
  (`/onboarding?link=<id>`, straight to that child's QR code). The page links to family
  feedback (`/feedback/family`).
- Students always use their own device, linked by QR code and passkey. A student device behaves
  as before.

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
  Each button shows when the card would come back, worked out by the scheduler. Deck XP is per
  **session, not per card** (product owner, 2026-11-25), so rating every card "Good" earns
  nothing extra:
  - A session ends when the due queue is empty or after 20 cards, whichever comes first. A
    completed session of at least 5 cards earns **20 XP**, whatever the ratings. Fewer than 5
    cards, or leaving early, earns nothing.
  - At most **2 rewarded sessions a day** (40 XP), so flashcards alone cannot reach the daily goal.
  - Cards answered "Again" coming back in the same session do not count twice.
  - Self-ratings only schedule the card (SM-2); they never change topic mastery or the predicted
    grade. The "flashcards reviewed" milestones count cards in completed sessions. Deck cards come from flashcard items in the
    student's enrolled subjects; students can add their own cards (front and back up to 300
    characters) to a topic. Like feedback, an own card holding an email address, a UK mobile
    number or a nickname from the family is refused ("Please leave out personal details…").
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

## Statistics dashboards (workstream K)

Two read-only dashboards built from data the app already holds. No new personal data is collected.
Mockups: screens 19 (student) and 20 (parent).

### Student: My stats (from the Progress tab)

- Period toggle: **Week** (Monday to Sunday, UK time), **Term** (weeks of the current term),
  **Year** (school year, September to August).
- Headline tiles: XP, questions answered (and how many correct), accuracy, current streak. Each
  tile has a short note comparing with the previous period.
- One bar chart of XP per day (Week), per week (Term) or per month (Year). The goal line is the
  daily goal (Week) or the weekly goal (Term); Year has no goal line. Tap or hover a bar for its
  value; every chart also has a table view for screen readers.
- Mastery by subject: the average of that subject's topic mastery scores (0 to 100), with the
  change over the period.
- Personal bests: longest streak, most correct answers in a row, best week of XP.
- Level progress bar (levels from `REWARDS.md`).
- Kind framing: the student view shows gains and "same", never red or "worse" wording. Drops are
  visible to the parent and in the student's topic list, not called out here.

### Parent: stats dashboard (parent portal)

- Student switcher; one child at a time. Parents see only their own children.
- Headline tiles for this week: active study time (with change on last week), plan sessions kept
  (done of planned), accuracy, streak.
- Study time for the last 8 weeks as one bar chart with the weekly plan as a dashed line.
- Subjects table: mastery (average of topics), predicted grade and target (with "on target" or
  how far below), change in mastery over the last 4 weeks.
- Weak spots: the three weakest topics, 4 weeks ago and now.
- Latest school report effort scores (for example CBI), shown on the school's own scale.
- Parent-set reward progress (from `REWARDS.md`).
- Healthy habits: sessions in quiet hours, days over the daily cap, rest days taken.
- AI marking spend this month against the per-child cap.
- Recent activity: the last 10 events (lessons, flashcards, papers, homework marked, plan edits).
  No free text written by the student is shown.
- **Save as PDF**: made in the browser, nicknames only, nothing stored on the server.

### Rules for the numbers

- **Active study time** counts time between answers in a session; a gap of more than 5 minutes
  ends the session and the gap is not counted. Time past the daily cap is not counted.
- **Accuracy** is correct answers ÷ marked answers in the period (part marks count as the
  fraction earned). Unmarked or "check with your teacher" answers are left out.
- **Plan kept** is sessions completed on their day (or the day they were moved to) ÷ planned
  sessions. Before the study plan exists it shows "No plan yet".
- Panels with no data (no school report, no parent reward, no plan) show a short "Not set up yet"
  line with a link to set it up, never zeros.
- All periods use the family time zone (default Europe/London). Time is injected in tests.
- The student can see, in Settings, exactly which stats their parent can see (Children's Code
  transparency).
- Charts follow one style: single violet series, one axis, a dashed reference line where there
  is a goal or plan, values in tooltips and a table view, and no animation with reduced motion.
- **Terms** (until real term dates are entered): autumn 1 September to 31 December, spring
  1 January to 31 March, summer 1 April to 31 August. The school year runs 1 September to
  31 August (August counts in the year just ended); the Year chart has 12 months.
- **Goal lines**: daily goal 50 XP (Week); weekly goal 250 XP, 5 days of the daily goal (Term).
- **Daily cap** (provisional, until the wellbeing work makes it a parent setting): 2 hours of
  active study a day.
- **Subject mastery** averages the topics the student has practised; the change replays topic
  mastery from the marked answers at the start of the period (student) or 4 weeks ago (parent),
  counting topics not practised then as 0. Weak spots are the three lowest practised topics.
- **Healthy habits** are for this week: sessions that start in the reminder quiet hours (night or
  school hours, as set by the parent), days past the daily cap, and finished days with no study.
- **Recent activity** groups back-to-back answers of one kind and subject (gaps up to 5 minutes)
  into lessons, tests, starting tests and flashcard practice. Flashcard reviews show only each
  card's latest review (that is all that is stored).
- The level bar and parent-set rewards come from the rewards progression (workstream R), read
  through R's read-only `rewardsProgress` (`apps/api/src/stats/reward-adapters.ts`), so the
  numbers match the Rewards page and reading them never uses up the student's "New!" rewards. Parent-set
  rewards are listed not-yet-given first, without the note to the student.
- Panels not built yet (study plan, school report effort, predicted and target grades) come from
  adapters in `apps/api/src/stats/adapters.ts` that return null and show "Not set up yet".
- Implemented: `packages/core/src/stats.ts` (pure functions) and `stats-schemas.ts` (shared
  schemas); API `GET /v1/student/stats?period=week|term|year` (student device),
  `GET /v1/students/:id/stats?period=…` and `GET /v1/students/:id/dashboard` (parent, own children
  only); web `apps/web/src/features/stats/**` (`/progress` My stats, `/parent/stats` dashboard,
  "What your parent can see" in Settings).

## About page, policies and feedback (workstream L)

### About

- Reached from Settings (student and parent) and from the footer of the sign-in page.
- Shows the app version (`VERSION`, for example `00.04.012`), environment (development, staging
  or live), build date and short commit id, all injected at build.
- **What's new**: the plain-English changelog. Each version lists the lines from its
  `### What's new` subsection in `CHANGELOG.md`, newest first; versions without one are hidden.
  The technical changelog stays on GitHub.
- Links to every policy in `docs/LEGAL.md`, the open-source licences used by the app (generated
  at build) and "Report a bug" / "Send an idea".

### Policies

- One page per policy at `/legal/<name>`: the plain-English summary first, then the full text
  behind a "Read the full text" heading on the same page (not hidden), then the change history.
- Reachable without signing in. Printable. No tracking.

### Feedback and bug reports

- Kinds: **bug**, **idea**, **something confusing**, **other**. (Mistakes in a question keep
  using "Report a problem" on the item, which quarantines it.)
- Optional text up to 500 characters. Before saving, the same checks as the AI privacy filter
  run: email addresses, phone numbers and the student's nickname are refused with a friendly
  "please leave out personal details" message.
- Optional "include device details": off by default for students, on by default for parents
  (Children's Code high-privacy default; lead decision 2026-11-24), either can change it: app version, screen,
  route, browser family, screen size and online/offline. Never IP address, location or contacts.
- Students can send feedback; the form tells them their parent can see it. Parents see their
  family's feedback and its status in the parent portal.
- Stored in a `feedback` table (family id, sender role, kind, text, device details, status). The
  operator sees and triages it at `/admin/feedback` (operator role from configuration, not from
  an email in code). Status: new, looking into it, fixed, will not fix; the sender sees status
  changes.
- Never sent automatically to GitHub (the repository is public). The operator may copy a report
  into an issue by hand, without any text that could identify the family.
- Rate limit 5 in any 24 hours per sender (each student, each parent sign-in). Deleted 12 months
  after it is closed (fixed or will not fix), by the 15-minute cron. The operator is any parent
  whose sign-in email is in `OPERATOR_EMAILS`; anyone else gets a 404 from `/v1/admin/feedback`.
- Until real parent and student sign-in is wired in the web app, the form sends as the student when
  the device has a chosen student, otherwise as the parent.
- Implemented: `apps/api/src/feedback/`, `apps/web/src/features/{legal,about,feedback}/`; tables
  `feedback` and `policy_acceptances` (migration 0005).

## Family data: export, clean-up and inactive accounts (workstream B2)

- **Export:** "Download your family's data" in the parent area (the family list in onboarding)
  downloads `GET /v1/export`: one JSON file with the parent's sign-in email, provider account id,
  policy confirmations, the family, and for each of that parent's own children the profile and
  every record (courses, devices, answers, mastery, exams, reports, plans, rewards, streak, daily
  XP, starting tests, flashcards, reminders, AI usage, parent-set rewards), plus the family's
  feedback and question reports. Secrets are left out (session and link-code hashes, passkey keys
  and credential ids, push keys). Never another family's data.
- **Activity:** any parent or student request marks the family as used (`families.last_active_at`,
  written at most once an hour).
- **Inactive accounts:** a family nobody has used for more than 12 calendar months is deleted by
  the 15-minute clean-up, with its students and all their records and the parents' sign-in
  records. A sign-in that never became a family is deleted 12 months after it was made.
- **Warning:** the parent area always says the date the account will be deleted if nobody uses it.
  If the family comes back after 11 months or more without use, the parent area shows a warning
  with the date it would have been deleted (for that visit: until the next hourly activity
  write). No emails are sent.
- **Clean-up** (every 15 minutes): expired device link codes, student sessions, parent sessions,
  passkey challenges and sign-in checks are deleted.
- **Sign-in tokens:** the Google or Microsoft access, refresh and ID tokens are never kept.
- Implemented: `apps/api/src/cleanup.ts`, `apps/api/src/routes/{family,export}.ts`,
  `apps/api/src/auth.ts`, `apps/web/src/features/family-data/`; migration 0006.

## Sound effects (workstream U)

- Short, original sounds made in the browser with the Web Audio API (no audio files, no
  third-party sounds). Playful but not childish: soft, musical, under half a second for taps.
- Events: tap (subtle), correct, wrong (gentle, never a buzzer), part marks, submit, results
  reveal, streak day met, level up, reward unlocked, gift sent or received, card flip, flashcard
  rating, plan session dropped, celebration, timer warning (one at 1 minute left).
- **Mute**: a quick mute button in the app header and a Sound section in Settings with on/off,
  volume, and a separate "tap sounds" switch (off by default). Saved per device. Sounds default to
  on at a medium volume except tap sounds.
- On iPhone and iPad, sounds follow the silent switch where the browser allows it
  (`navigator.audioSession.type = "ambient"`). No sound plays before the first tap (browser rule)
  or while the app is in the background.
- **Test mode**: no correct or wrong sound before the student submits; the reveal plays once for
  the whole set. Timed papers play only the timer warning.
- **Reward sounds grow with the reward** (product owner, 2026-11-25). Bigger rewards sound
  bigger, and there is enough variety to stay fresh over five years:
  - Four tiers follow the reward's rarity (`REWARDS.md`): **common** (a bright chime, about
    0.5 s), **rare** (a two-part motif, about 1 s), **epic** (a rising run with shimmer, about
    1.5 s) and **legendary** (a short fanfare with harmony and a low hit, at most 3 s).
  - Each tier has at least **4 variations**; the same one never plays twice in a row (randomness
    injected, so tests are repeatable).
  - **Ladders climb:** each step of a milestone ladder (for example streak 7, 30, 60, 100 … 1,000
    days) plays its tier's sound a step higher and a little fuller than the step before, so the
    100-day streak sounds bigger than the 30-day one.
  - **Levels:** the level-up sound rises gently every 10 levels; every 10th level plays the rare
    sound; prestige stars play legendary.
  - **Year chapters** each have their own sound colour (a different synth voice), so Year 11
    rewards sound different from Year 9; the GCSE and A-Level finisher sets get unique fanfares.
  - Several rewards at once play only the biggest one, once (never a pile-up), after the lesson's
    own result sound.
  - Legendary sounds can be skipped with a tap; all reward sounds follow mute and volume, and never
    play in Test mode before submit.
- Sound is never the only signal: every sound has a matching visual. Reduced motion does not mute
  sound; the two settings are separate.
- Volume levels (master gain): low 0.12, medium 0.25, high 0.45. Settings key on the device:
  `revisionden.sound`; if the browser cannot save, the choice still applies until the app closes.
  The Settings section has a "Play a sample" button and Common, Rare, Epic and Legend reward
  samples (each tap plays another variation). The starting test timer turns orange at
  1 minute left, alongside the warning sound.
- Implemented: `apps/web/src/features/sound/**` (`SoundProvider`, `useSound().play(event, { mode })`,
  `MuteButton`, `SoundSettingsCard`, the synthesised sound bank in `bank.ts`, the Test mode rule in
  `events.ts`), with one-line `play()` calls in lessons, the starting test and flashcards. Reward
  sounds (U4): `rewardSounds.ts` (which sound: tier, step, voice, fanfare, biggest, variation),
  `rewardBank.ts` (synthesis) and `<RewardSound rewards={newlyEarned} />` on the Rewards screen.
  Prestige stars play legendary even where the catalogue rarity is epic. Gifts, plan and timed
  papers get their calls when those screens are built.

## App updates (installable app)

So nobody runs an old copy of the app for long after a deploy (decided 2026-11-25):

- Opening or reloading the app always fetches the newest page from the server; the offline copy
  is only used when there is no connection, and is replaced by the newest page each visit.
- Every build publishes its id at `/version.json` (version and commit). The app checks it when it
  starts, when it comes back to the foreground and every 15 minutes. When a newer build is
  deployed it shows "A new version of RevisionDen is ready." with a Refresh button.
- If an API reply suggests the app is out of date (an unknown route, or a reply in an unexpected
  shape) the app checks at once and, when a newer build exists, reloads by itself, once per new
  build, so it can never get stuck or loop. Without browser storage it only shows the banner.
- Implemented: `apps/web/public/sw.js`, `apps/web/src/pwa/updates.tsx`, `apps/web/vite.config.ts`.
