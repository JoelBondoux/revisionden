# Product facts

Tags: #product #rules #limits #defaults

> Maintained page. Short, verified facts about what RevisionDen does. Update it in the same change
> as any code or rule change that alters a fact. Detail: `docs/PRODUCT_RULES.md`.

## Users and accounts

- One parent account per family; signs in with Google or Microsoft. Apple sign-in deferred (needs
  a paid Apple developer membership).
- Each sign-in provider is optional, but at least one must be set up; the welcome page shows only
  the configured ones (`GET /v1/auth/providers`). The owner is starting with Google only.
- Students have no outside account: nickname (2–16 letters, numbers, underscores and single spaces between words, trimmed at the ends), avatar code and
  year group only. Devices linked by a one-time QR token (10 minutes, single use: used up when the device finishes its passkey; reopening before then gets a fresh challenge, E8), then a passkey.
- Passkey set-up (E8, E8b): a failure shows a plain reason (try again, set up a screen lock, unlock instead, open in Chrome, or ask a parent for a new link) and a "Details: <error name> (RD-…)" line; only the error name is reported, as client-error kind `passkey`. Browsers without WebAuthn and in-app browsers (Google app/Lens, webviews, Instagram and similar) get "Open this page in Chrome" with Copy link and an Android intent link before the tap. When the child typed a short code, that card also shows "In Chrome, enter your code again: <code>"; the code is never put in the handed-over URL.
- Nicknames are unique within a family. A family is created the first time a parent signs in.
- Two parents (B3): a family can have two parents with equal control (Parent 1, Parent 2).
  Invite code or link 7 days, single use, hashed, 5 a day; either parent removes the other (access
  ends at once, notice next sign-in); deleting the family needs both when there are two; family
  activity log names parents only by number, important changes pushed to the other parent and
  shown as new in the parent home; log kept 12 months. Migration 0012.
- Sharing invite links (I8, `apps/web/src/pwa/ShareLink.tsx`): the second-parent invite and the
  child's device link show a big "Share link" button that opens the device's own share sheet
  where the browser has one (`navigator.share`), and "Copy link" otherwise or if sharing fails;
  closing the share sheet is not an error. Messages are short and name no child: "Join our family
  on RevisionDen as a parent: <link>" and "Set up RevisionDen on your phone: <link>". The QR code
  and short codes stay for setting up in person.
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
- The daily clean-up (03:17 UTC, production only) also deletes expired link codes, student and parent sessions, passkey
  challenges and sign-in checks (`apps/api/src/cleanup.ts`).
- The link token is redeemed with the family id from the QR code; a wrong family id does not use
  the token up. Tokens and sessions are stored only as hashes.
- Parents can also "Send a link instead": a shared link lasts 24 hours (the QR code 10 minutes),
  with no nickname in the link or message. Each link has an 8-character short code (no
  look-alikes, stored hashed) the child can type at `/link`; code attempts are rate-limited per
  address. Parents can cancel a link (it also stops a set-up already under way), see "Waiting for <nickname>'s device…", and are pushed
  "<nickname>'s device is set up". Parent home lists each child's devices (type, date linked) with
  Remove.
- A student device session lasts 12 hours, then the student unlocks again with the passkey.
  Parents can unlink a device, which ends its session.
- Students unlock on the welcome page ("I'm a student: unlock with my passkey") or at `/unlock`,
  where a student screen sends them when its API call gets 401; they return to the page they were
  on (default `/map`). With no passkey on the device the page says "Ask a parent to link this
  device" and shows no account details. The welcome page (`/`) is the one sign-in page for
  parents and students; the sales site's "Sign in" goes there
  (`decisions/0007-student-passkey-unlock.md`). Implemented in
  `apps/web/src/features/onboarding/StudentUnlock.tsx`.
- A passkey synced to another device (iCloud Keychain, Google Password Manager) unlocks there
  too, as a new device of its own (owner decision: allow, and tell the parents). Each device keeps
  a random marker in local storage (`revisionden.deviceMarker`; the API stores its hash in
  `device_markers`). An unknown browser adds a `devices` row and logs the important family event
  "RevisionDen noticed <nickname>'s passkey being used on a new device", pushed to both parents; at
  most one new device a day per passkey. The day is claimed with one conditional upsert on `passkey_new_device_claims`
  (migration 0027, B7), so two new browsers unlocking at the same moment add one device and one
  alert; claims are cleared after 24 hours. An unlinked device's browser is refused. Devices linked
  before markers are adopted quietly on their first unlock. Implemented in
  `apps/api/src/routes/devices.ts` (`deviceForUnlock`).
- Rate limits per address: 30 a minute on sign-in and device routes, 20 a minute on AI routes.
  Implemented in `apps/api`.

## Subjects

- GCSE: English Language, English Literature, Maths, Statistics, Combined Science, Biology,
  Chemistry, Physics, French, Spanish, German, History, Drama, Film Studies. A-Level: Maths,
  Further Maths, Computer Science, Physics. Implemented in `packages/core/src/onboarding.ts`.
- Exam boards and tiers are picked in the app; "not sure" is allowed and reminded later.
- GCSE Film Studies is offered only by WJEC Eduqas. GCSE Statistics only by AQA and Pearson Edexcel. Boards per subject and tiered GCSEs are listed
  in `docs/PRODUCT_RULES.md` "Onboarding".
- "Not sure" boards and tiers never block onboarding. They show on the finish screen, in Parent
  home ("Things to check: N", parent can set them) and in the student's Settings > My subjects
  (student can only turn Not sure into a value), with a nudge on the student's home until set.
- After onboarding, either parent can add, remove or change a child's subjects in Parent home >
  Subjects (E5; same picker as onboarding, Not sure allowed). Removing keeps the child's answers
  and mastery (only the enrolment goes), so progress comes back if re-added. Subjects with no
  questions yet say "Questions coming soon". Adds, removes and board or tier changes are important
  family log events.
- New children start from a Boy, Girl or Neutral look (Neutral preselected); only the avatar code
  is stored, never a gender. A newly linked device offers "Make it yours" (with "Maybe later").
- Most-used board per subject in England (Ofqual market report 2024 to 2025, share of
  certificates): AQA for GCSE English Language, English Literature, Biology, Chemistry, Physics,
  Combined Science, Drama, French and A-Level Physics; Pearson Edexcel for GCSE Maths, History and
  A-Level Maths, Further Maths; OCR for A-Level Computer Science; WJEC Eduqas only for GCSE Film
  Studies. AI terms: AQA forbids its material in AI-assisted works; Pearson reportedly reserves AI
  training rights (not confirmed); no AI clause found for OCR or WJEC Eduqas. Figures, quotes and
  the recommended build order: `docs/research/board-shares-2026-11.md` (research, 2026-11-25; not
  yet a decision).
- Specialist tools research (2026-11-25, not yet a decision): quick wins are self-hosted and free
  for paid use (KaTeX, MathLive, pint, ChemPy, RDKit, SmilesDrawer, textstat, on-device Web Speech,
  the DfE French required-words list under OGL, and public-domain set texts: all 6 AQA Shakespeare
  plays, all 7 19th-century novels and Animal Farm). Embedded third-party widgets (GeoGebra, Desmos,
  PhET) break the no-third-parties rule unless self-hosted and need commercial licences for a paid
  tier; Mathpix's terms are adults-only. Detail: `docs/research/specialist-tools-2026-11.md`.
- Question generation rules (decision 0010, owner 2026-11-26): batches made only of items from
  owner-approved templates (a `template-approval` check naming the template id and version) with
  their cross-check passed are sampled at 3%, at least 10; every other batch 10%, at least 30
  (`packages/core/src/review-sampling.ts`). Public-domain set texts count as official for
  quotations only, from one fixed edition per text; items from individually approved fact-table
  rows may be batch-sampled; board-neutral physics and chemistry calculations from DfE content
  may be built now; awrt rounding is settled; spreadsheet citations use "sheet, row, cell";
  readability (textstat) warns only, aiming at reading age 13 to 14 (GCSE), 15 to 16 (A-Level).
  Teaching notes (decided 2026-11-26): approved individually until 50 consecutive clean approvals, then batch-sampled (any correction resets the count); Oak lessons published after 1 September 2022 (OGL v3.0) may be adapted as a starting draft only, with Oak's attribution shown and no implied endorsement; earlier Oak lessons and third-party items never used; Oak is never a citation source. In-copyright quotes: with
  the owner's solicitor.
