# Cookies and storage

Version: 1.3
Effective date: {{EFFECTIVE_DATE}}

## In plain English

- RevisionDen only stores things on your device that the app needs to work, like keeping you
  signed in.
- There are **no** advertising cookies, **no** analytics and **no** tracking. Nothing is shared
  with other websites.
- Because everything is needed for the app to work, the law does not require us to ask for
  permission first, but we still tell you what each one is.
- If the summary and the full text seem to differ, the full text is the one that counts.

## Full text

### 1. The law

1.1 The Privacy and Electronic Communications Regulations 2003 (PECR) require consent before
storing information on, or reading it from, a user's device, unless the storage is strictly
necessary to provide a service the user has asked for. Everything RevisionDen stores falls within
that exemption, so we do not show a cookie banner. {{OPERATOR_NAME}} will ask for consent before
adding any storage that is not strictly necessary.

### 2. Cookies

| Name or kind                  | Set by  | What it is for                                                      | How long                                                     |
| ----------------------------- | ------- | ------------------------------------------------------------------- | ------------------------------------------------------------ |
| Parent sign-in session cookie | Our API | Keeps a parent signed in. Secure, HttpOnly (scripts cannot read it) | Until it expires (the sign-in library's default) or sign out |
| Sign-in state cookie(s)       | Our API | Protects the Google or Microsoft sign-in step against forgery       | A few minutes, during sign-in only                           |
| `__Host-rd_student`           | Our API | Keeps a student's device unlocked. Secure, HttpOnly                 | 12 hours, or until the device is locked                      |

Google and Microsoft may set their own cookies on their own sign-in pages, under their own
policies. We do not set or read those.

### 3. Other storage on the device

| What                                          | What it is for                                                                                                                             | How long                                             |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| Passkey                                       | Lets a student unlock the app with the device's fingerprint, face or PIN. Stored by the device, not by us; we only keep its public part    | Until the student or parent removes it               |
| Local storage `revisionden.studentId`         | Remembers which student profile is used on this device                                                                                     | Until site data is cleared                           |
| Local storage `revisionden.deviceMarker`      | A random code that tells this device apart from the student's other devices using the same passkey. We keep only a scrambled (hashed) copy | Until site data is cleared or the device is unlinked |
| Local storage `revisionden.youngPeopleNotice` | Remembers that the student has seen the privacy notice for young people (the version number only)                                          | Until site data is cleared                           |
| Service worker and its cache                  | Lets the app open quickly and work offline. Holds only the app's own files, never your data; API responses are never cached                | Until the app updates or site data is cleared        |
| Push subscription                             | Lets the browser receive reminders, if the student turns them on                                                                           | Until reminders are turned off                       |
| Local storage `revisionden.bugButton`         | Remembers if the student switched the bug button off on this device                                                                        | Until site data is cleared                           |
| Sound settings (when added)                   | Remembers mute, volume and tap sounds for this device                                                                                      | Until site data is cleared                           |
| Local storage `revisionden.readAloud`         | Remembers whether read aloud is on and its speed on this device                                                                            | Until site data is cleared                           |
| Local storage `revisionden.reading`           | Remembers reading comfort choices (font, text size, spacing, tint) on this device                                                          | Until site data is cleared                           |

### 4. What we do not use

No analytics, advertising, social media, fingerprinting or tracking pixels. Fonts and scripts are
served from our own site, not from other websites.

### 5. Removing storage

You can clear the app's cookies and site data in your browser settings at any time. You will then
need to sign in, or unlink and link the student's device again.

## Changes

- 1.3: Added the device code that tells a student's devices apart when their passkey is synced.
- 1.2: Added the setting that remembers if the bug button is switched off on this device.
- 1.1: Added the read aloud and reading comfort settings kept on the device.
- 1.0 ({{EFFECTIVE_DATE}}): First version (draft, not yet reviewed by a solicitor).
