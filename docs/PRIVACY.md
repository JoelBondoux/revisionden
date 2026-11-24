# Privacy and safety

> Live document. The repository is public while CI runs on free minutes: **never commit personal
> data** of any kind (names, schools, emails, report images, real answers).

## Principles

1. Store the minimum needed to teach.
2. No passwords anywhere.
3. No photos kept: uploads are read, checked by the user and deleted.
4. The AI never sees who the student is.
5. Data stays in the UK or EU, encrypted at rest.

## Accounts

- Parent: Google or Microsoft sign-in (Apple later). Only the sign-in email is stored: the
  provider's display name is blanked, the picture is never fetched or stored, and sessions keep
  no IP address or browser details.
- Student: no outside account. Nickname (letters, numbers, underscore; 2–16 characters), layered
  avatar saved as a short code, year group. Device linked by one-time QR, then a passkey.

## Never stored

Student real name, date of birth, address, phone, email, photos, location, contacts, school name
(except a shared school report setup in Stage 5, by choice).

## Uploads

R2 bucket with a lifecycle rule deleting objects after 24 hours; deleted immediately after the
user confirms the reading. Only extracted values and confirmed text are kept.

## AI providers

Only the question, the student's answer and the topic are sent. Paid API tiers only (no free
tiers that may train on data). AI Gateway logging must not store request bodies in production.

## Friends

Nickname, avatar and XP only. Invite codes need parent approval. No chat, no free text between
students.

## Deletion

One button deletes a student's data; export first is offered. Accounts unused for 12 months are
deleted automatically.

## Before any public release

Review against the ICO Age Appropriate Design Code (Children's Code); data protection impact
assessment; make the repository private.

## Repository visibility

While the repository is public it has no README and no GitHub description, to keep it hard to
discover. The project overview lives in `docs/OVERVIEW.md`. Do not add a root README or set a
repository description until the repository is private.
