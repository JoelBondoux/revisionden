# Privacy and safety

> Live document. The repository is public while CI runs on free minutes: **never commit personal
> data** of any kind (names, schools, emails, report images, real answers).

## Principles

1. Store the minimum needed to teach.
2. No passwords anywhere.
3. No photos kept: uploads are read, checked by the user and deleted.
4. The AI never sees who the student is.
5. Stored data stays in the UK or EU, encrypted at rest. Text sent for AI marking (with nothing
   that identifies the student) may be processed in the US by the AI provider; accepted by the
   product owner for now (`project_memory/decisions/0003-owner-decisions-hosting-ai-controller.md`).
6. No third parties in the web app: no analytics, trackers, beacons or outside fonts. Pages load
   only from our own site and its API (checked by the deployed smoke test, `e2e/smoke`).

## Accounts

- Parent: Google or Microsoft sign-in (Apple later). Only the sign-in email is stored: the
  provider's display name is blanked, the picture is never fetched or stored, and sessions keep
  no IP address or browser details. The provider's access, refresh and ID tokens are blanked
  before the sign-in record is saved (`apps/api/src/auth.ts`): Better Auth needs only the
  provider's account id to sign a parent in again, and we call no Google or Microsoft API.
- Second parent (optional): invited by the first with a one-time code (7 days, stored hashed);
  signs in with their own Google or Microsoft account, so only their sign-in email is kept, with
  the same token and profile blanking. The family activity log names parents only "Parent 1" or
  "Parent 2"; a removed parent's notice is kept only until they have seen it.
- Student: no outside account. Nickname (letters, numbers, underscore; 2–16 characters), layered
  avatar saved as a short code, year group (Years 9 to 13, checked by the API and the database).
  Device linked by one-time QR, then a passkey.

## Never stored

Student real name, date of birth, address, phone, email, photos, location, contacts, school name
(except a shared school report setup in Stage 5, by choice).

## Uploads

R2 bucket in the EU jurisdiction (one per environment) with a lifecycle rule deleting objects after 24 hours; deleted immediately after the
user confirms the reading. Only extracted values and confirmed text are kept.

## AI providers

Only the question, the student's answer, the topic and the mark scheme are sent. Paid API tiers
only (no free tiers that may train on data). AI Gateway logging must not store request bodies:
every call sends `cf-aig-collect-log-payload: false`, so only tokens, cost and status are logged.

The API refuses to send any request that contains the student's nickname, id, family id, avatar
code or year group ("Year 10"), an email address or a UK phone number, and tells the student
not to include personal details (`apps/api/src/ai/privacy.ts`; tested on the real HTTP body).
AI usage is stored per child as tokens and cost only, never the prompt or the answer.

## Reminders (web push)

Pushes are sent with no payload, so the push services (Google, Apple, Mozilla) never see any
reminder text. The service worker fetches the text from our API, or shows a generic reminder if
the device is locked. Only the browser's push endpoint and keys are stored, per device; the
VAPID contact is our web address, never a personal email.

## Friends

Nickname, avatar and XP only. Invite codes need parent approval. No chat, no free text between
students.

### Friends league: children's data impact note (approved; API built, screens to come)

Design: `docs/FRIENDS_LEAGUE.md`, approved by the owner on 2026-11-26. Friends can be from other families
(owner, 2026-11-26), so this is the first time one child's data is shown to children outside
their family.

- **What is shared**: nickname, avatar, two-part title and this week's league XP and place, only
  with approved friends. Never real name, school, year group, subjects, grades, streaks, level,
  activity times or free text. Other children's XP refreshes once a day so it shows no timing.
- **Minimisation**: no chat, messages, search, discovery, profiles or public leaderboard. Friend
  codes are single use, 48 hours, hashed and rate limited. League results are kept 8 weeks.
- **Defaults and control**: off per child until a parent turns it on; one parent in each family
  approves every friendship; either parent or the child can remove a friend; the child can hide
  from the league; report and block with fixed reasons. Siblings join each other's league
  automatically once friends is on for both.
- **Reports**: both families' parents and AppDeck support see the fixed reason, the date and the
  two nicknames (AppDeck also the reported avatar code), so repeated abuse can be acted on. Never
  free text or ids.
