# Friends league: design and privacy

> Status: **approved by the owner, 2026-11-26** (workstream FL), with the decisions in section 10.
> Build in progress (section 9 "Built so far"). The solicitor items in section 11 stay open.
> **Development only** for now (lead ruling, 2026-11-26): the `FRIENDS_ENABLED` flag is on in dev and
> off in staging and production until the notices are updated and the solicitor has reviewed them.
> Owner decision, 2026-11-26: friends can come from **other families from day one**, not only
> siblings. Planned in `docs/PLAN.md` (Stage 4, "Weekly XP league; head-to-head challenges;
> parent-approved invites"), `docs/REWARDS.md` (league rewards), `docs/BACKLOG.md` (title under
> the nickname, R8) and `docs/research/competitors-2026-11.md` ("invite-only with no chat").
> The children's-data impact note is in `docs/PRIVACY.md` ("Friends league").

## 1. In one minute

- A student can add friends from other families. Each friendship needs **one parent from each
  family** to approve it. Friends see only each other's **nickname, avatar, title and weekly
  league XP**. There is **no chat, no free text and no profile page**.
- Each student has their own small league: them plus up to **10** friends. The league is the
  week's league XP, which comes from reward XP and so is already capped (it cannot be farmed).
- Brothers and sisters are in each other's league automatically, with no code, when a parent has
  turned friends on for both (section 2).
- Topping your league for a week earns the existing league rewards (`league-top`,
  `league-wins-5`, `league-wins-20`). Head-to-head challenges come later, not in v1.
- Friends is **off until a parent turns it on** for that child. Either parent can remove a
  friend, and the child can leave a friendship, at any time. A student can report and block.

## 2. Turning it on (default settings)

- Per child, a parent setting **"Allow friends"**, **off by default** (Children's Code standard 7:
  high privacy by default). While off, the child sees no friends or league screen beyond a short
  "Ask a parent to turn on friends" card, and nobody can send them a request.
- Turning it off later hides the league and pauses every friendship (links are kept so turning it
  back on restores them; the friends see the student as gone). "Remove all friends" deletes them.
- **Siblings** (owner, 2026-11-26): children in the same family are in each other's league
  automatically, with no code or approval, once "Allow friends" is on for both. They count towards
  the 10, can be hidden with "Hide me", and cannot be removed or blocked as friends (turning
  "Allow friends" off takes a child out). They see the same card as any friend.
- The child can also switch on **"Hide me from the league"**: their friends no longer see them in
  the league, and they see a plain list of friends without scores. Friendships stay.

## 3. Adding a friend (invites)

The child asks, then both families' parents approve.

1. **Child A taps "Add a friend".** The app shows a one-time **friend code** (8 characters from
   the B3 alphabet, no 0/O, 1/I/L, shown as `XXXX-XXXX`). A shares it in person; the app never
   sends it anywhere and never asks for contact details.
2. **Child B enters the code** in "Add a friend". B sees A's nickname, avatar and title and taps
   "Yes, this is my friend" (or "No", which cancels it).
3. **Both families' parents are asked to approve.** Either parent in each family (as in B3) sees
   the other child's nickname, avatar and title, and taps Approve or Decline. Nothing else about
   the other family is shown to them (no emails, no parent names).
4. When one parent from **each** family has approved, the friendship starts and both children see
   "You and Nova_7 are now friends". If anyone declines, or it is not fully approved in **7 days**,
   both children see only "This friend request didn't go ahead", never who said no.

Codes and limits:

- Codes are **single use**, valid **48 hours**, stored **hashed only** (`hashToken`, as for parent
  invites and device links), and deleted by the daily clean-up within 24 hours of expiry or use.
- A child can make **3 codes a day** and have **3 waiting requests** at a time.
- Entering codes: **5 wrong tries per child per hour**, and **20 per family per day**, then
  "Try again later". Wrong, expired, used, blocked and "you're already friends" codes all get the
  same "That code isn't valid" message, so a code cannot be used to probe accounts.