- Question generation research (QG, 2026-11-26; owner decisions in decision 0010, above): four guarantee tiers
  (computed, source-quoted, fact, judgement). Computable or source-quotable share is highest for
  A-Level Maths and Further Maths, A-Level Computer Science, physics, chemistry and French
  vocabulary; English Language, Drama and Film Studies are mostly judgement. The DfE GCSE science
  subject content (Open Government Licence) lists the physics equations (Appendix 1; Higher-tier
  ones shown only by underlining); DfE annex E (September 2025, spreadsheet) has 266 required
  French headwords with English meanings, not the full 1,200 to 1,700 word list, which each board
  publishes itself. Detail, proofs of concept and owner decisions:
  `docs/research/question-generation-2026-11.md`.
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
- Learning from mistakes (F5, 2026-11-25): a wrong Learn mode answer brings a similar question
  (same learning point: the item's `learning_point` tag or its topic; not seen for 7 days) 2 to 4
  questions later, else the same question at the end; one retry per point and 2 per lesson,
  skippable, no penalty, a confidence question (got right before) before each retry, a second
  miss steps down (easier question, "Learn it first" links), lessons end on a success.
  A right answer slower than 2x the expected time (item `expected_seconds`, else flashcard 15 s,
  multiple choice 20, numeric 40, short answer 45, worked maths 120) is shaky. Wrong or shaky
  points go on the review ladder (`review_points`, with misses and a flag: next day, 3 days, 7 days; each right answer on
  time climbs a rung, the 7-day one clears it, a slip restarts; missed on 3 visits it is parked a
  week and flagged "worth a look" for the parent dashboard). Lessons and the 5-a-day open with
  up to 2 warm-ups on due points. Retries count at half weight for mastery. Migration 0026.
- Worth a look together (K11, lead 2026-11-25): parent stats dashboard card listing the topics with
  F5-flagged points (one row per topic, a count, "Learn it first" where checked lessons exist),
  from `GET /v1/students/:id/worth-a-look`. Hidden when empty; never shown to the child. Learning
  point ids are internal, so parents see topic titles only.
- Stats motion (K5, owner 2026-11-26): stat tiles count up and bar charts / progress bars grow
  in once when first in view (700ms ease-out, stagger ≤60ms, all within 1s), and never again on
  that page (a period switch shows values at once; `EnterOnceScope`); none with reduced motion;
  print always shows final values; screen readers get final values only. Parent pages silent; My stats plays
  one soft `ringFill` settle sound when the counts finish. Helpers: `packages/core/src/count-up.ts`,
  `apps/web/src/features/stats/countUp.tsx`. Detail: `docs/PRODUCT_RULES.md`.
- XP per correct answer: flashcard 5, multiple choice 10, short answer or numeric 15, working 20,
  long answer 30; part marks earn part.
- The 14 original rewards keep their ids and avatar items (the 100-day streak unlocks two: crown
  and Alien skin). They are now part of the five-year catalogue (see "Rewards progression").
- XP per correct answer: flashcard 5, multiple choice 10, short answer or numeric 15, worked maths
  20, extended answer 30; part marks earn part.
- Combo bonus (J4, `packages/core/src/xp.ts`): +5 XP per right answer from the 3rd in a row, added
  to that answer's `xpEarned`, so reward XP (levels, chapters) and the daily goal count it and the
  daily reward XP cap still applies. Learn mode: worked out on the server from the student's recent
  answers (`comboBefore`); a wrong or part-marked answer, a Test mode answer or a gap of more than 5
  minutes (`ACTIVE_GAP_MS`, the study-session rule) ends a combo. Starting test (Test mode): no
  combo while answering; at the first `finish` the bonus is added to the answers in order and
  returned as `bestCombo` and `comboBonusXp`. Attempt responses carry `combo` and `comboBonusXp`.
- 14 rewards unlock the 15 locked avatar items: one each, except the 100-day streak, which unlocks
  two (crown and Alien skin). `packages/core/src/rewards.ts`, `avatar.ts`.
- 14 rewards, each unlocking one avatar item: `packages/core/src/rewards.ts`.
- Only `verified` items reach students. Drafts are served only with `SERVE_DRAFT_CONTENT=true` in
  development (never staging or production), with a "DRAFT CONTENT" banner; the dev Worker has it on
  so the family can try the pilot on dev.revisionden.com; quarantined and
  retired items never. Implemented in `packages/core/src/learning.ts` and `apps/api`.
- Starting test per subject: about 5 minutes (300 s, up to 10 questions, one per topic first),
  Test mode; its answers set first mastery. Lessons are Learn mode at feedback level 1.
- Wrong lesson answers become flashcards. Flashcard buttons Again/Hard/Good/Easy = SM-2 quality
  1/3/4/5; each shows when the card comes back. Deck XP is per completed session, not per card: 20 XP for a
  session of 5+ cards (ends when the due queue is empty or at 20 cards), whatever the ratings; at
  most 2 rewarded sessions a day (two reward slots per UK day, unique in the database; a one-deck session only needs that deck done); self-ratings never change mastery (owner, 2026-11-25). Students can add their own cards (up to 300 characters a side); a card with an email, a UK mobile number or a family nickname is refused, as for feedback.
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
  F7: the card turns both ways by tap, Space or Enter without a new attempt; a new card never
  shows its answer while turning; "Explain" steps come only from verified content (worked steps,
  else inline mark scheme, then `back_formula` and conditions, then the answer, then the verified
  `explanation` as "Why: …"), hidden when there are none (`learning_point` is never used). On
  2026-11-26, 89 of 287 marked items had none of these: 75 of 78 flashcards, 13 short answers and
  1 numeric (`gcse-maths-h-n7-0001`).
- Flashcard accessibility (F8b): the flip card has no aria-label; its accessible name is the visible face and the turn hint is in `aria-describedby`. Rating buttons are named by their visible text (for example "Good · 1 day"). `e2e/tests/cards.spec.ts` runs axe on both sides of a card at all three sizes (WCAG 2.5.3, Label in Name).
- Installable PWA. Main nav: five items, Map, Cards, Plan, Papers, then **Me** last (bottom bar
  on phones, side rail from 768px wide). Me shows the student's own avatar (a neutral person icon
  until it loads) and opens `/settings`, "settings and personalisation"; Get help and My progress
  (`/progress`) live there, and Me is marked current on `/settings` and `/progress` (and anything
  under them). Progress is no longer a nav tab (owner, 2026-11-26, W7). The Me page (W9) fits one
  phone screen: avatar, nickname and **Edit my avatar** (E's builder in a sheet; Save, or Cancel
  with a "Throw away your changes?" check; the nav avatar updates at once; the API only checks
  items are unlocked, no parent approval or rate limit), then Get help, My progress, My rewards,
  as button tiles with 2–3 word labels (J15a), and two sub-pages: Look and sound (`/settings/look-and-sound`: reading comfort, appearance,
  effect style, read aloud, sound) and More (`/settings/more`: subjects, reminders, device,
  parents, feedback, policies, about, what your parent can see). A parent on `/settings` gets a
  Parent home tile instead of the avatar header. Items share the bar and
  labels wrap, so they fit 320px with text at 200%. Welcome and lessons hide the nav to keep focus. Only a linked student
  device gets the student nav: elsewhere (signed out, or a parent) About, Policies, Feedback and
  the other app pages show a small header with the logo, Sign in, Policies and About.
