# 0006: Student passkey unlock and one sign-in page

- Status: accepted for the sign-in page and unlock flow (lead, 2026-11-25); the synced-passkey
  question below is open for the product owner.
- Date: 2026-11-25

## Context

A student device session lasts 12 hours, then the student unlocks again with the passkey. The API
has `POST /v1/device/unlock/options` and `POST /v1/device/unlock/verify` (discoverable passkeys
when no credential ids are sent), but the web app never called them: after 12 hours a child could
only get back in with a fresh QR code from a parent.

## Decision

- **One sign-in page.** The app's welcome page (`/`, `app.revisionden.com` in production) is the
  sign-in page for parents and students. The sales site's "Sign in" links to it (workstream M,
  `apps/www/src/config.ts` `appUrl`). Parents use Google or Microsoft; students tap
  "I'm a student: unlock with my passkey".
- **`/unlock`.** When a student API call (`/v1/student/...`) gets 401 because the session ran out,
  the app goes to `/unlock?returnTo=<page>` (not the parent sign-in) and returns there after
  unlocking. Default target: the topic map (`/map`). Only paths in this app are followed.
- **No passkey here.** If the browser finds no RevisionDen passkey (or the student cancels:
  browsers report both the same way, on purpose), or the server no longer knows the passkey (a
  parent unlinked the device), the page says "No RevisionDen passkey was found on this device. Ask
  a parent to link this device." It shows no nickname, avatar or other account detail.
- **Relying party.** Production passkeys use the RP ID `revisionden.com`, so they work from
  `app.revisionden.com`. Dev and staging use their own hosts (`dev.revisionden.com`,
  `staging.revisionden.com`): a passkey made on one environment does not work on another.

## Open: synced passkeys (owner question)

Passkeys can sync between a student's own devices through iCloud Keychain or Google Password
Manager. Today a synced passkey unlocks on the other device too, because it has the same credential
id and so matches the same `devices` row: the parent sees one linked device, and unlinking it
locks every device sharing that passkey.

Options for the owner:

1. **Allow it** (today's behaviour). Simple for families with a phone and a laptop. The parent's
   "linked devices" count means passkeys, not physical devices.
2. **Refuse synced passkeys** at linking (check the backup flags, `credentialBackedUp` /
   `credentialDeviceType: 'multiDevice'`, in `apps/api/src/passkeys.ts`). Each device then needs
   its own QR code. Some phones only offer synced passkeys, so linking could fail there.
3. **Allow it but show it.** Record that a passkey is synced and tell the parent ("this passkey
   may also work on the child's other devices").

Recorded in `operations/contradictions.md` until the owner decides. Implemented (sign-in page and
unlock): `apps/web/src/features/onboarding/{StudentUnlock,UnlockPage}.tsx`,
`apps/web/src/api/{unlock.ts,LoadingOrError.tsx}`.