- A child cannot friend themselves or a sibling with a code (siblings join automatically: see section 2).
- At most **10 friends** per child; a request that would go over is refused for both.
- Every step is in each family's activity log ("Parent 1 approved a friend for Nova_7").

8 characters is shorter than the 12 used for parent invites so it is easy to read out loud; the
48-hour life, single use, try limits and the need for two parent approvals keep guessing useless
(31⁸ ≈ 850 billion codes, at most 20 tries a family a day).

## 4. What other children can see

| Shown to friends                                           | Never shown                                                                        |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Nickname (already checked by the nickname filter)          | Real name, school, year group, GCSE or A-Level, age                                |
| Avatar (the layered avatar code, drawn by the app)         | Subjects, topics, grades, targets, mastery, mocks                                  |
| Two-part title (R8, already checked against blocked pairs) | Streak length, skip or gift days, level, total XP, rewards list                    |
| This week's league XP and place, and last week's winner(s) | When they revise, last seen, online now, activity times, devices                   |
|                                                            | Their friends list, who else they are friends with, how many league wins they have |
|                                                            | Family details, parent details, any free text                                      |

- **No timing signals.** Other children's weekly XP updates **once a day** (the total at the end
  of the previous UK day, refreshed at 06:00 UK), so a friend cannot tell when someone is
  revising. A student's own XP in their league is live.
- No chat, messages, comments, reactions, emoji sends, nudges, "poke" buttons or profile pages.
  Tapping a friend shows only the same card (nickname, avatar, title, XP) plus Remove, Report and
  Block.
- The only thing one child can send another is a gift day (already built; it needs `areFriends`),
  which arrives as "A friend gave you a skip day", with the giver's nickname.

## 5. League rules

- **League XP** is the student's reward XP from answers and completed flashcard sessions
  (`packages/core/src/reward-xp.ts`), so its caps already apply: at most **300 XP a UK day**,
  nothing from **22:00 to 05:59 UK**, flashcards at most **40 XP a day**. The most anyone can earn
  is 2,100 a week. **Bug Hunter XP and the +20 gift XP do not count** (owner, 2026-11-26), so the
  league is learning only and nobody swaps gift days for points.
- **The week** runs Monday 00:00 to Sunday 23:59 UK time (`Europe/London`). Because nothing counts
  after 22:00, Sunday's 22:00 total is final. Results show from Monday 06:00 with a small
  celebration for the winner(s) and the new week starts at 0 for everyone.
- **Your league** is you plus your friends who have not hidden themselves. Each student has their
  own league, so two friends with different friend lists can each top their own.
- **Winning** a week: highest league XP in your league, with **at least 50 XP** (one daily goal) and
  at least one other member with XP that week, so a league of one cannot be won. **Ties share the
  win**: everyone tied for first gets it. Each win adds 1 to `weeksTopOfLeague`, which unlocks the
  existing `league-top`, `league-wins-5` and `league-wins-20` rewards and their title words.
- **Places**: equal XP share a place ("=2nd"). Students with 0 XP that week are listed last, without
  a number, as "Not started yet", so nobody is shown as "last".
- **Fair across years**: XP measures effort under the same daily cap for a Year 10 and a Year 13
  student, and no year group or level is shown. Harder answer types earn more per answer, but the
  300-a-day cap limits any gap. Parent focus (double XP) also counts, within the same cap.
