# How long we keep data

Version: 1.0
Effective date: {{EFFECTIVE_DATE}}

## In plain English

- We keep most information for as long as your family uses RevisionDen, and delete it when you
  ask.
- A parent can delete a child's profile in the app at any time. That deletes all of the child's
  revision records too.
- Some things are deleted much sooner: link codes last 10 minutes, a student's unlocked session
  lasts 12 hours, and feedback is deleted 12 months after we close it.
- Some automatic clean-ups are not built yet. Where that is true, the table says "still to do".
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

### 2. Retention table

| Data                                                                                         | How long we keep it                                                                                                 | How it is deleted                                                 |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Parent sign-in email, provider account id and sign-in tokens                                 | While the family account exists                                                                                     | On request (an in-app button is still to do)                      |
| Parent sign-in sessions                                                                      | Until the session ends (the sign-in library's default expiry) or the parent signs out                               | Expired rows are not yet cleared automatically: still to do       |
| Policy confirmations (policy, version, date)                                                 | While the family account exists                                                                                     | With the parent account                                           |
| Student profile, courses, avatar                                                             | Until the parent deletes the student                                                                                | In-app delete                                                     |
| Learning records (answers' results, mastery, XP, streaks, rewards, plans, flashcards, exams) | Until the parent deletes the student                                                                                | In-app delete                                                     |
| Text of a student's answer sent for marking                                                  | Not stored by us                                                                                                    | Not applicable                                                    |
| Lines of maths working sent to the maths engine                                              | Not stored by us                                                                                                    | Not applicable                                                    |
| Device link codes (hashed)                                                                   | Valid for 10 minutes and usable once                                                                                | Kept until the student is deleted; automatic clean-up still to do |
| Student device sessions (hashed)                                                             | 12 hours, or until the device is locked or unlinked                                                                 | Removed on lock or unlink; expired rows: clean-up still to do     |
| Device passkey records                                                                       | Until the parent unlinks the device or deletes the student                                                          | In-app unlink or delete                                           |
| Push addresses and keys                                                                      | Until the student turns reminders off, the push service says the address no longer works, or the device is unlinked | Deleted automatically in each of those cases                      |
| Reminder settings and reminder log                                                           | Until the student is deleted                                                                                        | In-app delete                                                     |
| AI usage (tokens and cost only)                                                              | Until the student is deleted                                                                                        | In-app delete                                                     |
| Reports of a mistake in a question                                                           | Kept as part of the content audit trail; linked to the family until the family account is deleted                   | With the family account                                           |
| Feedback and bug reports                                                                     | 12 months after we mark it fixed or will not fix; open feedback is kept until closed                                | Deleted automatically by a scheduled clean-up                     |
| Uploaded photos (homework, school reports), when available                                   | Deleted as soon as the user confirms what was read, and always within 24 hours                                      | Storage rule deletes after 24 hours (feature not built yet)       |
| Information stored on your device                                                            | See [cookies and storage](cookies-and-storage.md)                                                                   | Clearing the browser's site data removes it                       |
| Records held by our service providers                                                        | See [services we use](processors.md)                                                                                | Under each provider's terms                                       |

### 3. Inactive accounts

3.1 Our rule is that accounts not used for 12 months are deleted automatically. This automatic
deletion is not built yet. Until it is, we will review inactive accounts by hand and delete them.

### 4. Asking us to delete data sooner

4.1 Contact {{CONTACT_EMAIL}}. We will delete the data within one month unless the law requires us
to keep it, and tell you if anything cannot be deleted and why.

## Changes

- 1.0 ({{EFFECTIVE_DATE}}): First version (draft, not yet reviewed by a solicitor).
