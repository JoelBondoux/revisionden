# 0007: Student passkey unlock and one sign-in page

- Status: accepted (lead, 2026-11-25; synced passkeys: product owner, 2026-11-25)
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

## Synced passkeys (product owner: allow, and tell the parents)

Passkeys can sync between a student's own devices through iCloud Keychain or Google Password
Manager. They are allowed, and the parents are told (I5b):

- **Device marker.** When a device is linked, and when a passkey first unlocks on a device, the API
  gives the browser a random marker, kept in local storage (`revisionden.deviceMarker`); the API
  stores only its hash (`device_markers`). Unlock sends it back.
- **New device.** If the passkey verifies but the marker is missing or unknown, the API adds a
  `devices` row for the same student and passkey (so it shows in the parent's device list and can
  be unlinked on its own), gives it a marker, and logs the important family event
  `passkey_new_device`: "RevisionDen noticed <nickname>'s passkey being used on a new device",
  shown as new and pushed to both parents.
- **Cleared storage.** At most one new device a day per passkey: within 24 hours of the last new
  device, another unknown browser reuses that device (new marker, no new event).
- **Devices linked before markers.** The first unlock of a passkey with one device and no marker
  adopts that device quietly (no event), so the release does not alert every family.
- **Unlinking.** When a parent unlinks a device, its marker stays with no device, so that browser
  is refused ("Ask a parent to link this device"); the passkey still works on the student's other
  devices. Clearing that browser's storage would make it a new device again, which the parents are
  told about. To stop a synced passkey everywhere, a parent unlinks every device that uses it.

Implemented: `apps/web/src/features/onboarding/{StudentUnlock,UnlockPage}.tsx`,
`apps/web/src/api/{unlock.ts,LoadingOrError.tsx}`, `apps/web/src/session/deviceMarker.ts`,
`apps/api/src/routes/devices.ts` (`deviceForUnlock`), `packages/db` migration 0017.
