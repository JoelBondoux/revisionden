# How we follow the Children's Code

Version: 1.0
Effective date: {{EFFECTIVE_DATE}}

## In plain English

- The Children's Code (its full name is the Age Appropriate Design Code) is a set of 15 standards
  from the Information Commissioner's Office (ICO) for online services that children use.
- This page goes through each standard and says how RevisionDen meets it, or what is still to do.
- The biggest things still to do are a formal risk assessment (a "data protection impact
  assessment"), a written fairness check for how we use students' data, and confirming the legal
  safeguards for the AI companies we use.
- RevisionDen will not be offered outside the operator's family until those are done.
- If the summary and the full text seem to differ, the full text is the one that counts.

## Full text

### 1. Scope

1.1 The ICO's Age Appropriate Design Code (the "Children's Code") applies to online services likely
to be accessed by children in the UK. RevisionDen is designed for students aged 13 to 18, so
{{OPERATOR_NAME}} treats the Code as applying in full. This page records, for each of the Code's 15
standards, how the app meets it today and what is still to do. It is a working record, not a
statement that the app complies; it must be reviewed by a solicitor and completed before the app
is offered beyond the operator's family.

### 2. The 15 standards

#### 2.1 Best interests of the child

- **Met:** the app exists to help students learn. It has no adverts, no selling of data and no
  features designed to maximise time spent. Rewards follow learning, never screen time, and there
  are no loot boxes. Reminders respect quiet hours at night and during school hours by default.
- **To do:** a written best-interests assessment as part of the data protection impact assessment.

#### 2.2 Data protection impact assessments

- **To do:** a data protection impact assessment (DPIA) has not been completed. It must be done
  before any public release, covering AI marking, international transfers, adaptive learning
  (profiling) and the planned photo reading and friends features.

#### 2.3 Age appropriate application

- **Met:** every student is treated as a child and gets the same high-privacy design whatever
  their age. Students are told about the app in a notice written for 13 to 18 year olds. Parents
  set up and control the account.
- **To do:** confirm the minimum school year in all parts of the system (the app's set-up offers
  Years 9 to 13, but the database still accepts Years 7 and 8).

#### 2.4 Transparency

- **Met:** a [privacy notice for young people](privacy-for-young-people.md) with a short plain
  English summary; every policy starts with a plain English summary; policy pages can be read
  without signing in. Students see the young people's notice when their device is first linked,
  and feedback forms tell students their parent can see what they send.
- **To do:** "just in time" notes at the point of use for AI marking and (when built) photo
  reading.

#### 2.5 Detrimental use of data

- **Met:** no data is used for marketing, advertising or to encourage longer use. Streaks have skip
  days so missing a day is not punished, at most two reminders a day are sent, and none during
  quiet hours. The student's own statistics view (not built yet) is specified never to use red or
  "worse" wording.
- **To do:** review streaks and rewards against the ICO's guidance on features that encourage
  extended use, as part of the DPIA.

#### 2.6 Policies and community standards

- **Met:** our [community rules](acceptable-use.md), [terms of use](terms-of-use.md) and published
  policies describe what we do, and the app follows them; a mismatch between a policy and the code
  is treated as a bug.

#### 2.7 Default settings

- **Met:** the most private option is the default. Reminders are off until the student turns them
  on; there is no public profile; friends (when built) need a parent's approval; "Include device
  details" on feedback starts off for students (a student can turn it on) and on for parents.

#### 2.8 Data minimisation

- **Met:** students have a nickname, avatar and school year only; no real name, date of birth,
  email, phone, photo, location or school name. An automated test fails if the database gains a
  column that could hold these. Answers are not stored, only their results. Parents' names and
  pictures are blanked. IP addresses are not stored.
- **To do:** the sign-in library stores Google or Microsoft tokens, which may contain the parent's
  name; review whether they need to be kept. Expired sessions and link codes are not yet cleared
  automatically.

#### 2.9 Data sharing

- **Met:** no data is shared with third parties except the service providers that run the app
  ([services we use](processors.md)), each receiving only what it needs. Requests to AI providers
  are checked and refused if they contain personal details.

#### 2.10 Geolocation

- **Met:** the app does not collect location. IP addresses are used only for a moment to limit
  abuse and are not stored.

#### 2.11 Parental controls

- **Met:** parents can see their child's profile, courses, AI use and feedback, and set reminder
  times. A parent progress dashboard is planned.
  Students are told this in their notice and on the feedback form.
- **To do:** show students a clear sign in Settings of what their parent can see (planned with the
  statistics dashboards).

#### 2.12 Profiling

- **Met in part:** the app profiles learning only, because that is the core service: it estimates
  topic mastery, chooses weak topics and sets feedback levels. It does not profile for any other
  purpose, such as advertising or marketing. These estimates never decide anything outside the app.
- **To do:** the Code expects profiling to be off by default unless there is a compelling reason;
  record why adaptive learning is a compelling reason in the DPIA, and explain it at the point of
  use.

#### 2.13 Nudge techniques

- **Met:** the app does not nudge students to give more data or weaken privacy settings. Choices
  about reminders and feedback device details are presented neutrally.
- **To do:** review rewards and streak messages, as part of the DPIA, to make sure they encourage
  learning rather than time spent.

#### 2.14 Connected toys and devices

- **Not applicable:** RevisionDen is a web app and does not connect to toys or other devices.
  Passkeys use the device's own unlock and we never receive biometric data.

#### 2.15 Online tools

- **Met in part:** a parent can delete a student and all their data in the app, unlink devices and
  download all the family's data as a file; a parent can delete the whole family account (both
  parents confirm when there are two); accounts unused for 12 months are deleted automatically;
  students and parents can send feedback and report a mistake from within the app.
- **To do:** a way for a student to ask for help with their rights from inside the app.

## Changes

- 1.0 ({{EFFECTIVE_DATE}}): First version (draft, not yet reviewed by a solicitor).