- **Wellbeing** (Children's Code standard 13, nudges): no push notifications about the league, no
  "you've been overtaken", no losing streaks, no countdown timers, no extra XP for revising late.
  League copy praises effort ("Great week, Nova_7!"), never shames.

### Head-to-head challenges

**Not in v1. Recommended for later.** They need a fair match-up (subjects differ), a time box and
more ways to feel pressured, and they raise new questions about showing what someone studied.
The weekly league covers the "friendly competition" goal first; challenges can be designed once
the owner has tried it.

## 6. Parent view

In the parent area, per child ("Friends" card):

- The **"Allow friends"** switch, and the child's "Hide me" state (read only).
- **Friends**: each friend's nickname, avatar and title, the date they became friends, and
  **Remove** and **Block**.
- **Waiting for you**: requests to approve or decline, and requests waiting on the other family.
- **Blocked**: nicknames this child has blocked, with **Unblock**.
- **Reports** this child made, and reports about this child (fixed reason, date, nicknames).
- An optional **private label** (owner, 2026-11-26) a parent can add to a friend (for
  example "from football"), up to 30 characters, checked like feedback text (no email, phone or
  family nickname), seen only by this family's parents, never by children or the other family. The
  other family cannot choose a label that our parents see, because it would usually be a real name.

## 7. Abuse and safety

- **Nicknames and titles** are already filtered (`packages/core/src/nickname.ts`, title pairs). A
  student who changes nickname is shown to friends under the new one; the filter runs again.
- **Report**: on a friend's card, "Report" with fixed reasons only (no free text): "Their nickname
  or picture upsets me", "I don't know this person", "I'm being pressured", "Something else".
  Reporting removes the friendship and blocks them straight away and tells the child "Thanks. A
  parent will see this". The other child is not told it was a report: the friend just disappears.
- **Who sees a report** (owner, 2026-11-26): **both families' parents and AppDeck support**, so
  repeated abuse can be acted on. They see only the fixed reason, the date and the two nicknames
  (AppDeck also gets the reported child's avatar code, so a bad nickname or avatar can be changed).
  Never free text, ids, family details or anything else. A report cannot be made about a sibling.
- **Block**: from Report, from a friend's card, or by a parent. A blocked student cannot use any
  code from the blocker, and the blocker's codes do not work for them (the same "That code isn't
  valid" message, so they are not told). A block lasts until the blocking family lifts it.
- **Leaving**: the child can remove a friend any time ("Remove friend"); either parent can too.
  The other child is not notified; the friend just leaves their league. Each family's activity log
  records it.
- **No discovery**: there is no search, no "people you may know", no list of all students and no
  public leaderboard. The only way in is a code shared in person.

## 8. Data, retention and deletion

New tables (one new migration):

| Table                 | Holds                                                                                       | Kept until                                                       |
| --------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `friend_codes`        | code hash, child, expiry, used                                                              | used or expired, then deleted within 24 hours                    |
| `friend_code_tries`   | each typed code: child, family, right or wrong, time (for the try limits)                   | 24 hours                                                         |
| `friend_requests`     | the two children, status, which family has approved (parent number only), expiry            | started, declined or 7 days, then deleted within 24 hours        |
| `friendships`         | the two children (stored once, lower id first), start date, optional private label per side | removed, either child deleted                                    |
| `friend_blocks`       | blocking child, blocked child, date                                                         | unblocked, either child deleted                                  |
| `friend_reports`      | reporting child, reported child, reason code, date, outcome (seen as in section 7)          | 12 months after closing, or either child deleted                 |
| `league_weeks`        | per child per week: league XP, place, won (yes/no)                                          | last 8 weeks only; the win count stays in `students.league_wins` |
| `students` (2 fields) | `friends_allowed` (default false), `league_hidden` (default false)                          | with the student                                                 |

- Weekly league XP is worked out from existing XP records; `league_weeks` only keeps the result.
- **Deleting a student or family** deletes their codes, requests, friendships, blocks and reports,
  in both directions. The other child's league simply loses them. 12-month inactivity deletion
  covers the same.
- **Export** (`GET /v1/export`): the family's friendships (friend's nickname, start date, private
  label), waiting requests, blocks, reports made and league weeks. Code hashes are left out, as now.
  It does **not** include the other family's ids or anything else about them (see section 11).
- AppDeck sees counts only (number of friendships), plus reports as in section 7.

## 9. Build plan (step 2, after sign-off)

- `packages/core/src/league*.ts`: week bounds in UK time, league XP from reward XP, places and
  ties, the win rule, code format and normalising; pure, with time injected.
- New migration for the tables above.
- `apps/api/src/routes/friends*.ts`: codes, redeem, approve or decline, list, remove, block,
  report, league, parent views, limits; weekly result job in the existing cron.
- `apps/web/src/features/league/**`: the League screen (fits the single-screen rule, doodle style
  through shared components), Add a friend, the parent Friends card.
- Rewards hookup: `weeksTopOfLeague` from `league_weeks`. Title under each nickname.
- Cross-lane changes to list in the PR: export and deletion (`apps/api/src/routes/export.ts`,
  family deletion), the rewards stats source, the cron, the Map rank chip and the Me entry, the
  parent home card, the AppDeck report view,
  `docs/legal/*` text via workstream L.
- Stacked PRs (lead, 2026-11-26): core rules, migration and API first; then web; then the rewards
  hookup and title.
- Tests: every rule above has a plain-English test first; API tests on PGlite; e2e for two
  families making friends, the league, removing, blocking, and export and deletion.

### Built so far

- **PR 1 (core, migration 0030, API):** `packages/core/src/league.ts` (week, league XP, places,
  ties, win rule, codes, labels, limits); tables `friend_codes`, `friend_code_tries`,
  `friend_requests`, `friendships`, `friend_blocks`, `friend_reports` and
  `students.friends_allowed` / `league_hidden`; routes in `apps/api/src/routes/friends.ts` and
  `friends-league.ts`:
  - Student: `GET /v1/student/friends`, `POST /v1/student/friends/codes`,
    `POST /v1/student/friends/redeem`, `POST /v1/student/friends/requests/:id/confirm|cancel`,
    `DELETE /v1/student/friends/:id`, `POST /v1/student/friends/:id/block|report`,
    `GET /v1/student/league`, `PUT /v1/student/league/hidden`.
  - Parent: `GET /v1/students/:id/friends`, `PUT /v1/students/:id/friends/allowed`,
    `POST /v1/students/:id/friends/requests/:rid/approve|decline`,
    `DELETE /v1/students/:id/friends/:friendId`, `POST /v1/students/:id/friends/:friendId/block`,
    `DELETE /v1/students/:id/friends/blocks/:blockedId`,
    `PUT /v1/students/:id/friends/:friendId/label`.
  - Every step is in the family activity log (new kinds in `apps/api/src/family-events.ts`);
    the family export has a `friends` block per child and the profile's two settings; the daily
    clean-up deletes used or expired codes, tries after a day, and requests a day after they end.
- **PR 2 (web):** `apps/web/src/features/league/`: the League page at `/league` (the table
  of up to 11 fits one phone screen, with "Add a friend" and "Friends" always in view; adding,
  friend actions, report reasons and "Hide me" sit in sheets), the self-contained rank chip
  (`LeagueChip`, "You're 2nd this week") on Home in place of "Friends league Soon" (it
  moved from the Map header when J15b's Home landed, as the owner asked), a "Friends league" tile on Me
  (Settings), and the parent Friends page at `/parent/friends/:studentId` (from a "Friends" tile
  on the child's card in the parent home). Shared shapes: `packages/core/src/league-schemas.ts`.
  e2e: `e2e/tests/league.spec.ts`.
  The Me tile, the parent tile and the chip appear only when the API has friends (`FRIENDS_ENABLED`,
  dev only); otherwise the pages say "Friends aren't available yet."
- **PR 3 (weekly results and rewards, migration 0031):** `league_weeks` (one row per child per
  finished week: XP, place, won) and `students.league_wins`. There is no cron in dev, so weeks
  are settled lazily: the first time a child opens the league or their rewards, each of the last
  8 finished weeks without a result is worked out (`settleLeagueWeeks` in
  `apps/api/src/routes/friends-league.ts`) from the friends they had by the end of that week. A
  win adds 1 to `league_wins`, which the rewards read as `weeksTopOfLeague` (`league-top`,
  `league-wins-5`, `league-wins-20`). The league shows last week's result ("You topped your
  league last week!" or "Last week you were 3rd. Nice effort!"). The clean-up deletes results
  older than 8 weeks; the win count stays.
- **Closing a report (PR 3, lead 2026-11-26):** the reporting child's parents mark a report as
  dealt with (`POST /v1/students/:id/friends/reports/:reportId/close`, "Mark as dealt with" in
  the parent Friends card); both families then see it as dealt with, and the daily clean-up
  deletes it 12 months later. An open report is kept until it is closed or either child is
  deleted.
- **Review fixes (FL4-fix, from the train #313 review):** approvals from both families at
  once can no longer overwrite each other (each writes only its own column, then one
  conditional UPDATE starts the friendship); typing a code checks both children's 3 waiting
  requests before the code is used; ending a friendship (remove, block, report, or friends
  turned off) first settles any unsettled finished weeks for both children, so leaving after
  Sunday cannot change last week's result; and a request left waiting for the child's check can
  be confirmed or cancelled later from the Friends sheet (`friend_checking` is what the other
  child sees).
- **Review fixes, part 2 (FL4b, from the train #317 review):** once both families approve, the
  friendship is saved first and the request is marked started after, so if the save fails the
  request stays waiting with both approvals and approving again finishes it (production uses
  `neon-http`, which has no multi-statement transactions).
- **Known behaviour (lead, 2026-11-26):** deleting a child does not settle their friends'
  finished weeks first. The child's data goes at once, so a friend whose last weeks were not yet
  settled simply has that rival missing from those weeks. Accepted.
- **Still to come:** the AppDeck report view, where support can also close a report
  (`docs/BACKLOG.md`).

## 10. Owner decisions (2026-11-26, via the lead)

1. **Where the League lives**: a small, self-contained **rank chip** on Map ("You're 2nd this
   week") that opens the full **League page under Me**. When workstream J's Home dashboard (the
   Pip fox button) lands, the chip moves to Home; it is built as its own component so it can sit
   anywhere.
2. **Siblings**: yes, automatically in each other's league with no invite, when a parent has turned
   "Allow friends" on for both (section 2).
3. **Reports**: both families' parents and AppDeck see them, sharing only the fixed reason and the
   nicknames (section 7).
4. **Accepted as proposed**: the 10-friend cap (siblings included), a private parent-only label per
   friend, and only learning XP counts (no Bug Hunter or gift XP).
5. Head-to-head challenges later, not in v1. Everything else as written here.

## 11. Owner / solicitor decisions

These need the owner's solicitor before release. We propose wording; we do not write legal text
in `docs/legal` (workstream L does, once agreed).

- **DPIA**: the Children's Code (standard 2) and the ICO expect a DPIA for children's data shared
  between users. The friends league must be in the DPIA before release (`docs/legal/childrens-code.md`
  2.2 already lists friends as a to-do).
- **Lawful basis** for showing a child's nickname, avatar, title and weekly XP to children in other
  families: the core service's basis, or consent from a parent in each family (the two approvals
  could be recorded as consent)? Can a parent withdraw it at any time (yes, by design)?
- **Article 8 and age**: students are 13 to 18. Is a parent's approval needed in law for 13+, or is
  it only our choice (we would keep it either way)?
- **Export**: is the other child's nickname in our family's export their personal data, and is it
  fine to include it (we think yes: it is what our parents already see)?
- **Reports** (owner decided both families' parents and AppDeck see them): is sharing the
  reporting child's nickname with the other family's parents fair and safe (it could invite
  pressure on the reporter), what the notices must say about it, and how long reports may be kept
  (proposed 12 months after closing)?
- **Notices to update** (workstream L): the privacy notice and young people's notice (title and
  weekly XP are new; "XP" becomes "this week's league XP"), the acceptable use policy 4.2
  ("Friends are not available yet"), data retention (new rows), the Children's Code page
  (standards 2.2, 2.7, 2.9, 2.11, 2.13) and the parent's processing table.
- **Safeguarding**: what we do if a report suggests a child is at risk (proposed: show the child
  Get help, and the owner's safeguarding process; no data goes to anyone else without the
  solicitor's advice).