- Changing screen (I7, `apps/web/src/layout/RouteChange.tsx` around every route): the new screen
  starts at the top and focus moves to its main heading (or the main area) for screen readers.
  Back and forward put the reader back where they were (waiting up to 5 seconds for a loading
  screen's content); a `#part` link scrolls to that part; a
  change of query on the same screen (a tab, a chosen child) keeps the scroll position. The first
  screen when the app opens is left to the browser.
- The web app loads nothing from third parties (no analytics, fonts or beacons): only its own
  origin and its API host. The deployed smoke test fails otherwise.
- The learning path is a topic map: one hexagon per topic, grouped by unit. States: mastered
  (gold, tick), in progress (violet, fill level shows mastery %), weak spot (orange, pulsing
  glow), locked (grey). Each unit ends in a challenge that unlocks at 80% unit mastery. The Cards
  tab shows how many flashcards are due.
- Map layout (J12b, design C "Your path", owner choice 2026-11-26): subject chips on one line that
  scrolls sideways; one **Today** strip (daily goal, the Next mission row with its Go button, the
  5-a-day row while there is one, and the install row while the device can install); then "Your
  path": a row of unit badges that scrolls sideways, and the chosen unit's card with **all** its
  topics down a path that scrolls inside the card. The page itself never scrolls sideways.
  - The current unit is the one holding the next mission, else the first with an open topic. Its
    path opens on the next mission's topic, else the weakest weak spot, else the first topic in
    progress. Each unit keeps its scroll position while the map is open.
  - The path scrolls inside its card when there are at least 11 rem below it (above the tab bar)
    and the screen is at least 20 rem wide; otherwise (short or narrow screens, big text) the page
    scrolls instead, so there is never a scroll inside a scroll. At 390 × 844 the whole map fits
    above the tab bar (the version footer sits below).
  - A locked unit (no questions yet) says "Questions for <unit> are on their way. It unlocks as
    soon as they're ready." See all opens a sheet of every unit with its progress.
  - Past the daily goal the Today strip says "Goal smashed! <XP> XP" with a star (the bar stays
    full) instead of a fraction like "195 / 50" (J12d, owner, 2026-11-26).
  - The sideways rows (subjects, units) open showing the chosen item whole, moving only as far as
    they must and lining up on an item's edge, so the first item seen is never cut mid-word; near the
    end a little space (at most 40% of the row) may be added after the last item to allow that
    (J12d, `map/hscroll.ts`).
  - Code: `apps/web/src/map/` (`path.ts` rules, `UnitPath.tsx`, `TodayStrip.tsx`, `HScroller.tsx`,
    `InstallRow.tsx`), `apps/web/src/features/daily/DailyRow.tsx`; e2e `e2e/tests/map.spec.ts`.
- Topic map data (F2, `GET /v1/student/map`): units are the top-level topics of the subject's tree,
  leaf topics in specification order. Locked = no item may be served yet; mastered at 80%; weak
  spot = tried and below 60%; otherwise in progress (including not tried). Unit mastery averages
  its open topics. Next mission: weakest weak spot, else first topic not mastered, else review
  the weakest mastered topic (5 minutes). A unit id opens its challenge lesson (all its topics).
  Implemented in `packages/core/src/map.ts`.
- Subjects with no questions yet (F8, RD-MBXKTC): the map defaults to the first enrolled subject
  with questions and answers `status: "coming_soon"` (plus `subjectId` and `subjects` with
  `hasContent` for the switcher) for one with none; 404 `no_subject` only with no subject at all
  or an unknown id. The web shows "Questions for <subject> are on their way." and a switcher.
- Mascot: Pip, an angular geometric fox (orange `#FF7A2F`). Brand violet `#6C47F5`; font Nunito,
  self-hosted (no Google Fonts request). Every text colour pair meets 4.5:1 contrast.
- Works offline for the app shell; API calls are never cached. Pages always come fresh from the
  server when online. The app checks `/version.json` on start, on return to the foreground and
  every 15 minutes and shows "A new version of RevisionDen is ready." with Refresh; an API reply
  that suggests the app is out of date makes it reload by itself once per new build.
- "Add RevisionDen to this device" (I6): a row in the topic map's Today strip (J12b,
  `apps/web/src/map/InstallRow.tsx`), a card with Pip on the parent home, and a button in Settings. Chrome, Edge and Android show the browser's own install prompt on tap;
  iPhone and iPad Safari open a sheet with Share → Add to Home Screen steps (`/install` shows the
  steps for the device in use); browsers that cannot install get no card. Hidden once installed
  and for 30 days after "Not now" (local storage `revisionden.installDismissed`). Implemented in
  `apps/web/src/pwa/InstallCard.tsx`.
- The web app calls the real API on dev and staging (parent session cookie, or the student
  device cookie). MSW mocks with made-up data are used only in local development and tests, and
  must use real API paths (`apps/api/routes.json`). Parents sign in from the welcome page
  (Better Auth) and land on "Who's revising?" (`/family`, `GET /v1/onboarding/family`), or on
  `/onboarding` if they have no children yet. Tapping a child there opens the parent's view
  (the parent home `/parent?student=<id>` with that child chosen), never student screens; each child has "Rewards you set" and
  "Link a device" (product owner, 2026-11-25). Students use only their own linked device. Signed out, any screen shows the sign-in buttons
  and returns to the same page after sign-in. Sign out is on the welcome page and `/family`. The topic map and Cards badge wait for F2's
  `GET /v1/student/map` and `GET /v1/student/cards/due`.
- Every error with a reference code has a one-tap "Send error report" button: an anonymous report
  (code, screen and API path with ids masked, status, build, browser family, online, time) is
  stored in `error_reports` for 90 days and listed for the operator at `/admin/feedback` (Error
  reports), `GET /v1/admin/error-reports` and `scripts/error-reports.mjs`. Privacy notice 1.2.
- Every "Something went wrong" shows a reference code like `RD-7K2M9Q` (no I, L, O or U), also
  in the API logs with no personal data, so a family can report it. Implemented in
  `packages/core/src/error-ref.ts`, `apps/api/src/errors.ts`, `apps/web/src/api/client.ts`.
- Parent onboarding is at `/onboarding` (family list, add a child, school report, link a device,
  finish); the student scans the QR code to `/link` and sets up a passkey.
- Avatars are drawn as layered SVG from the avatar code (`apps/web/src/features/avatar`).
- Avatar builder layout (J9): the preview always stays in view. Under 600px of builder width
  (phones, the sheet) it is pinned on top and shrinks once the options scroll. At 600px or more
  it is a sticky column on the left. Arrow-key tabs; a gentle pop on each change, off with
  reduced motion. Switching tabs after scrolling brings the options back to just under the
  pinned preview (narrow) or level with the sticky column (wide), smoothly unless reduced motion is
  on (J9b). `apps/web/src/features/avatar/AvatarBuilder.tsx`, `avatar.css`.

## Operator console (AppDeck)

- The owner runs RevisionDen from AppDeck Admin through a signed operator bridge at `/operator/appdeck`
  (no database access for AppDeck). Spec and wire format: `docs/OPERATOR_CONSOLE.md`.
- Requests are signed with HMAC-SHA256 (tag `appdeck-revisionden-operator-v1`) using
  `APPDECK_OPERATOR_SHARED_SECRET` (32+ characters, one per environment); without it the bridge
  answers 503. Refused outside 5 minutes; request ids used once (kept 1 day; a retried change gets the
  first answer); 120 requests a minute per address. Implemented in
  `packages/core/src/operator-signature.ts` and `apps/api/src/operator/bridge.ts`.
- Roles from AppDeck: Agent (support) and Manager (also money and data), enforced by the API.
- AppDeck reads (O2): health, overview, family search by exact parent email or family id only
  (POST body, no browsing names), family detail (parents' emails, children as nickname + year
  group only, flags), tickets (a student's ticket text is never sent), error-report groups (and
  an exact lookup of one RD code, `error-reports?code=`),
  content reports, audit log. `apps/api/src/operator/reads.ts`; shapes in
  `packages/core/src/operator-schemas.ts`.
- AppDeck actions (O3, all Agent): internal family notes (≤2000, never shown to the family, in its
  export), ticket replies (≤5000, shown under the message in the sender's app without the
  operator's email), ticket status, confirm bug and duplicate (same L7 rules and rewards, shared
  `confirmFeedback` and `setFeedbackStatus` in `apps/api/src/feedback/routes.ts`).
- Data requests (O3b): an Agent logs an emailed export or deletion request (due one calendar
  month later, `dataRequestDueAt` in core); a Manager marks it handled. Handling a deletion runs
  `deleteFamilies` only for a one-parent family (two parents: 409 `needs_both_parents`, both
  confirm in the app). Records kept 2 years. Trial and free-place routes answer 503
  `payments_not_ready` until workstream $.
- Family tags (O6): Managers create, edit and retire tags (name ≤40, colour, description ≤200,
  effects: beta programme, early access, complimentary Premium, exclude from metrics); Agents add
  and remove them and list a tag's families (the only list view). Retired tags have no effects.
  Families see only the beta programme: a "Beta" badge on the parent home and "Leave the beta
  programme" (`/v1/family/programmes`). `effectsForFamily` gives other code a family's effects.
- Discount codes (O5): Managers create (6–16 letters and digits, any case, stored upper case;
  percent 1–100 or a fixed amount in pence; months or forever; optional last UK day and maximum
  uses) and disable them in AppDeck; Agents can see them. One active code per family; never with
  a free school meals place. Checkout (workstream $) applies them with `checkCodeForFamily`. A use stays counted after the
  family is deleted (the redemption keeps no family).
