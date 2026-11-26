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
  - Combo bonus (`docs/GAME_FEEL.md`): +5 XP per right answer from the 3rd right answer in a row,
    added to that answer's XP (so levels and rewards count it, with the usual daily cap). Learn
    mode: the API counts the run from the student's own recent answers; a wrong or part-marked
    answer, a Test mode answer or a gap of more than 5 minutes ends it. Test mode (the starting
    test): no combo while answering; at the reveal (`finish`) the same bonus is added to the answers
    in order, once.
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
- Not built yet: it needs verified grade boundaries (docs/VERIFICATION.md), and mocks and school
  reports are not entered yet. Until then the stats dashboards show "Not set up yet" for it.

## AI marking

- Every AI-marked result carries the label: "Marked by AI. This is a guide to help you improve,
  not your teacher's mark."
- AI never rewrites a student's work; it points out what to improve.
- Students confirm the transcription of photographed work before marking.
- Each child has a monthly AI marking allowance (the cost cap, set by the operator). Families see
  it only as an allowance, never as money: a percentage used and the date it resets (Statistics
  dashboards). When it is used up the student sees "You've used this month's AI marking
  allowance. It resets on 1 <month>. Questions marked by the app still work."

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
- Effect styles (J10b, owner decision 2026-11-26): the ladder is Sticker Book at level 3, Pop
  Burst at level 5, Garden Grow at 5 topics mastered in a subject, Starlight at 10 topics
  mastered, Comic Pop at level 20 and Pixel Arcade at level 40, each on an existing reward (table
  in `REWARDS.md`). Styles are never bought, never random and never tied to a streak. Doodle Diary
  is the free default (J10d). The child chooses in Settings
  → Effect style.
- Rewards are celebrated where they are earned (workstream F4, product owner via lead,
  2026-11-25): an answer or a finished flashcard session saves any new reward once and shows
  "New reward: …" with the reward sound on that screen (the starting test waits for its results
  screen). Those rewards are not shown again as "New!" on the Rewards page; the Rewards page
  announces only rewards first seen there (for example the starting-test milestone).
- Implemented: `packages/core/src/rewards.ts`, `levels.ts`, `chapters.ts`, `reward-xp.ts`,
  `reward-stats.ts`, `rewards-schemas.ts`; API `apps/api/src/routes/rewards.ts`.
- Parent-set reward met (workstream H2): the parent gets one notification per reward on each of
  their devices with "Reward news" on, while it is not marked given. Not counted in the child's
  2 reminders a day; waits for the end of the child's nightly quiet hours (not school hours).
  Text: "<nickname> reached a reward target: <title>" (fetched by the service worker, never in
  the push itself).

## Parent home (workstream P)

- `/parent` is the parent's way in: a student switcher (when there is more than one child) with
  that child's "Rewards you set" and "Reminder times" (`/parent/reminders/:id`), and cards for the
  stats dashboard, add or manage children, family feedback, download your family's data (the
  B2 panel on `/onboarding`), Reward news for this device, app settings and policies. Linked from the profile picker (`/family`, where a parent lands after
  signing in) and from Settings. Focus suggestions get a card once it exists.

## Nickname and avatar

- Nickname: letters (A–Z), numbers, underscores and single spaces between words ("Thing 1").
  Spaces at the start and end are trimmed before checking and saving; no double spaces; 2–16
  characters after trimming (also enforced by a database check). Not on the block list. Strong
  words are blocked anywhere (number swaps such as `sh1t`, underscores and spaces are seen
  through, so "f u c k" and "a d m i n" are caught); short words that hide inside ordinary words
  (for example "ass" in "class") only when they stand alone between spaces or underscores.
  Uniqueness within the family and display are unchanged.
- The AI privacy filter and the feedback and flashcard checks match a nickname however its words
  are spaced or joined ("Thing 1", "thing 1", "Thing_1").
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
- The avatar can be animated (E9): idle, nod, hop and hmm move whole parts with CSS transforms, so
  every item combination moves together; still with reduced motion. Details: `docs/GAME_FEEL.md`.
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
- Each board or tier left as "Not sure" counts as one thing to check later. "Not sure" never
  blocks the parent. The items are shown on the finish screen, in Parent home as "Things to
  check: N" (the parent can set each one; `PATCH /v1/students/:id/enrolments/:subjectId`), and on
  the student's device in Settings > My subjects, where the student can set Not sure boards and
  tiers for their own subjects only, and only from Not sure to a real value
  (`GET /v1/student/subjects`, `PATCH /v1/student/subjects/:subjectId`). The student's home shows
  a gentle nudge until they are all set.
- Continue on the Add a child form is always tappable. If something is missing, a short summary
  appears next to it ("Add a nickname that isn't a real name", "Choose a school year") and the
  first problem is focused. A blocked nickname says: "That looks like a real name or a word we
  don't allow. Try a made-up nickname like Pixel_Fox".
- Starting look: Boy, Girl or Neutral (Neutral preselected), plus Edit avatar. Only the avatar
  code is stored, never a gender. On the child's first open on a newly linked device, "Make it
  yours" shows the avatar builder with "Maybe later" (`GET`/`PUT /v1/student/avatar`; locked items
  still need their reward).
