# How long we keep data

Version: 1.8
Effective date: {{EFFECTIVE_DATE}}

## In plain English

- We keep most information for as long as your family uses RevisionDen, and delete it when you
  ask.
- A parent can delete a child's profile in the app at any time. That deletes all of the child's
  revision records too.
- Some things are deleted much sooner: link codes last 10 minutes, a student's unlocked session
  lasts 12 hours, and feedback is deleted 12 months after we close it.
- Expired link codes and sessions are deleted automatically, every 15 minutes.
- If nobody in your family uses RevisionDen for 12 months, the account and everything in it is
  deleted automatically.
- If the summary and the full text seem to differ, the full text is the one that counts.

## Full text

### 1. Our approach

1.1 {{OPERATOR_NAME}} keeps personal data only for as long as it is needed for the purposes in the
[privacy notice](privacy-notice.md), as the UK GDPR's storage limitation principle requires.

1.2 Deleting a student in the app (`Delete` on the student's profile) deletes the student's
profile and, because the database removes linked records with it, their courses, devices,
sessions, learning records, flashcards, plans, rewards, streaks, reminders, reminder log, AI
usage records and push addresses.

1.3 Backups. Our database provider keeps a short history of the database so it can be restored
after a fault. Deleted data can stay in that history until it rolls over. The length of that
history depends on the provider's plan settings and is still to be confirmed and recorded here.

1.4 Everything in this table that belongs to a family is also deleted automatically if nobody uses
the family account for 12 months (section 3).

### 2. Retention table

| Data                                                                                                 | How long we keep it                                                                                                 | How it is deleted                                                                                                                 |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Parent sign-in email and provider account id                                                         | While the family account exists, and for no more than 12 months after it was last used                              | In-app "Delete the family account" (both parents confirm when there are two), on request, or automatically after 12 months unused |
| Sign-in tokens from Google or Microsoft (access, refresh and ID tokens)                              | Not stored by us: blanked before the sign-in record is saved                                                        | Not applicable                                                                                                                    |
| Parent sign-in sessions                                                                              | Until the session ends (the sign-in library's default expiry) or the parent signs out                               | Expired sessions are deleted automatically within 15 minutes                                                                      |
| Policy confirmations (policy, version, date)                                                         | While the family account exists                                                                                     | With the parent account                                                                                                           |
| A second parent's sign-in email, provider account id and sessions                                    | As for the first parent; until the other parent removes them or the family is deleted                               | When removed, the access ends at once; on family deletion, with the family                                                        |
| Second-parent invite codes (hashed)                                                                  | Valid for 7 days and usable once                                                                                    | Deleted automatically within 15 minutes of expiring                                                                               |
| Family activity log ("Parent 1" or "Parent 2", what changed, when)                                   | 12 months; entries about a child go when the child is deleted                                                       | Deleted automatically by the scheduled clean-up, or with the family                                                               |
| Note that a parent was removed                                                                       | Until the removed parent has seen the notice in the app                                                             | Deleted when they press OK, or with their sign-in                                                                                 |
| Student profile, courses, avatar                                                                     | Until the parent deletes the student                                                                                | In-app delete                                                                                                                     |
| Learning records (answers' results, mastery, XP, streaks, rewards, plans, flashcards, exams)         | Until the parent deletes the student                                                                                | In-app delete                                                                                                                     |
| Text of a student's answer sent for marking                                                          | Not stored by us                                                                                                    | Not applicable                                                                                                                    |
| Lines of maths working sent to the maths engine                                                      | Not stored by us                                                                                                    | Not applicable                                                                                                                    |
| Device link codes (hashed)                                                                           | Valid for 10 minutes and usable once                                                                                | Deleted automatically within 15 minutes of expiring                                                                               |
| Student device sessions (hashed)                                                                     | 12 hours, or until the device is locked or unlinked                                                                 | Removed on lock or unlink; expired sessions deleted automatically within 15 minutes                                               |
| Device passkey records                                                                               | Until the parent unlinks the device or deletes the student                                                          | In-app unlink or delete                                                                                                           |
| Push addresses and keys                                                                              | Until the student turns reminders off, the push service says the address no longer works, or the device is unlinked | Deleted automatically in each of those cases                                                                                      |
| Reminder settings and reminder log                                                                   | Until the student is deleted                                                                                        | In-app delete                                                                                                                     |
| AI usage (tokens and cost only)                                                                      | Until the student is deleted                                                                                        | In-app delete                                                                                                                     |
| Reports of a mistake in a question                                                                   | Kept as part of the content audit trail; linked to the family until the family account is deleted                   | With the family account                                                                                                           |
| Error reports (anonymous, sent with "Send error report")                                             | 90 days                                                                                                             | Deleted automatically by a scheduled clean-up                                                                                     |
| Record that our support staff looked at or changed a family's account (who, what, when; no content)  | 2 years, so we can check how your data was handled                                                                  | Deleted automatically by a scheduled clean-up                                                                                     |
| Feedback and bug reports                                                                             | 12 months after we mark it fixed or will not fix; open feedback is kept until closed                                | Deleted automatically by a scheduled clean-up                                                                                     |
| Replies from our support team to your feedback                                                       | As long as the feedback (12 months after it is closed)                                                              | Deleted with the feedback                                                                                                         |
| Notes our support team keeps about your account                                                      | While the family account exists                                                                                     | With the family account; included in "Download your family's data"                                                                |
| Labels our support team puts on your account (for example "Beta tester"; never personal information) | While the family account exists, or until we remove the label                                                       | With the family account                                                                                                           |
| Record of a request you emailed us to export or delete your data (what, when, when handled)          | 2 years after we received it, so we can show we handled it on time                                                  | Deleted automatically by a scheduled clean-up                                                                                     |
| Complaints and their messages                                                                        | 12 months after the complaint is resolved                                                                           | Deleted automatically by a scheduled clean-up, or with the family account                                                         |
| A student's request asking their parents to raise something (topic and optional note)                | Until a parent starts a complaint from it or dismisses it, and at most 90 days                                      | Deleted automatically, or with the student                                                                                        |
| Uploaded photos (homework, school reports), when available                                           | Deleted as soon as the user confirms what was read, and always within 24 hours                                      | Storage rule deletes after 24 hours (feature not built yet)                                                                       |
| Information stored on your device                                                                    | See [cookies and storage](cookies-and-storage.md)                                                                   | Clearing the browser's site data removes it                                                                                       |
| Records held by our service providers                                                                | See [services we use](processors.md)                                                                                | Under each provider's terms                                                                                                       |

### 3. Inactive accounts

3.1 Accounts not used for 12 months are deleted automatically. An account counts as used whenever
the parent or any of the family's students uses the app while signed in. A scheduled clean-up,
which runs every 15 minutes, deletes any family account that nobody has used for more than 12
months (to the same day and time). That deletes the family, its students and all their records,
and the parent's sign-in email, provider account id and sessions.

3.2 We do not send emails, so we cannot warn you before the deletion if nobody signs in. If you sign
in after 11 months or more without use, the parent area shows a warning that says when the
account would have been deleted; using it then keeps it for another 12 months. The parent area
also always shows the date the account will be deleted if nobody uses it.

3.3 When a family has two parents, deleting the whole family in the app needs both of them to
confirm (or one parent after the other has been removed). It deletes the family, every child's
records and both parents' sign-in records.

3.4 Before that, you can download all your family's data at any time with "Download your family's
data" in the parent area.

### 4. Asking us to delete data sooner

4.1 Contact {{CONTACT_EMAIL}}. We will delete the data within one month unless the law requires us
to keep it, and tell you if anything cannot be deleted and why.

## Changes

- 1.8: Added the labels our support team can put on an account.
- 1.7: Added students' requests to their parents to raise a complaint, kept at most 90 days.
- 1.6: Added complaints, kept 12 months after they are resolved.
- 1.5: Added the record of emailed export and deletion requests, kept 2 years.
- 1.4: Added support replies to feedback and support notes about an account.
- 1.3: Added the record of support staff access to a family's account, kept 2 years.
- 1.2: Added the second parent, invite codes, the family activity log and removal notes, and deleting the family when there are two parents.
- 1.1: Added anonymous error reports, deleted after 90 days.
- 1.0 ({{EFFECTIVE_DATE}}): First version (draft, not yet reviewed by a solicitor).