- Complaints (O4): a parent makes one at `/complaints` ("Make a complaint" on the parent home;
  3 a day per family; summary 3–500 characters with no email, phone or child nickname) or support
  logs an emailed one. Acknowledge by the end of the 2nd UK working day (weekends and England and
  Wales bank holidays skipped, list from gov.uk through 2028), aim to resolve within 14 days
  (`packages/core/src/complaints.ts`). Agents acknowledge, reply and resolve; Managers escalate.
  The family sees replies and the outcome (and, for personal data, that they can complain to the
  ICO; contact details await the owner's check), never staff names. Kept 12 months after
  resolved; deleted with the family; in the export. Deadlines are "we aim to" (decision 0006).
- Only parents complain. A student uses "Ask a parent to raise something" (Settings,
  `/ask-a-parent`): a topic (`COMPLAINT_REQUEST_TOPICS`) and an optional note (≤300, no email or
  phone), 3 a day; both parents see it on `/complaints` and can start a complaint pre-filled with
  the topic (not the note) or dismiss it. Never sent to AppDeck; deleted after 90 days.
- Escalation: a complaint not resolved within 5 working days of acknowledgement can be escalated
  by the parent ("Ask for a manager to review") or a Manager; AppDeck shows `escalationFrom` and
  overdue flags.
- Every operator read of a family and every action goes in `operator_audit_log`, kept 2 years
  (data retention policy 1.7); the scheduled clean-up deletes older entries.

## Content

- Content is JSON in `content/`, checked by `pnpm content:validate` (schemas in
  `content/schemas/`). Every item has `source_ref` and `checked_by`; every topic-tree leaf has a
  specification reference; trees are at most 3 levels deep. Detail: `docs/CONTENT_PLAN.md`.
- No content string may hold a control character (U+0000 to U+001F except tab and newline):
  `pnpm content:validate` refuses them with the field path, because Postgres refuses `\u0000` in
  jsonb (22P05) and the content sync fails. Check records written by the pipeline
  (`withCheck` in `scripts/verify/record.mjs`) have them replaced by a space first.
- Every maths answer (numeric and worked maths items, and model solutions) is verified by the
  maths engine before content can merge.
- Every item, topic leaf, mark scheme and diagram carries official citations and a verification
  record (`docs/VERIFICATION.md`); verified content needs quotes and every pipeline check, and is
  immutable (edits create a new version). `pnpm content:validate --audit <id>` prints the audit trail.
- Diagrams are SVG drawn by code from verified data; no AI-generated or raster teaching images.
- Items may carry `learning_point` (finer skill id; at least 3 items per learning point, for
  similar-question retries) and `expected_seconds` (5 to 900; slower than twice it is shaky).
- Every item needs an "Explain" walkthrough (F7, #156; lead ruling for S3-N2, 2026-11-26): an
  `explanation`, plus the working for a calculation (`steps` on worked_maths, otherwise written
  out in the explanation, as the schema allows `steps` only on worked_maths). Rule in
  `docs/CONTENT_RUN_1MA1.md`; validation does not enforce it yet.
- Pilot: GCSE Maths Higher, Pearson Edexcel 1MA1 (content references N1 to S6). Every pilot
  citation has a verbatim quote from the 1MA1 specification Issue 2 (or, for the quadratic
  formula, the DfE subject content DFE-00233-2013), with page and SHA-256. All pilot content is
  still `draft`. Pipeline run 2026-11-25 (S2, `docs/CONTENT_RUN_1MA1.md`): every step
  recorded; blind answer and adversarial review by Gemini (`gemini-2.5-pro`). All 11 items pass
  steps 1 to 6 and wait for the owner (G9 under decision 0008 and the A6 proof with individual
  approval; A18-0002 after it was compared by formula, #111). The topic tree's 2 near matches (A22,
  A25) were confirmed by the owner. Owner's review steps: `docs/REVIEW_GUIDE.md`.
- Citation `supports` names only what the quote itself backs. A specification quote backs the
  question being in scope (`question`, `topic`); maths answers are backed by the maths engine,
  not by a citation. Sourcing record: `docs/sourcing/gcse-maths-1ma1-pilot.md`.
- Maths templates (T1, `docs/TEMPLATES.md`): items can be generated by the maths engine from a
  template (`services/maths/app/templates/`), recorded as `template: {id, version, seed}`. The
  same seed always remakes the same item; every instance is cross-checked (content checks plus
  an independent recheck of the question text) and the build fails on any disagreement. Built
  with `pnpm content:templates` into `content/items/gcse-maths-higher/templated/` (never edited by
  hand; pytest checks they match a fresh generation). A rebuild keeps unchanged items' review
  records. They are ordinary `draft` items in the same pipeline and review queue. Template
  citations reuse quotes already used in the same topic. Pilot (2026-11-26): 5 templates (A4,
  A17, A19, N12, N9), 5 items each; T1c added A18, A25, N10, N5 and A7 (50 items in all). Fresh numbers per student at run time is not built yet.

## Maths engine

- `services/maths`: SymPy, no AI. `POST /check-working` returns the 0-based index of the first
  line of working that does not follow from the previous line, and whether the final answer is
  correct. Input is limited to safe maths (single letters, a few functions, 200 characters).
- The engine reads everyday notation before parsing (T2, `services/maths/app/notation.py`, same
  rules as `packages/core/src/answer-normalise.ts`): × · ⋅ and x between numbers are times,
  superscripts are powers, the unicode minus and dashes are minus, and thousands separators are
  dropped only between groups of exactly three digits. Answer forms (`app/forms.py`):
  `fraction`, `simplest_fraction`, `improper_fraction` (lowest terms, never a mixed number;
  the engine reads no mixed numbers), `standard_form`, `index_form` (one shared `answer.form`
  enum with S2e), checked on how the answer is
  written as well as its value (lead ruling 2026-11-26: an unsimplified fraction is wrong when
  simplest form is asked for; ordinary form is wrong when standard form is asked for).
- Lines of working are read exactly: decimals become fractions (`1.6` is 16/10), so steps with
  decimals are compared without floating-point rounding (T1, 2026-11-26).
- Answer format (S3-A rulings, rules in `packages/core/src/answer-format.ts`): an answer may declare
  `answer.subject` (`t`, `f^-1(x)`), so "t = RHS" counts as RHS in marking, the engine and the
  blind check. Rounded numeric answers set `decimal_places` or `significant_figures` (not
  `tolerance`): only the value rounded half up and written to that accuracy is right (28.274 and
  28.270 are wrong for 2 dp). Validation requires the field whenever the question asks for
  the answer itself to be rounded ("give your answer correct to…", "round … to…"), not for
  accuracy words about the working or a given measurement ("by rounding each number to 1
  significant figure, estimate…").
- Numeric answers accept a UK thousands separator: a space (also thin or non-breaking) or a comma
  between groups of exactly three digits (`38 700`, `38,700`); `3 87` is wrong, not 387 (S2, rule
  in PRODUCT_RULES "Learning loop").
- Numeric answers accept the unicode minus, mixed numbers (`1 1/3` = 4/3) and the item's own unit
  typed with the number (`15 m`, `£9600`, `100p`, `28.3 cm²`); a different unit is wrong (S2,
  rule in PRODUCT_RULES "Learning loop").
- Numeric items whose question asks for an answer form set `answer.form`: `fraction` (no decimals,
  so 0.375 is wrong for 3/8), `simplest_fraction` (69/99 wrong for 23/33), `improper_fraction`
  (lowest terms, never a mixed number; no form takes a mixed number), `standard_form` or
  `index_form` (2³ × 3² × 5, not 360); validation requires it (S2; the maths engine reads the same
  field for worked maths, T2; rule in PRODUCT_RULES "Learning loop"). Area and volume units may be
  typed in words (8 square metres, cm³, cubic centimetres).
- Numeric answers read standard form (`6.4 × 10^8`, `6.4x10⁸`, `6.4e8`) by value; a standard form
  answer key needs proper standard form back (1 ≤ a < 10), and the validator sends the engine the
  plain value (S2, rule in PRODUCT_RULES "Learning loop").
- Typed short answers (F6, `packages/core/src/answer-normalise.ts`; rules in PRODUCT_RULES
  "Learning loop"): spaces, case, minus signs, multiply and divide signs, superscripts, ≤/≥ and √
  are normalised, so content lists one written form. `answer.any_order: true` also accepts
  commuted products and sums, reordered lists and swapped equation sides (never coordinates or
  inequalities); `answer.units` lists optional units. A multiply sign before a sign is kept
  (`3n × -2` is not `3n - 2`). The maths engine accepts a solved value in other letters (`x = 2a`,
  and `a = x` either way round). Repeated alternatives on a final line count once, and a line
  with more than 64 ways to read it (`MAX_READINGS` in `services/maths/app/working.py`) is
  marked wrong, so a long run of `a = x` cannot tie up the engine (#151).

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
  The reminder cron runs every 30 minutes from 06:30 to 20:30 UTC in production only, and does nothing (and does not open the database) until the VAPID keys are set.
- A reminder goes at the first check at or after its set time (up to 30 minutes late). If no
  later check that day falls outside quiet hours (for example 20:45 when quiet hours start at
  21:00), it is sent at the day's last check outside quiet hours instead, so no reminder time is
  ever skipped (`apps/api/src/notifications/ticks.ts`, `dueReminders` in `schedule.ts`).
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
  checked before every call; every billed attempt counts. Up to 3 attempts per call. Families
  never see money for AI (K9, owner 2026-11-25): the parent dashboard shows an "AI marking
  allowance" as a percentage used and "Resets on 1 <next month>" (used up at 100%). No money in
  any family-facing API response or the family export (`allowanceUsedPercent` instead); the
  used-up message is "You've used this month's AI marking allowance. It resets on 1 <month>.".
  Policies: ai-and-marking 1.1, acceptable-use 1.2. The cost figures stay operator-only.
- Short answers: rules first (accepted answers and official mark-point wording, not when the
  answer contains a negation), then Claude Haiku 5.5 only for the remaining mark points, citing
  each point and quoting the student's words. Unsure → "Check with your teacher", never a guess.
- Requests with the student's nickname, ids, avatar code, year group, an email or a phone number
  are refused before sending. Gateway logs keep no prompt or answer.
- Implemented in `apps/api/src/ai/`.

## Versions and releases

- Format `xx.xx.xxx`; started `00.01.000`; every push to `main` bumps the patch automatically.

## Hosting

- Domain `revisionden.com` is registered with Cloudflare (2026-11-24). Hosts (decision 0005,
  2026-11-25): `revisionden.com` is the public sales site (`www.` redirects to it, staging copy on
  `www-staging.`); `app.revisionden.com` and `api.revisionden.com` are the production app and API;
  `staging.` and `api-staging.` (staging), `dev.` and `api-dev.` (development).
- Public site (`apps/www`, workstream M): static pages with no client scripts and no third-party
  requests (self-hosted fonts, strict content security policy). Workers `revisionden-www` and
  `revisionden-www-staging`. Its policies and design tokens are read from `docs/legal` and the web
  app at build time. "Sign in" and "Start free" go to `app.revisionden.com` (staging: `staging.`).
  Until `WWW_LAUNCHED=true` it says the app is in private testing. Pages: home, how it works,
  pricing (planned prices parsed from `docs/PRICING.md`, "Premium, coming soon", nothing charged),
  for young people, help and contact, about (operator name from `VITE_OPERATOR_NAME`) and every
  policy at `/policies/<name>`, with "Draft: not yet in force, being reviewed before launch." while
  `VITE_POLICY_EFFECTIVE_DATE` is unset.
  Images: an Open Graph card (`og.png`, 1200×630, used by every page's `og:image`) and an Apple
  touch icon (180×180), drawn from Pip's shapes and the arena colours. They are committed in
  `apps/www/public` and remade by hand with `node apps/www/scripts/make-images.mjs` after an art
  change; original art only, no stock photos or AI-generated images.
  Links use the app's J7 styles (buttons, tiles, chips, bold inline links), never plain underlined
  text (owner, 2026-11-25). Light or dark follows the device only (no switch), with the app's dark
  theme colours. Behind every page sits the app's doodle tile (`apps/web/src/design/doodle-scatter.svg`,
  read at build time and served as `/doodle-scatter.svg`, 1080px, 7% ink), always on with no switch,
  hidden for high contrast and forced colours.
- Production passkeys use the RP ID `revisionden.com`; OAuth callbacks are on the API host, so the
  move to `app.` needed no change in Google or Microsoft. Dev and staging passkeys use their own
  hosts (`dev.revisionden.com`, `staging.revisionden.com`), so they work only there.
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
  then (dev and staging only) loads `content/` with `content:sync`, then the API, then the web
  app, then checks `/health` shows the new version. Production content is not synced by deploys.
- `GET /health` always answers with the version: `ok` (200) when configured, `misconfigured`
  (503) while a required secret is missing. Dev and staging deploys accept `misconfigured`;
  production does not.
- The app shows its version in a small footer on every page (links to About). Outside the live app the footer also names the environment and the short commit, e.g. "(Development, ef86a9a)", so testers can tell builds apart; the live app never shows the commit.

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
- Hints (`hint`, shown by the "Need a clue?" button) nudge toward the method and never contain the
  item's final answer: `pnpm content:validate` refuses one that does (text, option or flashcard back,
  or a number equal to a numeric answer within 0.5% that the question does not show). Rule in
  `scripts/content/hint-check.mjs`, described in `docs/VERIFICATION.md` ("Hints").
- Extended answers: blind marking replaces the blind answer (three exemplars, top, middle and low,
  marked by a second provider without the intended levels; all three must match exactly), and
  every one needs individual human approval; review batches always include them.
- Fact-check stage 4b (decision 0009): items listing `facts` need, per fact, an official citation
  or a maths engine proof plus a matching blind statement by a third provider (OpenAI, judged by
  Gemini). Failing facts keep `needs_human_approval`. `pnpm content:model-check --fact-check openai`.
  Engine fact proofs: `identity`, `transformation`, `implication`, `sign_change`, `parallel`,
  `trig_value`, `graph_measure` (`services/maths/app/facts.py`). The judge compares meaning, not
  wording; `pnpm evals fact-judge` must refuse every different-fact pair.
- Maths flashcards with `back_formula` are blind-answered by formula: the maths engine compares
  the formula (any equivalent form) and every listed condition (e.g. `a ≠ 0`) must be stated.
- Blind answer must come from a different provider from the writer (Claude by default) and be
  highly confident; any adversarial-review problem fails the item. Real models never run in
  tests or CI.
- Exact checks: units, chemical equation balancing and equation-sheet lookups, for facts named
  in an item's `exact` block; equation sheets live in `content/equation-sheets/`.
- Review queue at `/review` for parent accounts given a reviewer role (subject-specialist,
  content-lead, parent-reviewer) in `reviewer_roles`; decisions store the role only. Batch
  samples: 10% of the batch, at least 30, plus every item needing approval; seed recorded; one
  confirmed error fails the batch and re-checks the batch, writer prompt and source.
- A content lead creates a batch on `/review` with "Create batch from draft items": every draft
  whose synced snapshot (`items.review_snapshot`, full content record plus mark scheme) has all
  automated checks passed and is not already in an open or passed batch (an item whose fact-check
  failed goes in for individual review). Items from a failed batch wait until the recheck is done and
  steps 3 to 5 have re-run since the failure. The batch page shows
  hint, mark scheme, exemplars and checks.
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
- Reward XP: answer XP and completed flashcard-session XP count; nothing from 22:00 to 05:59 UK time; at most 300 XP a UK day
  (`packages/core/src/reward-xp.ts`). Flashcards alone give at most 40 XP a day (about 10,000 a
  year), slower than the curve's 15,000, so pacing holds. Sessions: `flashcard_sessions` table.
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
- Hidden tracks and secrets (R7): Bug Hunter steps at 1, 2, 3, 5, 8, 12, 20 confirmed bugs
  (`confirmedBugs` from L's `confirmedBugCount`; L's bug reward XP counts for levels, not
  chapters); 24 secret achievements shown as
  "???" until earned, with hints on 9; stats in `packages/core/src/secret-stats.ts`. New reward
  item kind `effect` (glitch); new avatar item magnifier (held item, appended).
  They are also saved, once each, by an answer (`POST /v1/student/learn/attempts`) and a finished
  flashcard session (`.../sessions/:id/finish`): both return `newlyEarned` (`saveNewRewards`), and
  the lesson, Cards screen and starting-test results show "New reward: …" with the reward sound
  (F4, 2026-11-25). The starting test keeps quiet until its results screen.
- New avatar items: chapter finale tops (chapter hoodie, bomber jacket, GCSE finisher jacket,
  sixth-form coat, A-Level finisher jacket), rooftop scene, and the Frost Fest drop (bobble hat,
  paper lantern, frosty night scene). Always appended to a layer so saved avatar codes still work.

## Statistics dashboards

- Student "My stats" (`/progress`, from "My progress" on the Me page) and a parent stats dashboard, both read-only, built
  from data already held. Periods: week (Mon–Sun), term, school year; family time zone.
- Active study time: time between answers; a gap over 5 minutes ends the session and is not
  counted; time past the daily cap is not counted. Accuracy: correct ÷ marked answers (part marks
  as fractions; unmarked left out). Subject mastery: average of its topic mastery scores.
- Student view never uses red or "worse" wording; drops are shown to the parent. Empty panels say
  "Not set up yet", never zeros. PDF export is made in the browser with nicknames only.
- Terms until real dates are entered: autumn 1 Sep–31 Dec, spring 1 Jan–31 Mar, summer
  1 Apr–31 Aug; the school year is 1 Sep–31 Aug. Goal lines: 50 XP a day (Week), 250 XP a week
  (Term). Time past the student's daily limit is not counted; healthy habits count days at the limit.
- Subject mastery averages practised topics; change is replayed from marked answers (period start
  for the student, 4 weeks for the parent). Healthy habits are for this week; quiet hours are the
  reminder quiet hours. A rest day is a finished day with no study at all: answers and flashcard
  reviews both count as study.
- Level bar and parent-set rewards come from the rewards progression (same numbers as the Rewards
  page), read with the read-only `rewardsProgress`: it counts earned-but-unseen rewards and saves
  nothing, so the stats pages and the parent's parent-rewards view never use up the student's
  "New!" rewards (the student's Rewards page, answers and flashcard sessions save and announce them). Plan, school report effort and predicted grade panels show "Not set up yet"
  (adapters in `apps/api/src/stats/adapters.ts`) until those features land; predicted grades wait
  for verified grade boundaries.
- Target grades (K8, owner decision 2026-11-25): two per subject, both goals to reach for. The
  parent's target is set or cleared by either parent on the parent stats dashboard (latest wins,
  logged as important); the child's own target is set or cleared by the child on My stats (not
  logged). Each side sees both, with encouraging wording and no red when they differ. Only grades
  on a cited scale: GCSE Maths Edexcel 1MA1 (higher 9–3 and U, foundation 5–1 and U, 9–1 and U
  with no tier chosen); every other subject and board says "not available yet". Changing the
  board or tier (parent or child, E3) clears either target that is not on the new scale.
  `enrolments.parent_target_grade` and `student_target_grade` (migration 0017). Detail:
  `docs/PRODUCT_RULES.md` (Statistics dashboards, Target grades).
- Parent stats dashboard rewards (K10, owner 2026-11-25): all parent-set rewards with progress
  bars, and add, edit and remove (with a confirm step) on the dashboard, through R's editor
  (`ParentRewardForm`) and routes; empty state "No rewards yet" and "Add a reward".
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
  `policy_acceptances`) on a "Before you start" page that shows each policy's plain-English
  bullets as cards (word for word, from the policy files; 4 chosen ones first, then "Show all N
  points") with the full text behind "Show the
  details"; a changed version shows a "We've updated" prompt listing, per changed policy, its new version and
  only the Changes lines newer than the version that parent accepted (plus a link to the policy;
  a policy never accepted goes through "Before you start" instead): "I've read the changes" stores the new
  versions for that parent (each parent for themselves); closing it hides it on that device for 24
  hours for those versions only (`revisionden.policyNotice`). A newly linked student
  device shows the young people's notice once (`revisionden.youngPeopleNotice` in local storage).
- The young people's notice has a friendly view built from the same file: 6 short-version cards,
  2 to 4 key points per part always visible, "Read more" and "Expand all", original icons and Pip;
  motion off under reduced motion. Format rules in `docs/LEGAL.md` (Friendly view).

## Sound

- Original Web Audio sounds, no files. Header quick mute and Settings (on/off, volume, tap sounds
  off by default), per device; follows the iOS silent switch where possible. No correct/wrong
  sounds in Test mode before submit. Sound is never the only signal. Workstream U.
- Style sounds and haptics (U6): every animation fires a feedback event (15: buttonPress, cardFlip,
  correct, wrong, combo, xpTick, ringFill, rewardWobble, rewardOpen, rewardUnlock, setComplete,
  levelUp, homeEnter, nodePop, locked) that plays the active effect style's synthesised sound plus a vibration. Packs: Doodle
  Diary (default, owner-approved 2026-11-26), then the unlockable Sticker Book, Pop Burst,
  Starlight, Comic Pop, Garden Grow and Pixel Arcade (U6c); unknown styles use the default.
  Default is one value, `DEFAULT_STYLE` in `feedback/styles.ts`. Square waves
  only in Comic Pop and Pixel Arcade (low-passed at 2800 Hz); "wrong" soft in every style. Vibration switch on by
  default and independent of mute; no vibration on iPhone/iPad browsers (no Vibration API).
  Throttled: ticks and map nodes 70 ms, ring fill 90 ms, ≤10 sounds/s, buzzes ≥100 ms apart and ≤4/s. Reduced motion: half
  loudness, shorter buzzes. `apps/web/src/features/sound/feedback/`; `HapticsDriver` lets a native
  wrapper add real haptics later.
- Reward sounds scale with rarity (common, rare, epic, legendary; 4+ variations each, no repeat
  in a row); milestone ladders and levels climb in pitch and fullness; one sound for several
  rewards at once; legendary at most 3 s and skippable (owner, 2026-11-25; U4).
- Combo chime (U5): each right answer in a row plays the correct chime a whole tone higher, up to
  6 steps (an octave); the first right answer is the plain chime, and part marks rise too. Wrong
  never changes. `PlayOptions.step` in `apps/web/src/features/sound/engine.ts`.
- Reward sound details (U4, `apps/web/src/features/sound/rewardSounds.ts`, `rewardBank.ts`): tier
  = the reward's rarity, except prestige stars always play legendary (prestige 1 to 3 are epic in
  the catalogue). Ladder step = position in its milestone ladder; level step = level ÷ 10. Each
  step is 1.5 semitones higher (8 steps = an octave) and adds one harmony note (up to 4). Voice per
  chapter id (`chapter-<n>-…`); finisher fanfares for the chapter rewards that need
  `gcseFinished` or `aLevelFinished`. Biggest = tier, then finisher, then step. Played on the
  Rewards screen, after an answer and after a flashcard session for `newlyEarned`; a tap or key press skips legendary.
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
- Settled in J1 (`apps/web/src/features/juice/logic.ts`): stars for a set are 3 for all right, 2 for at
  least 60% right (3–4 of 5), otherwise 1. A burst is about 20 particles, capped at 24; confetti is
  capped at 40 pieces. The combo badge shows from 2 in a row. The CTA pulse takes 1.6 s (well under 3
  flashes a second). Reduced motion removes particles, confetti, float-ups, shakes and pulsing; combo,
  stars and XP still show as text. Arena colours live in `apps/web/src/design/tokens.ts` (`--arena-*`).
- Settled in J5: light-theme motion lives in `apps/web/src/design/motion.css` and applies only to
  the topic map, rewards and stats (parent area, policies and settings stay calm). The map's Next
  mission button is the pulsing main call to action. Reward reveals show the tier, the items and the
  reason from the reward's one catalogue target ("For: 7-day streak"); epic and legendary add a
  particle burst, legendary a shine. No reason is shown for a reward missing from the catalogue.
- Settled in J2/J3: lessons, the starting test and flashcard review use the arena. Set complete's
  Next mission goes to the map (`/map`, the Today strip's Next mission row). "Or take a break. Your streak is safe for
  today." shows when today's daily goal is met (`progress.goalMet`). The "daily cap" for "See you
  tomorrow" is the daily reward XP cap (`DAILY_REWARD_XP_CAP`, 300 XP today), confirmed by the lead
  on 2026-11-25 for now: the lesson only knows XP, not study minutes.

- Settled in J7 (owner request, 2026-11-25): no plain underlined text links. Navigation uses the
  link components in `apps/web/src/components/links.tsx` (LinkButton, LinkTile, LinkChip; TextLink
  only inside sentences and policy prose: bold, coloured, a soft bar, underline on hover). A guard
  test, `apps/web/src/components/noTextLinks.test.ts`, keeps it that way across the whole web app (no exclusions since 2026-11-25).
- Link tiles reflow (J11, WCAG 1.4.4 and 1.4.10): `LinkTile` may shrink (`min-width: 0`,
  `max-width: 100%`) and wraps its text anywhere (`overflow-wrap: anywhere`), so tile lists fit a
  320px screen with text at 200%. The e2e test "the policies list fits a 320px screen with text at
  200%" (`e2e/tests/pages.spec.ts`, /legal) checks there is no sideways scroll and no tile wider than
  320px. The version footer's reflow is G's (#224).
- Button tiles and page transitions (J15a, owner request 2026-11-26): parent home and Policies
  show their links as `ButtonTile`s in a grid (two to a row on phones): a big icon and a 2–3 word
  label, no helper sentence (Policies add who each is for as a badge). Parent home labels: Stats
  dashboard, Children, Family feedback, Complaints, Your data, App settings, Policies, Get help, and
  per child Rewards you set, Reminder times, Subjects. Each effect style has its own tile look, and
  opening a page from a tile plays the style's page transition (350ms at most, reversed on Back,
  never blocking taps). None for Get help or with reduced motion. Me (`/settings`) adopts the tiles
  with W9 (W owns the layout). See `docs/GAME_FEEL.md` (Links; Page transitions).
- Single screen for doing things (owner design rule, 2026-11-26; lead ruling on scope): at 390 × 844
  with default text, interactive screens (lesson, flashcards and Explain, starting test, 5-a-day and
  recall, map, Plan, papers chooser, set complete and rewards moments, Me page) show the main task
  and the primary button without scrolling, with the primary action always in view. Reading pages
  (Get help, About, policies, long explanations, parent stats) may scroll. At 320 px or 200% text,
  vertical scrolling is allowed, but never page sideways scrolling or clipped content. Contained scrollers are allowed (lead ruling): a sideways chip or badge row (snap, edge fade, Tab reaches every item, 44 px targets) or a labelled, focusable list scrolling inside a card; at 320 px, 200% text or on short screens, the inner vertical scroll gives way to page scrolling. Agreed, not yet
  applied everywhere: see `docs/PRODUCT_RULES.md` (Screen layout) and `docs/design/j12/`.
- One look (J12, proposed, owner choice pending): the owner wants one consistent style across the
  student app instead of the current mix of doodle and default. J12's proposal: Doodle Diary is
  the app's base skin for every shared component, body text stays Nunito (the hand font is for
  headings only), and the unlockable styles change effects, sounds and accents only. Mockups in
  `docs/design/j12/SKIN.md`.
- Dev style tester (J12c, owner request 2026-11-26): on the dev environment only, Settings →
  Effect style offers "Tester: try any style" (all seven styles, Light/Dark, Standard/Colour-blind)
  marked "Dev only: doesn't unlock anything for real". Turned on by the API alone: `testerStyles`
  in `GET /v1/student/rewards/effect-styles` only when `ENVIRONMENT=development` and
  `STYLE_TESTER=true` (dev env in `apps/api/wrangler.toml`; never staging or production, config
  tested). The tried style is saved on the device as `revisionden.effectStyleTester`, separate from
  the real choice, ignored unless the server sends the list, and cleared by "Reset to my unlocked
  style". It grants no reward and changes no unlock.

## Exam practice (planned)

- Timed papers sat in real time (exam conditions or practice), each question timed, all marked at
  the end. Pacing target per question = its marks × (official duration ÷ total marks); flags at
  1.5× slow and 0.5× rushed with marks lost. Board-style papers from our own verified items first;
  official past papers only as links to the board's site (never copied). Detail:
  `docs/EXAM_PRACTICE.md`. Workstream X (queued).

## Bug Hunter and secret achievements (planned)

- Bug icon on every screen opens the bug report sheet (student app: in the top row beside Get help and sound; parent screens, `/parent…` and `/family…`: a top row of its own; other focused and public screens: a corner button, with room below the page). A student's bug confirmed by the operator:
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

## Daily limit, two parents, hidden tracks (owner, 2026-11-25; planned)

- Daily limit in active study minutes: defaults GCSE 60/90 (school day/other), A-Level 90/120;
  ceilings GCSE 2h/3h, A-Level 2.5h/3.5h; +30 in exam season (6 weeks before the first exam to the
  last) with parent consent. Parents set 15 min to 6 h per day type; the app only suggests, at most
  weekly (+10 at most fortnightly when the limit is reached on 4 of 14 days with steady late
  accuracy; −10 for one tiredness sign, −15 for two or more). No XP, rewards or streak credit past
  the limit; progress responses carry `dailyLimit`, and set complete says "See you tomorrow" when
  it is reached (300 XP cap kept as a safety net). Confirmed by the owner (2026-11-25): school days
  are Mon–Fri with holidays counted as school days until dates exist; "kept going" means reaching
  the limit; "stopped part-way" means a starting test unfinished for over an hour; parents set
  15 min to 6 h. Either parent can change it (latest change wins); saved limits and accepted
  suggestions are logged for the other parent. Implemented (K7): `packages/core/src/daily-limit.ts`, `apps/api/src/daily-limit/`,
  `daily_limits` table. Detail: `docs/PRODUCT_RULES.md` (Daily limit).
- Two parent accounts with equal control; second invited by link or code (7 days); activity log
  ("Parent 1/2"); both confirm whole-family deletion.
- Hidden tracks besides Bug Hunter (built R7b): Fact Checker (1, 2, 3, 5, 8), Comeback Kid (1, 3,
  5, 10, 20, 35), Explorer (1 to 7 kinds of practice), Planner (1, 4, 8, 16, 30), Pace Setter (1, 3,
  6, 10), Perfectionist (1, 5, 15, 30, 60, 100). Each is invisible until its first step. Only
  Comeback Kid and part of Explorer have data today; the others count 0 until their records exist
  (`docs/REWARDS.md`, `packages/core/src/track-stats.ts`).

## Titles (owner, 2026-11-25; built R8) and Get help (built, workstream W)

- Two-part titles (built R8): 120 first words and 120 last words, each unlocked by one reward
  (levels, chapters, milestones, collections, seasons, hidden tracks, secrets); a word has its
  reward's rarity. The 99 old single titles were migrated into words (their rewards now give a
  first and a last word, named "Title words: …"). Data: `packages/core/src/catalogue/title-words.ts`;
  rules: `packages/core/src/titles.ts`. `validateTitleWords` checks format (one word, letters and
  hyphens, up to 16), uniqueness, and every possible pairing against the nickname blocked words;
  `REVIEWED_BLOCKED_PAIRS` is the manual review list the picker refuses. The student picks one of
  each (or none) on the Rewards page; saved as `students.title_first` / `title_last` (migration
  0019); `GET`/`PUT /v1/student/rewards/title`; free to change any time; included in the family data export. Shown under the nickname
  on the Rewards page; the friends league is not built yet, so it shows there once it is.