- Changing subjects later (E5): each child's card in Parent home links to "Subjects"
  (`/parent/subjects/:studentId`), where either parent can add a subject (the same picker as
  onboarding, with "Not sure" for the board, and only subjects for the child's level that they
  do not already take), change its board or tier (under the headings "Exam board" and "Tier"), or remove it. Removing asks first and says the
  child's progress is kept and comes back if the subject is added again: only the enrolment is
  deleted, never the answers or mastery. A subject with no questions ready yet shows "Questions
  coming soon". Adding, removing and changing a board or tier are important changes in the family
  activity log ("added a subject for …", "removed a subject from …", "changed a board or tier
  for …"), so the other parent is told. A board or tier change clears a target grade that is no
  longer on the scale. The child's own Settings > My subjects works as before. API:
  `GET`/`POST /v1/students/:id/subjects` (400 `invalid_subjects`, 409 `already_added`),
  `DELETE /v1/students/:id/subjects/:subjectId` (404 if not taken) and
  `PATCH /v1/students/:id/enrolments/:subjectId`.
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
- Tapping a child opens the parent's view of that child: the parent home with that child
  chosen (`/parent?student=<id>`, workstream P), which links on to their stats, rewards and
  reminder times. It never opens student screens.
- Each child also shows "Rewards you set" (`/family/:id/rewards`) and "Link a device"
  (`/onboarding?link=<id>`, straight to that child's QR code). The page links to family
  feedback (`/feedback/family`) and to the parent home (`/parent`).
- Students always use their own device, linked by QR code and passkey. A student device behaves
  as before.
- After the 12-hour device session, the student unlocks with the passkey: on the welcome page
  ("I'm a student: unlock with my passkey"), or at `/unlock`, where any student screen sends them
  when its session has run out, and back to that screen afterwards. With no passkey on the device:
  "Ask a parent to link this device", with no account details shown. A passkey synced to the
  student's other devices (iCloud Keychain, Google Password Manager) works there too: each device
  it is used on becomes its own linked device, which a parent can unlink on its own, and both
  parents are told ("RevisionDen noticed <nickname>'s passkey being used on a new device"). At most
  one new device a day per passkey (cleared browser storage); an unlinked device stays refused.
- **Use my phone instead (E10).** On a computer or tablet, and anywhere after "No RevisionDen
  passkey was found", a second button signs in with the passkey on the student's phone: "Your
  browser shows a QR code. Scan it with the phone you use for RevisionDen." The computer then
  becomes a linked device, the parents are told, and the one-new-device-a-day limit applies, as
  for synced passkeys. If it fails: could not reach your phone (turn on Bluetooth on both, keep
  the phone close), this browser cannot sign in with your phone (try Chrome, Edge or Safari), or
  that passkey is not linked (ask a parent), with a "Details: <error name> (RD-…)" line.
  Parents and students share
  one sign-in page, the welcome page (`decisions/0007-student-passkey-unlock.md` in project
  memory).

### Linking a device (E4)

- The parent's "Link a device" step shows a one-time QR code (10 minutes). Under it, "Send a link
  instead" makes a shared link that lasts **24 hours** (messages aren't opened straight away):
  Share (the phone's share sheet: WhatsApp, Messages, email and so on) with "Copy link" as the
  fallback. The message reads "Set up RevisionDen on your phone: <link>". The link and message
  hold no nickname or other personal data (only the token and the family id).
- Each QR code and shared link also has a short code (8 characters, no look-alikes: no 0/O,
  1/I/L, shown as ABCD-EFGH) the child can type at `/link` when the camera or link is awkward.
  Codes and tokens are single use and stored only as hashes: a link is used up when a device
  finishes setting up its passkey with it (`/v1/device/link/verify`, atomically, so only one
  device can). Opening it before then (a reload, or trying again) is fine and gets a fresh
  5-minute passkey challenge each time while the link is unused, not cancelled and not expired
  (E8). Code attempts at `/link` have their own rate limit per address.
- Passkey set-up on the child's device (E8): if it fails, the page says why in plain words and
  shows "Details: <error name> (RD-XXXXXX)". Cancelled or timed out: "Try again" (with a fresh
  challenge fetched straight away); no screen lock: set up a PIN, pattern, fingerprint or face
  unlock first; this device already has a passkey for the child: "Unlock with my passkey";
  unsupported browser: open the page in Chrome (or Safari on an iPhone); link cancelled, used or
  expired: ask a parent for a new one. Before the tap, a browser without passkeys, or an in-app
  browser (the Google app or Lens, Instagram, Facebook, TikTok and the like), shows "Open this
  page in Chrome" with "Copy link" and, on Android, an "Open in Chrome" link; a device that says
  it has no screen lock gets a warning. The failure is reported with the error name only
  (`POST /v1/client-errors`, kind `passkey`) and carried into a bug report sent from that screen
  (`lastProblem`); a refused verify is logged with its own code (`invalid_challenge`,
  `passkey_not_verified`, `link_cancelled`, `link_already_used`, `invalid_link_token`).
- The parent sees "Waiting for <nickname>'s device…" and "Cancel this link" (a cancelled link no
  longer works, even on a device that had already opened it and not yet finished its passkey).
  The screen updates once the device that used that link has set up its passkey (each link
  records its own set-up, so another device or link never marks it done), and parents with
  push on are told "<nickname>'s device is set up" (a family event with no parent as the actor,
  so both parents hear).
- The parent home lists each child's linked devices: device type (phone, tablet or computer, as
  the device reported it; never the browser or model) and the date linked, with "Remove", which
  ends that device's session.
- API: `POST /v1/students/:id/link-tokens` (`{ kind: 'qr' | 'share' }`), `GET`/`DELETE
/v1/students/:id/link-tokens/:tokenId`, `POST /v1/device/link` with `{ code }`,
  `GET /v1/students/:id/devices` (with `deviceType`).

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
- **Mastery** of a topic is recomputed from the student's last 30 attempts after every answer;
  a retry after a wrong answer counts at half weight (see Learning from mistakes).
- **Typed short answers** are marked fairly (workstream F6, `packages/core/src/answer-normalise.ts`):
  word answers ignore case and extra spaces; maths answers also ignore every space, and treat the
  unicode minus as `-`, `×`, `·`, `*` (and `x` between two numbers) as one multiply, `÷` as `/`,
  superscripts as `^`, `≤`/`≥` as `<=`/`>=`, `√` as `sqrt`, and "and" or `;` in a list like `,`.
  A multiply sign is kept between two numbers and before a sign (`3n × -2` is not `3n - 2`).
  When the item sets `answer.any_order`, products and sums may be in any order (signs stay with
  their terms, and up to 4 letters on their own such as `pq` count as a product), a list of
  values in any order, and an equation either way round; coordinates and
  inequalities are never reordered. `answer.units` lists units the answer may end with or leave
  off. Different forms of a value (`√32` and `4√2`, `three` and `3`) still need listing.
- **Numeric answers** accept a UK thousands separator (`withoutThousands` in
  `packages/core/src/answer-format.ts`): a space (also a thin or non-breaking space) or a comma
  between groups of exactly three digits, the same one throughout, so `38 700` and `38,700` are
  38700, rounded or not. Any other space between two digits makes the answer wrong (`3 87` is not
  387); spaces around a sign or `/` are fine.
- **Numeric answers** also read the unicode minus and dashes (`−1`, `–1`) as a minus, a mixed
  number (`1 1/3` is 4/3, never 11/3; `withoutUnit`, `withMinus` in
  `packages/core/src/answer-format.ts`), and an answer typed with the item's own `answer.unit`:
  the unit as written (with `^2` or `²`), its words and symbols (`m` or `metres`, `£9600` or
  `9600 pounds` for pounds, `100p` for pence, `4 h` for hours). A different unit (`15 cm` when the
  unit is m) or a unit on an item without one stays wrong.
- **Answer form**: when the question asks for the answer in a form, the numeric item sets
  `answer.form` (`inForm` and `indexForm` in `packages/core/src/answer-format.ts`; the maths
  engine uses the same names for worked maths, T2), and the answer must be in that form as well
  as have the right value, as in GCSE marking:
  - `fraction` ("as a fraction"): a whole number or a/b, never a decimal or a mixed number, so
    `0.375` is wrong for 3/8;
  - `simplest_fraction` ("simplest form", "lowest terms"): also in lowest terms, so `69/99` is
    wrong for 23/33;
  - `improper_fraction` ("as an improper fraction"): in lowest terms and never a mixed number, so
    `2 9/20` and `98/40` are wrong for 49/20 (no form accepts a mixed number);
  - `standard_form` ("in standard form"): a × 10^n with 1 ≤ a < 10, so `640000000` is wrong;
  - `index_form` ("in index form"): powers of distinct primes, compared by value, so
    `2³ × 3² × 5` is right and `360` is wrong.
- **Standard form** in numeric answers (`standardForm` in `packages/core/src/answer-format.ts`):
  `a × 10^n` with ×, x, X, \*, · or ⋅ as the multiply sign and `^n`, `^(n)` or superscript
  digits for the power, or e-notation (`6.4e8`), is read as its exact value. When the answer key is
  in standard form, only proper standard form (1 ≤ a < 10) is right, so `64 × 10^7` and
  `640000000` are wrong; when the key is a plain number, standard form is accepted by value. With
  significant figures, the number in front shows the accuracy (`6.40 × 10^8` is 3 sf). A power of
  ten beyond ±100 (`1e999999999`) is not read as standard form, so the answer is simply wrong.
- **Maths working** may end with a letter answer such as `x = 2a` (or `2a = x`, or `a = x`
  either way round): a solved value may use other letters, never the unknown itself. Repeated
  alternatives count once, and a line with more than 64 ways to read it is marked wrong.
- **Mastery** of a topic is recomputed from the student's last 30 attempts after every answer.
- **Wrong answers** in a lesson (Learn mode, not the starting test) become a flashcard due at once,
  once per question.
- **Flashcard buttons:** Again (SM-2 quality 1, back in 10 minutes), Hard (3), Good (4), Easy (5).
  Each button shows when the card would come back, worked out by the scheduler. Deck XP is per
  **session, not per card** (product owner, 2026-11-25), so rating every card "Good" earns
  nothing extra:
  - A session ends when the due queue is empty or after 20 cards, whichever comes first. A
    session for one deck ("All decks", Review) only needs that deck's due cards done. A
    completed session of at least 5 cards earns **20 XP**, whatever the ratings. Fewer than 5
    cards, or leaving early, earns nothing.
  - At most **2 rewarded sessions a day** (40 XP), so flashcards alone cannot reach the daily goal.
    A session is paid at most once, and the limit holds even when sessions finish at the same
    moment (each rewarded session takes one of two daily slots, enforced by the database).
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
- **Topic map (F2):** units are the top-level topics of a subject's tree; each shows its leaf
  topics in specification order. A topic is locked while none of its items may be served,
  mastered at 80% or more, a weak spot when tried and below 60%, otherwise in progress. Unit
  mastery is the average of its open topics and its challenge unlocks at 80% (the challenge lesson
  draws on every topic in the unit). The next mission is the weakest weak spot, else the first
  topic not yet mastered, else a review of the weakest mastered topic. Implemented in
  `packages/core/src/map.ts` and `apps/api/src/routes/map.ts`.
- **Subjects with no questions yet** (owner bug RD-MBXKTC, F8): the map opens on the first
  enrolled subject with questions. A subject with none is `status: "coming_soon"`: the Map tab
  says "Questions for <subject> are on their way." with "Try <subject> meanwhile" when another
  subject has questions, never the error screen. With 2 or more subjects a subject switcher shows
  them all ("Chemistry (coming soon)"). Only a student with no subject at all, or an unknown
  subject id, gets "Choose a subject first" (404). The 5-a-day, recall and flashcards answer
  empty for these subjects.
- Implemented: `packages/core/src/learning.ts`, `apps/api/src/routes/learn.ts`,
  `apps/api/src/routes/flashcards.ts`.

## Interactive lesson pilot (workstream W8, owner decision 2026-11-26)

The owner pulled one interactive (Brilliant-style) lesson forward from Stage 4 as a pilot:
factorising quadratics (spec A4) with an area model, scope A only (x² + bx + c with b and c
positive whole numbers; negatives later).

- **Who sees it:** a student whose A4 topic is a weak spot (mastery below 60) gets the pilot
  steps first in the A4 lesson. Not at exactly 60 or above, not for a topic with no answers yet,
  and never in a unit challenge or subject lesson (`showsInteractivePilot`,
  `arrangeInteractivePilot` in `packages/core/src/interactive/pilot-lesson.ts`; content tag
  `interactive-pilot`).
- **Steps:** explore (x² + 5x + 6), two guided (x² + 6x + 8, x² + 8x + 12, each with a hint),
  one typed (factorise x² + 9x + 20, checked by the maths engine in factorised form), then the
  topic's normal questions as the hand-over (among them "Factorise x² + 7x + 12").
- **The area model step** (`area_model` item type): x² + bx + c drawn as one x² square, b x
  strips and c unit squares. The student picks the pair of numbers that multiply to c and add
  to b; the tiles make a rectangle whose sides, x + q and x + p, are the brackets. Tapping a tile
  lights up its term in the expression in the same colour and says what it is ("It is x by x, so
  its area is x²"). Explore says at once whether the tiles make a rectangle; guided keeps the
  verdict for Check. The answer is the pair ("2,3"), marked on the server.
- Counts like any question: XP (10, as multiple choice), streak, daily goal and mastery; a wrong
  answer gets the in-lesson retry and becomes a flashcard.
- **No tile-movement logging.** Only the checked answer is sent, as for any question.
- **Accessible:** tiles are buttons (one keyboard stop per kind), pairs are radio buttons, so
  nothing needs dragging; read aloud lists the pairs; theme colours; fits 320px at 200% text.
- **"Did this help?"** after the last tile step is checked: one tap, Yes or No, stored as
  feedback kind `lesson_helped` or `lesson_not_helped` with the item and never any text, one
  answer per student and item, not counted in the daily feedback limit. Parents and the
  operator see it with the family's feedback.
- **Hidden until verified:** the pilot items are draft content, so production does not serve
  them until they pass `docs/VERIFICATION.md`; development serves drafts with the DRAFT banner.
  The specification citation (1MA1 Higher, A4, page 14 / PDF page 26: "factorising quadratic
  expressions of the form") is quote-checked.

## Learning from mistakes (workstream F5, owner request 2026-11-25)

A wrong or very slow answer is not just marked and forgotten: the learning point comes back.

- **Learning point:** an item's optional `learning_point` tag in `content/`, or its topic when it
  has none. Content writers should give each learning point at least 3 items.
- **In-lesson retry:** after a wrong answer (Learn mode, not flashcards, long answers or recall
  checks), a similar question (another item on the same learning point, not answered in the last
  7 days, closest difficulty first) comes back 2 to 4 questions later. With no similar question,
  the same question comes back at the end: "Another go at this one: you've got this." There is
  no penalty, a retry earns the same XP as a first try and can build a combo, and a right retry
  gets a small "Comeback!" celebration. A question that came back can be skipped ("Skip this
  one"); the lesson finishes once every retry is answered or skipped.
- **No repeat-after-repeat** (owner guardrails, 2026-11-25), so the child always feels they are
  progressing:
  - At most **one retry per learning point** and **2 retries per lesson**.
  - A **second miss** on a point (its retry, or another question on it) ends retries for it today
    and **steps down** instead: "This one's tricky today, so we'll come back to it another day",
    with "Learn more" (as after any wrong answer), and an easier question on the same topic (lower
    difficulty) next if there is one. The point then waits for the review ladder.
  - **Never 2 hard retries in a row:** a **confidence question** (one the student has answered
    right before, same subject, another learning point) goes just before each retry; without one,
    a retry that would sit next to another waits for the ladder instead.
  - A lesson **ends on a success:** if the last answer was wrong, one confidence question comes
    before the summary.
- **Slow = shaky:** a right answer that takes more than **twice the expected time** still scores
  in full, but its learning point is shaky. Expected time is the item's `expected_seconds` when
  set, else a rough guide by type (owner, 2026-11-25): flashcard 15 s, multiple choice 20 s,
  numeric 40 s, short answer 45 s, worked maths 120 s. Long answers are never timed.
- **Review ladder:** a learning point with a wrong or shaky answer comes back the next day, then
  after 3 days, then after 7 days (`review_points`). Each right answer on time, on or after the
  day it is due, climbs a rung; a right answer at the 7-day rung takes it off the ladder. A
  right answer before it is due (such as the retry in the same lesson) changes nothing; a wrong
  or slow answer starts it again from the next day. A point clears after three right answers on
  time (days 1, 3 and 7; lead and owner, 2026-11-25). A point still missed on **3 ladder visits**
  is **parked for a week** and flagged as "worth a look with a teacher or parent" for the parent
  dashboard (`worthALook`; never shown to the child as a failure), instead of looping.
- **Where it comes back:** lessons and the 5-a-day open with up to **2 warm-up** questions on due
  learning points from the same subject ("Warm-up: this one came up last time"), preferring a
  question not seen for 7 days.
- **Mastery:** first attempts count as before; a retry counts at **half weight**, because it shows
  learning but is easier just after seeing the answer.
- Implemented: `packages/core/src/mistakes.ts`, `apps/api/src/learning/mistakes.ts`, the attempts,
  lesson and daily routes, `apps/web/src/features/learn/LessonPlayer.tsx`. Migration 0026.

## Clues and help (F10, owner 2026-11-26)

- **Need a clue?** shows the item's verified hint, with no penalty. It is offered only when a
  verified hint exists; the hint is no longer shown up front.
- The button then becomes **Help me understand**: the item's verified worked solution, one step
  at a time (worked steps, else the inline mark scheme, then its explanation, ending on the
  answer; the F7 Explain steps). With no hint but verified steps, it starts there. With neither,
  there is no button. Never AI-made (CLAUDE.md rule 7).
- Both open in place under the question, so the answer box and Check stay on screen.
- After help the student still has to answer: help is never a free answer. The answer is
  **helped**. A right helped answer earns half the usual XP, rounded down (owner), and never a
  combo. It is practised like a miss: it counts as wrong for mastery, goes on the review ladder,
  becomes a flashcard, and can come back in the lesson. The feedback says "Correct, with help".
  A clue on its own changes nothing.
- Learn mode only: there is no clue or help in Test mode or the starting test (the API refuses a
  helped Test mode answer).
- Implemented in `packages/core/src/help.ts`, `GET /v1/student/learn/items/:id/help`,
  `attempts.helped` (migration 0029) and `apps/web/src/features/learn/HelpPanel.tsx`.

## Showing maths (F9, owner 2026-11-26)

- Powers are shown as superscripts wherever students see maths: x^2 is shown as x², 10^-3 as
  10⁻³, 10^(2 + 8) as 10²⁺⁸ (a raised bracket loses its brackets). Only the power is raised
  (x^2y is x²y), and a^b^c is a to the power b^c, read right to left as in maths. This covers
  prompts, options, units, flashcards (both faces and the card list), Explain steps, answers and
  explanations in feedback, hints, and the review batch screens. Stored content keeps its ^.
- Screen readers hear the words from the read-aloud rules ("x squared", "to the power minus 3").
- A tap on any power switches every power on screen between x² and x^2, and back on another tap
  (F9b, owner). The choice is remembered on this device (`revisionden.powersSwitched`). In
  computing, powers start as ^ and a tap raises them. The tap only switches: it never chooses an
  answer or turns a flashcard. Screen readers hear the same words either way.
- A ^ with nothing it can raise stays as it is (content says "Use ^ for powers", which is how a
  power is typed).
- Typed-answer boxes and worked maths have a "Power" key that types ^ where the cursor is, and a
  "Shows as:" preview with the powers raised. ^ and ² typed straight in are still accepted.
- Computing subjects (subject or topic id containing "comput") show ^ as typed, with no Power
  key: there ^ is a real symbol (owner).
- Implemented in `packages/core/src/powers.ts` and `apps/web/src/components/MathText.tsx`; the
  e2e sweep `e2e/tests/powers.spec.ts` checks every real item that shows a power.

## Flashcards and mastery

- Flashcards follow SM-2: intervals 1 day, 6 days, then interval × ease; a wrong card comes back
  within 10 minutes. Due cards are ordered by how late they are compared with their interval.
- Mastery 0–100: weighted average of the last 30 attempts; weights halve every 30 days; two
  imaginary wrong answers as a starting point, so mastery is earned and fades without practice.
  A weak spot is a topic below 60.
- Implemented: `packages/core/src/spaced-repetition.ts`, `packages/core/src/mastery.ts`.
- **Turning a card (F7, owner):** tap the card, or press Space or Enter, to turn it either way as
  often as you like. Turning it back to the question never counts as another try and never
  changes the rating; the rating buttons stay once the answer has been seen. The answer face is
  empty until the answer is revealed, and each new card starts on its question with no turn, so
  the next card's answer never flashes while the card turns.
  The card and the rating buttons are named by the words they show (F8b, WCAG 2.5.3 Label in
  Name): the card reads its showing face, with "Turn over to see the answer" (or "Turn back to
  the question") as its description, and a rating reads, for example, "Good 1 day".
- **Explain (F7, owner):** on the answer side, "Explain" walks through the item's verified
  content one step at a time ("Next step", "Back", ending on the answer): its worked steps, else
  its inline mark scheme, then its `back_formula` and each condition, then the answer, then its
  verified `explanation` as a final "Why" step (enough on its own for a button). No AI-made explanation
  (CLAUDE.md rule 7). Cards without such content, and the student's own cards, have no Explain
  button. Implemented in `packages/core/src/flashcard-explain.ts` (`explain` on each card).

## Statistics dashboards (workstream K)

Two read-only dashboards built from data the app already holds. No new personal data is collected.
Mockups: screens 19 (student) and 20 (parent).

### Student: My stats (`/progress`, from "My progress" on the Me page)

On a phone the panel scrolls into view above the bottom bar when it opens and on each step
(F7b), instantly under reduced motion.

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
- **Worth a look together** (K11): topics holding learning points the child has missed on
  several review-ladder visits across days (flagged by F5's `worthALook`), one row per topic
  with how many points, and "Learn it first" where the topic has checked lessons. Wording:
  "These have been tricky for a while. A chat or a look with their teacher may help." No card
  at all when nothing is flagged. Parent only: never on the child's My stats.
- Latest school report effort scores (for example CBI), shown on the school's own scale.
- Rewards (workstream K10, owner request 2026-11-25): every parent-set reward for the child with
  its progress bar, and add, edit and remove right on the dashboard ("Add a reward", "Edit",
  "Remove" with a "Yes, remove / Keep it" step). It uses R's editor (`ParentRewardForm`) and
  routes (`apps/api/src/routes/rewards.ts`), so the checks and the two-parent activity log are the
  same as on the rewards page; given rewards can no longer be edited or removed. With none yet:
  "No rewards yet" and "Add a reward".
- Healthy habits: sessions in quiet hours, days at the daily limit, rest days taken.
- AI marking allowance (workstream K9, owner decision 2026-11-25): the per-child monthly cap shown
  as a percentage used ("12% used this month") and "Resets on 1 <next month>"; at 100%, "This
  month's AI marking allowance is used up. It resets on 1 <month>." Families never see money,
  spend or cost for AI. The month is the cap's own calendar month (UTC, `monthStart` in
  `apps/api/src/ai/gateway.ts`). The percentage is rounded down, so 100% only shows once it is
  really used up (`aiAllowance` in `packages/core/src/stats-allowance.ts`). No money leaves the
  API to a family client: the dashboard carries `aiAllowance` (`percentUsed`, `usedUp`,
  `resetsOn`), `GET /v1/students/:id/ai-usage` returns `allowanceUsedPercent`, `usedUp` and
  `resetsOn`, and the family data download shows each AI call's `allowanceUsedPercent` instead
  of its cost. The raw cost stays in the database and operator routes only.
- Recent activity: the last 10 events (lessons, flashcards, papers, homework marked, plan edits).
  No free text written by the student is shown.
- **Save as PDF**: made in the browser, nicknames only, nothing stored on the server.

### Motion on the stats pages (K5, owner 2026-11-26)

- Every stat tile number counts up from 0 to its value, and the bar charts and progress bars
  grow in (bars from the baseline, progress bars from the left). About 700ms, ease-out, a
  stagger of 60ms or less, the whole set within 1 second.
- Each runs once, the first time it comes into view; never again on a re-render, refetch or
  new period (switching Week, Term or Year shows the new values at once, with no second settle
  sound). A value that changes later shows at once. On the parent dashboard each child's
  dashboard animates once.
- Reduced motion (the device setting; the app has no motion setting of its own): no animation,
  final values at once. Printing (Save as PDF), even mid-count, shows the final numbers and
  full bars.
- Screen readers only ever get the final value (the moving digits are hidden from them), with
  no live announcements. Digits use tabular figures and keep the final width, so nothing shifts,
  and every frame is formatted like the final value (%, "1 h 20 min", "3 of 4").
- Sound: the parent pages are silent. On the student's My stats, one soft "settle" sound and
  vibration (`ringFill`, in the active sound pack, respecting mute) when the counts finish;
  never per digit, and none with reduced motion.

### Rules for the numbers

- **Active study time** counts time between answers in a session; a gap of more than 5 minutes
  ends the session and the gap is not counted. Time past the student's daily limit is not counted.
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
- **Daily limit**: each student's own limit for that day (see "Daily limit (wellbeing)").
- **Subject mastery** averages the topics the student has practised; the change replays topic
  mastery from the marked answers at the start of the period (student) or 4 weeks ago (parent),
  counting topics not practised then as 0. Weak spots are the three lowest practised topics.
- **Healthy habits** are for this week: sessions that start in the reminder quiet hours (night or
  school hours, as set by the parent), days past the daily limit, and finished days with no study.
- **Recent activity** groups back-to-back answers of one kind and subject (gaps up to 5 minutes)
  into lessons, tests, starting tests and flashcard practice. Flashcard reviews show only each
  card's latest review (that is all that is stored).
- The level bar and parent-set rewards come from the rewards progression (workstream R), read
  through R's read-only `rewardsProgress` (`apps/api/src/stats/reward-adapters.ts`), so the
  numbers match the Rewards page and reading them never uses up the student's "New!" rewards. Parent-set
  rewards are listed not-yet-given first, without the note to the student.
- **Target grades** (workstream K8; owner decision 2026-11-25). Each subject has two targets, both
  goals to reach for:
  - the **parent's target**, set or cleared by either parent in the "Target grades" panel of the
    parent stats dashboard. The latest change wins, and each change goes in the family activity
    log as an important change ("changed {child}'s target grades");
  - the **child's own target**, set or cleared by the child on My stats. It is not logged as a
    change for the parents.
  - The child sees both side by side on My stats; the parents see both in their panel, and the
    subjects table shows the parent's target. When they differ the tone stays encouraging: no
    red, "fail" or "below" styling or wording.
  - Both must be on the subject's grade scale for its board and tier, best first. A scale is a
    specification fact, so it is offered only where its official citation is stored
    (`packages/core/src/target-grades.ts`, `GRADE_SCALES`). Today that is GCSE Maths, Pearson
    Edexcel 1MA1: higher tier 9 to 3 and U, foundation tier 5 to 1 and U, and 9 to 1 and U while
    the tier is not chosen (specification page 31). Other subjects and boards, and every A-Level,
    say "not available yet" until their scale is cited.
  - Changing a subject's board or tier (parent in Parent home, or the child turning Not sure into
    a value in Settings > My subjects) clears either target that is not on the new scale, for
    example a 9 when the tier becomes foundation; a target still on the scale is kept.
  - Kept with the child's courses (`enrolments.parent_target_grade`, `student_target_grade`) and
    in the family data download.
  - API: `GET /v1/students/:id/target-grades` (each enrolled subject, both targets and the grades
    they can take, or `grades: null`); `PUT /v1/students/:id/target-grades/:subjectId` (parent's
    target) and `PUT /v1/student/target-grades/:subjectId` (child's own), each `{ targetGrade }`,
    null to clear, 422 `grade_not_on_scale` or `no_grade_scale`. Student stats carry `targets`.
- Panels not built yet (study plan, school report effort, predicted grades) come from
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
- The young people's notice (`/legal/privacy-for-young-people` and `/welcome/privacy` after linking)
  uses a friendly view: "The short version" as 6 icon cards, then one card per part with its 2 to 4
  key points always visible and "Read more" (a button with `aria-expanded`) for the full text;
  "Expand all" at the top; printing shows everything. Original SVG icons and Pip (with a padlock at
  the top, waving at the end). Cards slide in on scroll and parts open smoothly; no motion under
  reduced motion, and text is never faded (contrast stays AA). No "Was this clear?" vote: the
  feedback table has no place for a yes/no answer and a notice version without a migration.

### Feedback and bug reports

- **Bug icon:** a small bug button is on every screen, never covering content: in the student app
  it sits in the top row beside Get help and the sound button, and on parent screens in a top row
  of its own; on other focused and public screens (lessons, welcome, About) it sits in a corner,
  with room left below the page. It is hidden during timed papers and Test mode
  questions. It opens the bug report
  sheet straight away, with the current screen filled in. Students can turn the icon off in
  Settings.
- When the operator confirms a student's bug, the student is told in the app and earns the Bug
  Hunter rewards in `REWARDS.md`.
- Operator triage (`/admin/feedback`) has **Confirm bug** and **Duplicate of…** (an earlier
  confirmed report) for bug reports. Each report can be confirmed once. Rules:
  `packages/core/src/bug-hunter.ts`; a week is Monday to Sunday, UK time; the 3-a-week cap counts
  full and duplicate rewards, and past it the student is thanked with no XP and no track step. The
  student sees the thank-you once (a toast on their next visit). Bug XP counts towards total XP,
  not the daily goal or streak. The button's on/off setting is per device
  (`revisionden.bugButton`). Built in L7.

- Kinds: **bug**, **idea**, **something confusing**, **other**. (Mistakes in a question keep
  using "Report a problem" on the item, which quarantines it.) Also, from the interactive lesson
  pilot only, the one-tap **lesson_helped** / **lesson_not_helped** ("Did this help?"), which
  carry the item and no text and do not count towards the 5 a day (W8).
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
  after it is closed (fixed or will not fix), by the daily clean-up. The operator is any parent
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
  XP, starting tests, flashcards and flashcard sessions, the review ladder, reminders, AI usage, parent-set rewards), plus the family's
  feedback and question reports. Secrets are left out (session and link-code hashes, passkey keys
  and credential ids, push keys). Never another family's data.
- **Activity:** any parent or student request marks the family as used (`families.last_active_at`,
  written at most once an hour).
- **Inactive accounts:** a family nobody has used for more than 12 calendar months is deleted by
  the daily clean-up, with its students and all their records and the parents' sign-in
  records. A sign-in that never became a family is deleted 12 months after it was made.
- **Warning:** the parent area always says the date the account will be deleted if nobody uses it.
  If the family comes back after 11 months or more without use, the parent area shows a warning
  with the date it would have been deleted (for that visit: until the next hourly activity
  write). No emails are sent.
- **Clean-up** (once a day, 03:17 UTC; production only): expired device link codes, student sessions, parent sessions,
  passkey challenges and sign-in checks are deleted.
- **Sign-in tokens:** the Google or Microsoft access, refresh and ID tokens are never kept.
- Implemented: `apps/api/src/cleanup.ts`, `apps/api/src/routes/{family,export}.ts`,
  `apps/api/src/auth.ts`, `apps/web/src/features/family-data/`; migration 0006.

### Error reports (workstream I)

- Every error that shows a reference code (`RD-XXXXXX`) also shows **Send error report**. One tap,
  no typing; then "Thanks, we're on it." If it cannot be sent, the button stays to try again.
- The report is anonymous: the code, the screen and the failing API path (ids replaced by
  `:id`), the status, the app build, the browser family, online or not, and the time. Never the
  nickname, ids, free text or answers (`POST /v1/error-reports`, strict schema).
- One stored report per code; rate limited (30 a minute per address); deleted after 90 days.
- The operator sees them grouped by screen, API path and status at `/admin/feedback` (filter
  "Error reports") and from `GET /v1/admin/error-reports?since=…` or
  `DATABASE_URL=… node scripts/error-reports.mjs`. The API logs a line with the same code, so a
  report matches the API's own error line.

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
  sound, but animation sounds play at half loudness and vibrations are shorter (U6).
- **Style sounds and haptics (U6, owner rule: "All animation should have an appropriate movement
  and sound").** Every animation fires one feedback event: `buttonPress`, `cardFlip`, `correct`,
  `wrong`, `combo` (step 1–6), `xpTick`, `ringFill`, `rewardWobble`, `rewardOpen`, `rewardUnlock`,
  `setComplete`, `levelUp`, plus `homeEnter` (Home entrance, once per visit), `nodePop` (topic
  nodes popping in on the map) and `locked` (tapping something locked) (`useSound().emit(event)`). Each plays the active effect style's sound and
  a vibration pattern. One sound pack per style, synthesised with Web Audio (no files): Sticker Book
  (paper peel, slap, stamp, pencil tick), Pop Burst (bubbly pops, jelly boings), Starlight
  (chimes, shimmer, soft swells), Comic Pop (punchy low-passed squares, whooshes, POWs), Garden Grow
  (soft woodwind and chimes), Pixel Arcade (chiptune arpeggios) and Doodle Diary (pencil scratches,
  page flips, biro clicks, a rubber squeak for locked, a scribble flourish for unlocks), matched to
  J's mockup previews (U6c). Square waves only in Comic Pop and Pixel Arcade, always low-passed
  (2800 Hz) and under the loudness cap; "wrong" stays a soft sine or triangle in every style. The
  default is one value, `DEFAULT_STYLE` in `features/sound/feedback/styles.ts` (Doodle Diary,
  owner-approved; Sticker Book is now an unlockable style like the others). Unknown styles use the default. Style
  ids: `sticker-book`, `pop-burst`, `starlight`, `comic-pop`, `garden-grow`, `pixel-arcade`,
  `doodle-diary`. J's style system calls
  `useFeedbackStyle(styleId)`. Older `play()` calls for tap, correct (combo when it has a step),
  wrong, card flip, celebration, level up and reward unlocked follow the style too; the rest keep
  the main bank, and reward tiers (U4) keep their own sounds but add the matching vibration.
  - Vibration: a light tick for presses and flips, a double pulse for right answers, a rising rhythm
    for combos and a longer pattern for unlocks, set complete and level up; a light tick for the
    Home entrance and one short buzz for a locked tap; none for fast ticks or map nodes popping in.
    Sticker Book feels crisp, Pop Burst bouncy, Starlight soft and long, Comic Pop strong and
    snappy, Garden Grow gentle, Pixel Arcade short rapid blips, Doodle Diary light pen taps.
  - Settings: a **Vibration** switch next to Sound, on by default, saved per device
    (`vibration` in `revisionden.sound`). It works on its own: muting sound does not stop vibration,
    and turning vibration off does not mute sound.
  - Limits: the same tick sounds at most every 70 ms (XP, map nodes) or 90 ms (ring fill), presses
    every 40 ms,
    and no more than 10 feedback sounds a second; vibration needs 100 ms between buzzes and at
    most 4 a second. Nothing plays or vibrates before the first tap; mute, volume, tap sounds and
    the Test mode rule all apply.
  - Devices: vibration uses `navigator.vibrate` where it exists (Android browsers). iPhone and iPad
    browsers and Home Screen apps have no Vibration API, so there is no vibration there and the
    Settings switch says so; there is no workaround. The module (`features/sound/feedback/haptics.ts`,
    `HapticsDriver`) is the plug-in point: a native wrapper (for example Capacitor or React Native)
    could later pass a driver that uses the platform's real haptics on iOS and Android.
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
  Prestige stars play legendary even where the catalogue rarity is epic. Combo chime (U5):
  `play('correct' | 'partMarks', { step })` raises the chime a whole tone per step, clamped at 6
  (an octave); the lesson player passes `comboStep(combo - 1)`, so the first right answer is the
  plain chime. The wrong sound never changes. Gifts, plan and timed
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

## Add RevisionDen to this device (I6)

Owner request, 2026-11-25: a clear install button, not only a text link in Settings.

- "Add RevisionDen to this device": a short row in the Today strip of the child's topic map (J12b)
  and a card with Pip on the parent home. Both are part of the page, never a pop-up. Settings has
  the same entry as a button. "Not now" in either hides both.
- **Chrome, Edge and Android:** the app keeps the browser's install prompt (`beforeinstallprompt`)
  and shows it when the button is tapped.
- **iPhone and iPad Safari** (no install prompt): the button opens a sheet with three illustrated
  steps (Share, Add to Home Screen, Add), worded for an iPhone or an iPad. `/install` shows the
  same steps for the device in use (both, plus the Chrome and Edge way, on other devices).
- **Browsers that cannot install** (for example Firefox on a computer): no card or row; Settings links to
  `/install`.
- Hidden once installed (opened from the Home Screen, `display-mode: standalone`, or the
  `appinstalled` event), and for 30 days after "Not now" on this device (local storage
  `revisionden.installDismissed`).
- Implemented: `apps/web/src/pwa/{install.ts,InstallCard.tsx,IosSteps.tsx,installStore.ts}` and
  `apps/web/src/map/InstallRow.tsx`.

## Daily limit (wellbeing)

Requested by the product owner on 2026-11-25. One daily limit per student, in **active study
minutes** (the same measure as the stats dashboards: time between answers, gaps over 5 minutes not
counted).

- **Defaults** (a starting point, not a target): GCSE 60 minutes on school days and 90 at weekends
  and in holidays; A-Level 90 and 120. Exam season (from 6 weeks before the student's first exam)
  adds 30 minutes, if the parent agrees.
- **Hard ceiling** the app never suggests going past: GCSE 2 hours on school days and 3 on other
  days; A-Level 2.5 and 3.5. A parent may set a lower or higher limit by hand.
- **Parent control:** either parent can change the limit at any time (per day type) from the parent
  area. The student sees their limit and how much is left; they can always stop early with no
  penalty.
- **Suggestions, never pushes.** Once a week the app may suggest a change to the parent; it never
  changes the limit by itself.
  - **Suggest a small rise** (+10 minutes, at most once a fortnight) only when, over the last 2
    weeks, the student reached the limit on at least 4 days, accuracy in the last 15 minutes of
    sessions stayed within 5 points of the first 15, and they chose to keep going (not prompted).
  - **Suggest easing off** (−10 to −15 minutes) when accuracy drops by more than 10 points late in
    sessions (tiredness), sessions keep being abandoned part-way, or rest days are being skipped.
  - Suggestions say why in plain words ("Accuracy dips after about 40 minutes"); the parent accepts,
    changes or dismisses them. The student is told when their limit changes.
- **At the limit:** practice screens show "Great work today. See you tomorrow"; no XP, rewards or
  streak credit past it (the existing healthy-limits rule). Timed papers may finish past the limit;
  the limit then pauses other practice for the rest of the day.
- The XP reward cap (`DAILY_REWARD_XP_CAP`, 300 XP) stays as a safety net alongside the minutes
  limit.

How the rules are settled in code (workstream K7; the four judgement calls marked ✓ were confirmed
by the product owner on 2026-11-25):

- ✓ **School days** are Monday to Friday; other days are weekends and holidays. School holidays are
  not known yet (no term dates are entered), so for now holidays count as school days (see
  `project_memory/operations/contradictions.md`).
- **Exam season** runs from 6 weeks (42 days) before the student's first exam (`exams`, kind
  `exam`) to the day of the last exam.
- ✓ A parent may set any limit from 15 minutes to 6 hours per day type; a limit left unset follows
  the default for the student's level (Years 9 to 11 GCSE, 12 and 13 A-Level).
- **Reaching the limit**: the answer that takes today's active minutes to the limit, and anything
  after it, earns no XP (answers, test-mode combos and flashcard session XP; a flashcard session
  finished past the limit keeps its reward slot for another day). Mastery still updates.
  Every progress response carries `dailyLimit` (limit, used, left, reached) for the practice
  screens; the set-complete screen says "Great work today. See you tomorrow" when it is reached
  (or, as a safety net, at the 300 XP reward cap: `pastDailyCap` in `features/juice`). Timed papers may finish past the limit (`creditsPastLimit`; papers are not built yet).
- **Suggestions** are worked out at most once every 7 days, when a parent opens the daily limit
  panel, and wait there until accepted, changed or dismissed. Easing off: −10 minutes for one
  tiredness sign, −15 for two or more, never below 15 minutes. Signs: accuracy in the last 15
  minutes of sessions of 30 minutes or more is more than 10 points below the first 15; ✓ two or more
  starting tests left unfinished for over an hour (lesson sets are not recorded yet, so these are the sessions we
  can see stopped part-way); no rest day in the last two weeks. A rise (+10, both day types, never
  past the ceiling or below a limit set by hand) needs the limit reached on 4 of the last 14 days
  and late accuracy within 5 points of early accuracy; ✓ the app never prompts a student to keep
  going, so reaching the limit counts as their own choice. At most one rise a fortnight.
- The student sees today's minutes left on My stats, and a one-time notice when a parent changes
  the limit.
- **Two parents:** either parent can change the limit or answer a suggestion; the latest change
  wins. Each change (a saved limit or an accepted suggestion, not a dismissal) goes in the family
  activity log as "changed the daily limit", so the other parent is told.
- Implemented: `packages/core/src/daily-limit.ts` and `daily-limit-schemas.ts`; API
  `apps/api/src/daily-limit/` (`GET`/`PUT /v1/students/:id/daily-limit`,
  `POST /v1/students/:id/daily-limit/suggestion`, `GET /v1/student/daily-limit`,
  `POST /v1/student/daily-limit/seen`); the `daily_limits` table; web
  `apps/web/src/features/stats/DailyLimit.tsx`.

## Two parents (shared parent control)

Requested by the product owner on 2026-11-25.

- A family can have **two parent accounts with equal control**. The first parent invites the
  second from the parent area with a one-time link or code (valid 7 days); the second signs in with
  their own Google or Microsoft account (only their sign-in email is kept, as for the first).
- Both parents can do everything: add or remove children, settings, limits, focus, rewards,
  feedback, export and deletion. Deleting the whole family needs both parents to confirm (or one
  parent after the other is removed).
- A family activity log shows what changed and by which parent ("Parent 1", "Parent 2"; no names),
  and the other parent is notified of important changes (limits, children added or removed,
  rewards given, exports, deletion requests).
- Either parent can remove the other; the removed parent sees an in-app notice on next
  sign-in and loses access at once. Students see that two parents can view their progress.
- The privacy notice must list the second parent's sign-in email as data kept.
- **How it works (workstream B3):** "Invite a second parent" in the parent home gives a
  12-character code and a `/join?code=…` link (7 days, used once, stored hashed, 5 a day per
  family; joining is rate-limited like sign-in). The second parent signs in with their own account
  and joins; they become Parent 2 (or whichever number is free). A parent whose own account already
  has children or another parent cannot join until it is deleted. At most two parents.
- **Equal control:** every parent route works from the family, so both parents pass every guard.
- **Removing:** either parent removes the other ("Remove Parent 2"). The removed parent is refused
  at once (`403 removed_from_family`) and sees a notice in the parent home; after OK they start
  again with an empty family. Nobody removes themselves.
- **Deleting the family:** "Delete the family account" deletes everything at once when there is
  one parent; with two, it waits until the other parent confirms ("Confirm deletion") and either
  can cancel. Deletion removes every child's records and both parents' sign-ins.
- **Activity log:** every successful parent change is logged as "Parent 1"/"Parent 2" + what
  changed (children, subjects, avatar, devices, reminders, daily limit, rewards, export, invites,
  joining, removal, deletion). Important ones (children added or removed, limit changed, reward
  given, data downloaded, deletion asked or cancelled, parent joined or removed) count as new for
  the other parent until "Mark as seen", and are pushed to the other parent's devices once by the
  reminder cron (every 30 minutes, 06:30 to 20:30 UTC; not in UK nightly quiet hours, not after a day). Entries about a child go with
  the child; entries are kept 12 months.
- Implemented: `apps/api/src/routes/family-parents.ts`, `apps/api/src/family-events.ts`,
  `apps/web/src/features/parents/`; migration 0012.

## Me page (`/settings`, workstream W9, owner feedback 2026-11-26)

Owner: "The avatar/Me settings page is a little convoluted, and it doesn't allow customising your
own avatar." The page is now short enough for one phone screen (390 × 844):

- **Top:** heading "Me", the student's avatar (large) and nickname, and **Edit my avatar**. It opens
  the avatar builder (E's, reused as it is) in a sheet with Save and Cancel. Cancel, Escape or the
  close button ask "Throw away your changes?" (Keep editing or Throw away) if anything changed.
  Save sends the look with `PUT /v1/student/avatar`; the nav's Me avatar changes as soon as the
  server says yes. The API's only rule is that every item is unlocked (locked items need their
  reward); there is no parent approval and no rate limit. The nickname comes from
  `GET /v1/student/me`.
- **Then:** Get help (always the first link on the page), My progress, My rewards, Look and sound, More, as J15a button tiles: an icon over a 2–3 word label, no helper sentences (owner, 2026-11-26). Get help uses `tone="help"` (calm, no page transition).
- **Look and sound** (`/settings/look-and-sound`): Reading comfort, Appearance (theme), Effect style
  (students only; its picker is unchanged), Read aloud, Sound (with vibration).
- **More** (`/settings/more`): My subjects, Reminders, This device (install, Switch profile, Show
  the bug button), Parents (Parent home, Ask a parent), Feedback (send, yours, your family's),
  Policies and About, and What your parent can see. Links there are button tiles too (Switch profile,
  Parent home, Ask a parent, Send feedback, My feedback, Family feedback, Policies, About); the
  install button keeps its own control. Both sub-pages end with "Back to Me".
- A parent on `/settings` (no student on the device) sees no avatar header, and gets a Parent home
  tile on the main page as well as in More.
- Code: `apps/web/src/pages/SettingsPage.tsx`, `apps/web/src/features/me/` (`MeHeader`,
  `MyAvatarProvider` shared with the nav). Screenshots: `docs/design/w9/`.

## Get help (support resources)

Requested by the product owner on 2026-11-25.

- A **"Get help"** page for students, reachable from Settings (the Me page; first link on it). Also
  reachable signed out. Owner decision, 2026-11-26 (W7): students find Get help on Settings only,
  reached from the "Me" avatar item in the main nav; it is no longer in the student header or
  footer. (Was: Settings, the profile menu and the footer of every student screen.)
- It lists UK support services by topic, each with what they help with, how to contact them
  (tap-to-call `tel:` links, text numbers, web chat links) and opening hours where published.
  Topics: feeling low or anxious, exam stress, suicidal thoughts (urgent), bullying (including
  online), abuse or neglect, online safety and nude images, eating and body image, self-harm, drugs
  and alcohol, sexual health and relationships, LGBTQ+, young carers, grief, crime and victims,
  physical health (NHS 111) and emergencies (999).
- Services to consider (each must be confirmed on its own official website): Childline, NSPCC,
  Samaritans, Shout, Papyrus HOPELINE247, YoungMinds, Kooth, The Mix, Beat, Talk to Frank, CEOP,
  Childline and IWF Report Remove, Switchboard, Mind, Brook, Anti-Bullying Alliance, Kidscape,
  Carers Trust, Victim Support, NHS 111.
- **Verified facts only:** every phone number, text number, URL and opening time is copied from the
  service's own official page, with that URL and the date checked recorded in the data file. Any
  detail that cannot be confirmed is left out, never guessed. Rechecked every term; a test fails if
  an entry has no source or its check is older than 4 months.
- **Private:** nothing about visiting this page or tapping a link is recorded, logged, shown to
  parents or sent anywhere (no analytics, no feedback prompts, no activity log). The page works
  offline (cached) so a number can be found without signal.
- A **Quick exit** button takes the student straight to a neutral screen (the topic map) and replaces
  the page in history.
- At the top: "If you are in danger right now, call 999." Wording is warm, short and non-judgemental;
  it never asks the student to explain themselves.
- Parents can see the same page from the parent area, plus the NSPCC adult helpline for worried
  adults.

### How it is built (workstream W, 2026-11-25)

- Pages: `/help` (students, also signed out) and `/parent/help` (parent area; adds a "Worried about a
  child?" card with the NSPCC Helpline). Links: for students, a prominent Get help tile at the top
  of Settings (above everything else), reached from the **Me** item, the last item in the main
  nav (owner, 2026-11-26, W7). The student main nav is now five items: Map, Cards, Plan, Papers
  and Me; Progress moved onto the Me page as "My progress", right after Get help, and Me is marked
  current on `/settings` and `/progress` (and their sub-pages); signed out, the public header; parents, parent home. History: W3
  added a header chip and a map tile, W5 removed the map tile, and W7 removed the student header
  chip and the footer heart link (the owner chose "Settings only" over keeping the footer heart).
  All use the shared link components; tapping them records nothing.
- Layout (W3, 2026-11-25): the "Quick exit" button sits in a bar that stays at the top of the
  screen while scrolling (sticky, padded for phone notches with `env(safe-area-inset-*)`, first
  control after the skip link). Topics are grouped into categories
  (`apps/web/src/features/help/categories.ts`): **Right now** (In danger right now, Thinking about
  suicide) is always first and always open; **Feelings and mental health** starts open; **Staying
  safe**, **Home, school and friends** and **Body and health** are collapsible (native
  `<details>`), each summary listing its topics. A "Find a topic" box filters by the words of the
  topics and their services; "In danger right now" always stays; a live status says how many
  topics match. The search is component state only: never stored, sent or put in the address.
  Grouping is presentation only: every verified entry and all wording are unchanged.
- Service cards (W3): each service is a compact card with its name, its one-line description (and
  any confirmed note), and its contact actions as clear buttons (shared `LinkButton`, at least
  48px tall): **Call** and **Text** are primary buttons (`tel:`/`sms:` links unchanged); chat,
  website, WhatsApp and email are secondary buttons (new tab, no referrer). Opening hours show
  under each button. Age range and area sit behind "More about <service>". No plain text links,
  no new wording. Buttons are calm on this page (normal case, no 3D shadow or press movement), and
  in forced colours (Windows High Contrast) the danger panel, Quick exit, category headings and
  search box keep visible borders. Button text wraps (W6): on a 320px screen with text at 200%
  every button fits and the page never scrolls sideways (e2e `help.spec.ts`).
- Data: `content/support/uk-services.json`, schema `content/schemas/support-services.schema.json`.
  Each service has topics, one plain sentence of our own (`helps_with`), its official domains,
  optional age range and area, contacts (phone as `tel:`, text number with keyword as
  `sms:<number>?&body=<KEYWORD>`, web chat, website) with optional hours, and `checked_at`. Every
  contact, hours, age range and area has a `source`: the https URL of the service's own page it was
  copied from, which must be on one of its official domains.
- Checks (`scripts/content/support.mjs`, run by `pnpm content:validate` and its tests in CI): schema;
  sources on the official site; links on the official site; `checked_at` not in the future and not
  older than 4 months; phone numbers in UK format (10 or 11 digits starting 0, 116 numbers,
  Childline's 0800 1111, 111, 999) with a matching `tel:` link; text numbers as UK short codes or
  mobiles with a matching `sms:` link; every topic has at least one service for students.
- Added 2026-11-25 from the product owner's own check of the official sites (recorded as
  `confirmed_by` in the data): **Coram Kidscape** (was Kidscape; `coramkidscape.org.uk`): its young
  people's advice page for students under bullying; for parents only, the **Parent Advice Line**
  (phone and WhatsApp 0300 102 4481, email, 9am to 9pm Monday to Friday and 10am to 3pm Saturday
  and Sunday). **Anti-Bullying Alliance**: parents only (website), because its site sends young
  people with a problem to Childline; students' bullying card lists Childline and Coram Kidscape.
- **Kooth** (now "Soluna by Kooth"; added 2026-11-25 at the product owner's request): students and
  parents, under feeling low. Website `https://www.kooth.com/` only, as seen by the build session.
  The note "Free in some parts of the UK. Check if it's available where you live." is the product
  owner's (kooth.com did not say it), so the entry has `confirmed_by`. No hours, ages or areas.
- A service may have a short `note` shown on the page; the validator only allows it with
  `confirmed_by`, because no checked source backs it.
- Contacts can also be WhatsApp (UK number, link `https://wa.me/44…` that must match it) and email
  (`mailto:` link; the address must be on the service's official domain).
- Recheck each term: open every `source`, confirm each detail, update `checked_at`. Leave out any
  detail that can no longer be confirmed.
- Left out on 2026-11-25 (could not be confirmed on the service's own site from the build
  environment; recheck by hand): Papyrus HOPELINE247 (`papyrus-uk.org` redirects to an insolvency
  administrator's page), Mind and Carers Trust (their sites block automated visits). These stay out for now (lead, 2026-11-25). Also left out: Samaritans web chat (a pilot,
  "not currently available"), FRANK live chat and email, Switchboard chat and email (could not be
  seen from outside the UK), Beat's email and web chat hours, and Childline's message service. Grief has
  no specialist service yet (none was on the list to check) and young carers' one (Carers Trust)
  could not be checked, so both topics list Childline and Samaritans.
- Logos (W4, 2026-11-26): organisations' logos are trademarks, so one is shown only when the
  organisation's own guidance clearly allows this use or it gives written permission. None does
  yet: every service shows a neutral icon beside its exact name. Findings per organisation, and an
  email template for the owner to request permission, are in
  `docs/LOGO_PERMISSIONS.md` (a test checks it covers every service). A permitted
  logo would be self-hosted under `apps/web/public/support-logos/`, unaltered, with alt text equal
  to the organisation's name, and never hot-linked.
- Privacy: its own layout with no navigation, sounds or API calls; nothing is fetched to show it
  (the data is built into the app); websites open in a new tab with `rel="noreferrer"`. A unit test
  and an e2e test check that visiting it makes no API calls and no requests to other sites. The
  effect style provider wraps every screen but loads nothing on Get help (J10e, tested in
  `EffectStyleRoute.test.tsx`).
- Style: calm, no game-feel effects (`features/help/help.css`). Follows the app's theme (light,
  dark, colour-blind) through its own `--help-*` colours; every text pair meets WCAG AA and Quick
  exit and control borders meet 3:1 in every theme (`helpTheme.test.ts`). The danger panel keeps a
  thick border and bold text in each theme (red, or orange-brown in the colour-blind palette);
  Quick exit is solid (dark in light themes, white in dark themes).

## Quick wins from the competitor research (owner approved 2026-11-25)

From `docs/research/competitors-2026-11.md`. Workstream Q.

### Daily 5-a-day

- Each day a student gets a short mixed set of **5 questions** from topics they have already
  practised, chosen by spaced repetition and weak spots (never brand-new topics), across their
  subjects. Takes about 5–8 minutes.
- Learn mode, normal XP and combos; finishing it counts as a lesson for the streak and daily goal.
  It appears in the topic map's Today strip, under the next mission, until done; it never nags (no
  push just for 5-a-day).

### Recall checks

- At the start of a lesson on a topic practised before, 2 quick recall questions on things learned
  in earlier lessons ("Remember this?").
- No penalty: wrong answers do not lower mastery more than a normal answer would, earn no XP loss,
  and simply become flashcards. Right answers earn normal XP. They can be skipped.
- Combos (owner decision, 2026-11-25): a wrong recall answer never resets the combo, because recall
  checks test older topics and should feel safe. A right one still adds to the combo.

### Learn it first and Learn more

- **Allowed providers** (owner decision, 2026-11-26): **Oak National Academy**, **BBC Bitesize** and
  **Isaac Physics / Isaac Science** (University of Cambridge). No others. Criteria: free, made for UK
  secondary pupils, no ads, no comments or social feeds, no sign-up needed to read. Ad-supported
  sites and exam-board pages were not chosen. Isaac's host is `isaacscience.org` (read on
  2026-11-26: isaacphysics.org now redirects there and the site calls itself Isaac Science).
- **External links are interim** (owner goal): all of this teaching is to be in-house, as our own
  verified notes. The data is ready for that: provider `revisionden` points at an in-app route (not
  a URL), is always listed first, and can hide the external links for the item, point or topic it
  covers (`hide_external`). The notes are not built yet, so the validator refuses them for now.
- Each topic can link to free lessons from those providers (and, later, our own verified notes).
  A link can be for the whole topic, or only for some of its learning points or items.
- **Learn it first**: at the top of a topic lesson (and on the parent's "Worth a look together"),
  the topic's whole-topic links.
- **Learn more** (owner request, 2026-11-26: "link out to authoritative, age-appropriate sources
  for further tuition guidance when a question needs more explanation"): on a flashcard's Explain
  panel and after a wrong answer in a lesson, behind a "Learn more" tap. It shows the most specific
  links: those for the item, else for its learning point, else the whole topic's. Lesson items and
  flashcards carry their content id and learning point (Q6b), so both match all three levels.
- Links only (open in a new tab on tap; nothing loaded from those sites until then, nothing
  recorded about taps), stored as data per topic with the page title, URL and dates.
- A link shows only when it is both **reachable** (`checked_at`: the CI job requests every link and
  fails on broken ones) and **match-checked** (`match`: someone opened and read the page and
  recorded its title as fetched, what it teaches, its level and the date). A page that was not
  opened is never recorded. The CI job also fails when a match-checked page's title changes, so the
  match is re-checked.
- Every reachable link needs the full match check; the validator refuses one without it. (The 11
  Oak links from Q5 were re-read and match-checked on 2026-11-26, so the temporary "legacy" path
  for them was removed.)
- Coverage (2026-11-26): every GCSE Maths topic and learning point with items has a shown link:
  44 of 44 topics and 133 of 133 learning points, 69 of them with a page of their own (139 links:
  Oak lessons and BBC Bitesize pages). `pnpm content:check-links --coverage` prints the numbers.
- Links point at the right level (GCSE or A-Level) and the student's board where the page is
  board-specific.
- **Oak links go to the pupil lesson page** (owner decision, 2026-11-26): the page made for
  students, with the lesson video and no sign-in, not Oak's teacher page. The link is the pupil
  lesson's overview page (`/pupils/lessons/<lesson>/overview`). The validator refuses an Oak
  teacher page (`/teachers/...`) unless the link is marked `no_pupil_page` (the lesson has no
  pupil page). BBC Bitesize and Isaac pages are already made for students.
  All 90 Oak links (84 lessons) were switched and re-read on 2026-11-26; every lesson had a pupil
  page, so none is marked `no_pupil_page`.

### Read aloud and reading comfort

- **Read aloud** button on questions, answers, explanations and flashcards, using the device's own
  speech voices (Web Speech API), preferring voices that run on the device (`localService`); where
  only online voices exist the setting explains that the device's speech service may process the
  text, and it stays off by default. Speed control. Maths is read sensibly (for example "x squared").
- **Reading comfort** settings per device: a dyslexia-friendly font (self-hosted, open licence, no
  third-party font service), larger text, more line and letter spacing, and a soft tinted background
  option. These apply across the app and are remembered on the device.
- **Appearance** settings per device (Settings → Appearance, next to Reading comfort; students and
  parents): Theme System (default, follows the device), Light or Dark; Colours Standard or
  Colour-blind friendly (right is blue and wrong is orange instead of green and red, checked for
  deuteranopia, protanopia and tritanopia; icons and words always carry the meaning too);
  Background pattern On (default) or Off. Applied before the first paint, so there is no flash.
  The doodle pattern is our own original art, very faint, and is never shown in high contrast or
  forced colours. Get help follows the theme too (light, dark, colour-blind), with its own calm,
  high-contrast colours (owner, 2026-11-25, W3). The sales site follows the
  device's theme only.

## Screen layout

- **Single screen for doing things** (owner design rule, 2026-11-26; how to apply it: lead ruling,
  same day). On screens where the student does something, the main task fits on one screen
  without scrolling, at 390 × 844 with default text: the question or card, the answer input, and
  the primary button. The primary action is always in view (for example a sticky action bar).
  Secondary detail sits behind a tap (expand, sheet or tab).
  - Covered: the lesson and question player, flashcards (including Explain), the starting test,
    the daily 5-a-day and recall, the map, Plan, the papers chooser, set complete and reward
    moments, and the Me page.
  - Not covered: reading pages (Get help, About, policies, long explanations, parent stats). These
    may scroll.
  - Contained scrollers are allowed (lead ruling, 2026-11-26): a row of chips or badges that
    scrolls sideways, or a list inside a card that scrolls up and down. The page itself never
    scrolls sideways. Sideways rows use scroll snap and an edge fade that shows there is more,
    bring the selected item into view on load, keep every item reachable with Tab (focus scrolls
    it into view), have touch targets of at least 44 px, and show a scrollbar or arrow buttons on
    pointer devices. A scrolling list in a card is a labelled, focusable region.
  - Accessibility wins: at 320 px or 200% text, with a short screen, or with a very long question,
    the page may scroll up and down, and an inner up-and-down scroller gives way to normal page
    scrolling (no scroll inside a scroll). The page must never scroll sideways or clip content.
  - Status: agreed, not yet applied everywhere. Mockups and the current heights are in
    `docs/design/j12/` (AUDIT.md); the proposed e2e check is in `docs/design/j12/SKIN.md`.