- **Retention and deletion**: codes and requests go within 24 hours of use or expiry; friendships,
  blocks and reports are deleted with either child; all of it is in the family export (code hashes
  left out).
- **Risks** we weigh in the DPIA: pressure or upset from competition (no league pushes, no "last
  place", effort-only praise), unwanted contact (codes in person only, two-family approval, block),
  and a nickname that identifies a child (the nickname filter, report). Open legal questions are
  in `docs/FRIENDS_LEAGUE.md` section 11. Must be in the DPIA before release.

## Feedback and policy confirmations

Feedback stores the family, who sent it (role, and the student or parent sign-in), the kind,
optional text (refused if it holds an email, UK mobile number or a family nickname) and optional
device details (app version, screen, browser family, screen size, online). Never IP, location or
contacts. The interactive lesson pilot's one-tap "Did this help?" (W8) stores only Yes or No
and the lesson item, never text. Deleted 12 months after closing. Policy confirmations store only the policy, version and
date per parent sign-in.

## Error reports

- "Send error report" (one tap, no typing) on every error that shows a reference code stores an
  anonymous row in `error_reports`: the code, the screen and failing API path with ids masked, the
  build, the browser family, online or not and the time. No family, student, account, id or text
  (strict schema in `packages/core`, `ErrorReportSchema`). Rate limited; deleted after 90 days.
- A failed passkey set-up on a child's device (E8) is logged through `POST /v1/client-errors` with
  the reference code, the path `/link` and the browser's error name only (for example
  `NotAllowedError`; strict pattern, never the browser's message). A bug report sent from that
  screen may carry the same short code as `lastProblem` (letters, digits, `_`, `:` and `-` only).

## Operator console (AppDeck)

- The owner's support console (AppDeck Admin) never reads the database. It calls the signed
  operator bridge (`/operator/appdeck`, `docs/OPERATOR_CONSOLE.md`), which returns only minimal fields:
  never answers, a student's own flashcards or free text, homework, AI prompts, push keys, sign-in
  tokens or anything from Get help.
- Support replies to feedback are shown to the sender without the operator's email. Internal
  support notes about a family are never shown in the app but are in the family's data export
  (text and time only).
- Family tags (O6) are internal support labels with no personal information; the family sees only
  the beta programme (a "Beta" badge it can leave). Deleted with the family.
- Complaints (O4): a parent's complaint text (≤500, no email, phone or nickname) and messages are
  kept 12 months after it is resolved, deleted with the family, and in the family export. Staff
  are never named to the family.
- A student's "Ask a parent to raise something" request (topic, optional note ≤300 with no
  email or phone number) is shown to the student's parents only, never to AppDeck; deleted when a
  parent acts on it, with the student, or after 90 days; in the family export.
- Every operator read of a family and every action is recorded (`operator_audit_log`: operator
  email and role, action, target id, time; no content), kept 2 years.

## Own flashcards

A student's own flashcards (up to 300 characters a side) get the same check as feedback before
they are saved: refused if they hold an email address, a UK mobile number or a nickname from the
family (`apps/api/src/routes/flashcards.ts`).

## Export and deletion

- One button deletes a student's data. "Delete the family account" deletes everything, including
  both parents' sign-ins; with two parents, the other must confirm first.
- Export: a parent can download everything we hold about them and their own children as one JSON
  file (`GET /v1/export`, "Download your family's data" in the parent area). Secrets are left
  out: session and link-code hashes, passkey keys and credential ids, push keys.
- Accounts unused for 12 months are deleted automatically: every parent or student request
  records that the family is in use (at most once an hour), and the scheduled clean-up deletes a
  family not used for over 12 months, with its students, all their records and the parents'
  sign-in records. A parent who comes back after 11 months or more without use sees a warning
  in the parent area. We send no emails, so there is no warning before deletion if nobody signs in.
- The same clean-up deletes expired device link codes, student and parent
  sessions, passkey challenges and sign-in checks within 24 hours of expiry; they are refused as
  soon as they expire (`apps/api/src/cleanup.ts`).

## Before any public release

Review against the ICO Age Appropriate Design Code (Children's Code); data protection impact
assessment; make the repository private.

## Repository visibility

While the repository is public it has no README and no GitHub description, to keep it hard to
discover. The project overview lives in `docs/OVERVIEW.md`. Do not add a root README or set a
repository description until the repository is private.