- Friends league (FL): owner decision 2026-11-26, friends may come from other families from day
  one, not family only. Design approved 2026-11-26, not built yet: `docs/FRIENDS_LEAGUE.md`
  (nickname, avatar, title and weekly learning XP only; one parent per family approves; no chat;
  10-friend cap; siblings join automatically; reports seen by both families' parents and AppDeck;
  rank chip on Map, League page under Me; head-to-head challenges later).
- "Get help" page (built): `/help` for students (also signed out) and `/parent/help` (adds the
  NSPCC adult helpline, parent-only). Students reach it only from Settings, where it is the
  first tile (via the Me nav item); there is no Get help link in the student header or footer
  (owner decision, 2026-11-26, W7). Also the signed-out header and parent home. Quick exit is sticky at the top;
  topics are in five categories (Right now first and always open) with a private "Find a topic"
  filter (`features/help/categories.ts`). Help buttons wrap their text, so the page fits a 320px screen at 200% text with no
  sideways scroll (W6).
- Data: `content/support/uk-services.json` (schema `content/schemas/support-services.schema.json`).
  Every phone, text, link, opening time and age range has the URL of the service's own page it was
  copied from; `checked_at` per service. `pnpm content:validate` (and `scripts/content/support.test.mjs`)
  fails on a missing or off-site source, a check older than 4 months, or a non-UK number.
- Services first checked 2026-11-25: 999 and NHS 111 (nhs.uk), Childline, Report Remove (Childline
  and IWF), NSPCC Helpline (parents), Samaritans, Shout, The Mix, YoungMinds (website only), Beat,
  FRANK, CEOP, Switchboard, Brook (website only), Victim Support. Added the same day from the
  product owner's own check (`confirmed_by`): Coram Kidscape (young people's page; parent-only
  Parent Advice Line by phone, WhatsApp and email) and Anti-Bullying Alliance (parents only). Left
  out for now: Papyrus (site redirects to an administrator's page), Mind, Carers Trust (bot checks block automated checking). Kooth ("Soluna by Kooth") was added for
  students under feeling low: website only, with the owner's note "Free in some parts of the UK.
  Check if it's available where you live." (a `note` needs `confirmed_by`). See `docs/PRODUCT_RULES.md` (Get help).
- Logos: none shown yet. No organisation's own guidance clearly permits it, so each service has a
  neutral icon and its exact name. Findings and permission-request template:
  `docs/LOGO_PERMISSIONS.md` (W4).
- Private: the page uses its own layout with no API calls (no cards-due badge, no sounds), loads
  nothing from other sites, and opens websites with `rel="noreferrer"`. Quick exit replaces the
  history entry and goes to `/map`. Service worker v3 precaches `/help` and the built files.

## Quick wins (owner approved 2026-11-25; planned, workstream Q)

- Daily 5-a-day mixed set (5 questions from practised topics); recall checks (2 questions at lesson
  start, no penalty, skippable); "Learn it first" links to Oak and BBC Bitesize per topic, checked
  by CI; read aloud with on-device voices preferred; reading comfort settings (dyslexia-friendly
  self-hosted font, larger text, spacing, tint). Detail: `docs/PRODUCT_RULES.md` (Quick wins).
- 5-a-day (Q3, built): `GET /v1/student/daily`. The first request of the student's UK day picks
  up to 5 items from topics with at least one attempt in an enrolled subject (never new topics,
  never extended answers), stores them in `daily_sets` (one per student per day) and returns the
  same set all day. Choice: each topic's mastery drifts down by the 30-day half-life since it was
  last practised, then the normal next-item rules (weak spots first, due flashcards first, at most
  3 in a row per topic), topped up from the same topics if that leaves fewer than 5. Seeded by
  student and day. Done when every item has an attempt after the set was made. Map card above
  the next mission while not done; plays at `/learn/daily` in the lesson player (Learn mode,
  normal XP and combos, counts to the daily goal and streak through XP; the parent's daily limit
  applies through the normal attempts route, `creditableXp`). No push for it. Migration 0014.
- Recall checks (Q4, built): `GET /v1/student/recall?topicId=` before a topic lesson (or unit
  challenge) whose topic has been practised. Up to 2 questions the student has answered before
  (no flashcards, no extended answers), from other practised topics first, then the lesson's own
  topic; weak spots first (next-item rules). Shown as "Remember this?" in the lesson player with
  Skip; answers are normal Learn mode attempts (normal XP when right, wrong ones become
  flashcards, mastery as any answer). If the call fails the lesson starts as normal. Recall
  answers are sent with `recall: true` (Learn mode only) and saved with mode `recall`; a wrong one
  never resets the combo (`comboBefore` passes over it), a right one still adds to it (owner,
  2026-11-25).
  `apps/web/src/features/recall/`, `apps/api/src/routes/recall.ts`.
- Reading comfort (Q1, built): Settings → Reading comfort, per device in `localStorage` key
  `revisionden.reading`. Options: dyslexia-friendly font (OpenDyslexic from
  `@fontsource/opendyslexic`, SIL OFL 1.1, bundled with the app, no font service), text size
  Normal / Large (112.5%) / Larger (125%), more spacing (line height 1.8, letter 0.12em, word
  0.16em), tint none / cream / blue. Defaults: all off. Applied app-wide by `data-reading-*`
  attributes on `<html>` (`apps/web/src/features/reading/`).
- Appearance (J8, built): Settings → Appearance, per device in `localStorage` key
  `revisionden.appearance` (`{theme, palette, pattern}`). Theme `system` (default) / `light` /
  `dark`; palette `standard` (default) / `colourblind`; pattern `on` (default) / `off`. Applied as
  `data-theme`, `data-palette`, `data-pattern` on `<html>` by `public/appearance-boot.js` before
  first paint and by `AppearanceProvider` after (`apps/web/src/features/appearance/`). Colours in
  `apps/web/src/design/themes.ts` / `themes.css`: dark keeps button colours with white text and
  uses `--color-primary-edge` (#C4B5FF) for violet text; colour-blind right #1F6FD1 (blue), wrong
  #B34F00 (orange), checked by simulation (ΔE ≥ 20 for deuteranopia, protanopia, tritanopia) and
  4.5:1 contrast in all four combinations; shapes that carry meaning (empty progress tracks
  `--color-track` / `--arena-track`, the Challenge hex outline `--color-challenge-edge`) reach 3:1
  (`NON_TEXT_PAIRS`, J10f). Doodle tile `apps/web/src/design/doodle-scatter.svg` (original,
  1080px dense sticker sheet: 8 hero doodles, 420 medium (160 motifs, no copy of a motif within
  240px of itself) and 1,600 tiny fillers, no two outlines closer than 4px plus the line, tilted up
  to 25°, 1.4px lines; generated from a fixed seed by `doodleTile.ts`, used as a CSS mask at 7% ink;
  J8b; hand-drawn since J8c: doodles redrawn by `doodleSketch.ts` with wobble, corner overshoot,
  the odd double stroke and light scribble shading, about 58KB gzipped), hidden with
  `prefers-contrast: more` and forced colours. The public site uses the same tile (the older 240px
  grid tile `doodles.svg` was removed in M7).
  Text on gold or streak orange uses `--color-text-on-gold` (including the mastered-topic checkmark on the map). Get help follows the theme (light, dark, colour-blind) with its own AA-checked `--help-*` colours (W3).
- Effect styles (J10a, built): one active at a time; it restyles the game-feel moments, Home
  (topic map) and Rewards. Default and always available: Doodle Diary (`doodle-diary`, owner decision 2026-11-26, J10d). Registry
  `apps/web/src/features/juice/styles/registry.ts`; one stylesheet per style, scoped to
  `:root[data-effect-style='<id>']`. Chosen per device in `localStorage` key
  `revisionden.effectStyle` (cookies and storage policy 1.7); a style that is not unlocked falls
  back to Doodle Diary. Unlock ladder (owner, 2026-11-26; J10b): Sticker Book `level-3`, Pop Burst
  `level-5`, Garden Grow `subject-topics-5`, Starlight `topics-mastered-10`, Comic Pop `level-20`,
  Pixel Arcade `level-40`, added as `effectStyle` items by `withEffectStyles`
  (`packages/core/src/catalogue/effect-styles.ts`). All seven built (J10c, J10d): Doodle Diary (default), Sticker Book, Pop
  Burst, Garden Grow, Starlight, Comic Pop, Pixel Arcade. Unlocked list:
  `GET /v1/student/rewards/effect-styles`, loaded by `EffectStyleRoute` inside the router: never on `/help` or `/parent/help`, again whenever the picker opens, and retried on the next screen after a failed load (J10e). Picker: Settings → Effect style (students only), with
  locked styles showing a preview and how to unlock them. Doodle Diary letters headings in Patrick Hand
  (`@fontsource/patrick-hand`, OFL-1.1, self-hosted) and the provider passes the style to U's
  `useFeedbackStyle`. Lesson surround (J10a2): follows the style; the question and answers
  sit on `.lesson__stage`, kept plain (Doodle Diary and Sticker Book: paper, night paper in dark mode).
- Learn link providers (owner decision, 2026-11-26): only Oak National Academy, BBC Bitesize and
  Isaac Physics / Isaac Science (Cambridge). Criteria: free, made for UK secondary pupils, no ads,
  no comments or social feeds, no sign-up needed to read; ad-supported sites and exam-board pages
  not chosen. Provider enum `oak | bitesize | isaac` (plus `revisionden`, planned); hosts in
  `PROVIDER_HOSTS` (`scripts/content/learn-links.mjs`): www.thenational.academy,
  www.bbc.co.uk/bitesize/, isaacscience.org (isaacphysics.org redirects there, read 2026-11-26).
- Learn more (Q6, owner request 2026-11-26): on the flashcard Explain panel and after a wrong
  lesson answer, behind a "Learn more" tap; most specific links first (item, then learning point,
  then whole topic; flashcards use the topic). A link may carry `learning_points` or `items`.
  A link shows anywhere (Learn it first too) only when `checked_at` is set AND it has a `match`
  record (`page_title` as fetched, `teaches`, `level`, `checked_at`), recorded only for a page
  actually opened. The CI link check fails a match-checked page whose title changed; it also runs
  `--probe-providers` (what each provider's home page answers from the runner) and `--coverage`.
  Any reachable link without a match check fails validation (the Q5 legacy path was removed once
  its 11 links were re-read). Lessons match by learning point only: LearnItem has no content id
  yet, so `items` links cannot match in the app (needs `contentId` on LearnItem from the API).
  Coverage 2026-11-26: 139 links in 44 files; 44/44 topics and 133/133 learning points with items
  have a shown link, 69 points with their own. Pages were opened in a browser and read; the
  match `page_title` is the raw HTML title the CI check compares.
- In-house notes (planned; external links are interim): provider `revisionden` with `route` (an
  app path, no URL), listed first, optional `hide_external`; refused by validation until the
  notes exist (`IN_HOUSE_NOTES_BUILT` in `scripts/content/learn-links.mjs`).
- Learn it first (Q5, built): data in `content/learn-links/<topic id>.json` (title, URL, provider
  `oak` on www.thenational.academy or `bitesize` on www.bbc.co.uk/bitesize/, level, optional
  board, `checked_at` date or null). Validated by `pnpm content:validate`; every URL requested by
  `pnpm content:check-links` in `.github/workflows/learn-links.yml` (PRs that change links, pushes
  to dev, weekly Monday 06:17 UTC); 2xx and 3xx pass. Bundled into the web app at build time;
  the button shows at the top of a topic lesson only for whole-topic links that are shown (above); plain links
  opening in a new tab (nothing loaded until tapped). Pilot: Oak KS4 Higher lessons for the 9 GCSE
  Maths topics with items (n4, n7, a4, a6, a17, a18, r9, g9, g17), URLs found by web search only.
  Superseded on 2026-11-26 by Q6 (above): every link re-read and match-checked, Bitesize added
  once the provider hosts were allowed in the build environment.
- Learn it first, in-house goal (owner direction 2026-11-26, not yet built): RevisionDen should
  eventually write its own verified teaching content (topic notes, explanations per learning
  point, worked examples, code-drawn diagrams) under `docs/VERIFICATION.md`, and retire each
  external link once our notes cover the topic. Plan: `docs/research/question-generation-2026-11.md`
  section 11; review and Oak rules: decision 0010.

## Operator console (planned)

- Operators use AppDeck Admin (repo `appdeck-admin`) with RevisionDen as a managed app. AppDeck has
  no database access; it calls a signed operator bridge (HMAC tag `appdeck-revisionden-operator-v1`,
  per-environment shared secret, 5-minute window, idempotent request ids), and every operator read
  and change is audited. Agents: support; Managers: money and data. Complaints: acknowledge in 2
  working days, aim to resolve in 14. Data requests: one calendar month. Family tags (for example
  Beta tester, Press, Friends & family) are internal; Managers define them and their effects (early
  access, complimentary Premium, exclude from metrics); Agents apply them. Detail:
  `docs/OPERATOR_CONSOLE.md`.

## Pricing (agreed 2026-11-25; not live)

- Free app; Premium per child per month £9.99, £4.99, £2.99, then free; annual about £79.99;
  14-day trial; web only; prices include VAT. Learning, safety and accessibility stay free; offers
  only to parents; rewards never sold; no adverts. Free school meals: scheme choice and date only,
  declaration, soft checks, rare spot checks. Detail: `docs/PRICING.md`, decision 0004.
- Read aloud (Q2, built): Web Speech API only, no audio sent by us. Voice: on-device British
  English, then any on-device English, then online English. On by default only with an on-device
  voice; with only online voices it starts off and Settings says the device's speech service may
  process the text. Speed Slower 0.75 / Normal 1 / Faster 1.25. Saved in `localStorage` key
  `revisionden.readAloud` (`enabled` null until chosen). Speaker buttons: lesson question (with
  options and unit), feedback (verdict, answer, explanation), flashcard front or back. Maths read
  as words (`x^2` "x squared", `8^(2/3)` "8 to the power 2 over 3", `cm^2` "square centimetres",
  `√`, `π`, `×`, `÷`, `≤`, `≥`). `apps/web/src/features/read-aloud/`. Privacy notice 1.4 (6.4); young people's notice 1.3.
