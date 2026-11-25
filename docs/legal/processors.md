# Services we use

Version: 1.0
Effective date: {{EFFECTIVE_DATE}}

## In plain English

- RevisionDen uses a few other companies to run the app. They handle data only to do a job for
  us, and only what that job needs.
- **Cloudflare** runs the website and our server, and will store photos for a few hours when
  photo reading is added. It also passes AI marking requests on to the AI company.
- **Neon** stores our database in London.
- **Google Cloud** runs our maths checker. It only sees maths working, never who wrote it.
- **Anthropic** (the AI called Claude) helps mark some written answers. It sees the question and
  the answer, but not who wrote it.
- **Google or Microsoft** sign the parent in.
- **Your browser's push service** delivers reminders, but never sees what they say.
- Some of these companies are in the United States, so data may go there. We are still choosing
  the legal safeguard for that, and the app won't be offered outside the operator's family until
  that is sorted.
- If the summary and the full text seem to differ, the full text is the one that counts.

## Full text

### 1. About this page

1.1 This page lists every service provider that processes personal data for {{OPERATOR_NAME}} to
run RevisionDen. Each acts as our processor (or, for sign-in and push services, see 2.6 and 2.7),
processing data under our instructions. It supplements the [privacy notice](privacy-notice.md).

1.2 It describes what the app's code does today. When we add, remove or change a provider, we
update this page in the same change, and material changes are shown in the app.

1.3 The contract terms (data processing terms) with each provider and the transfer safeguard for
each are still being confirmed. They are marked "to confirm" below. A solicitor must check this
page before the app is offered beyond the operator's family.

### 2. The providers

#### 2.1 Cloudflare: web hosting, server (Workers), rate limiting, storage (R2) and AI Gateway

- **What it does:** serves the web app, runs our API server (Cloudflare Workers), counts requests
  to limit abuse, will hold uploaded photos for a short time (Cloudflare R2), and routes AI
  requests to the AI provider and records their cost (Cloudflare AI Gateway).
- **What it receives:** every request to the app and the API, including the IP address and the
  data in the request (for example sign-in cookies, answers being marked and feedback). For AI
  requests: the question, topic, answer and mark points. Our AI requests ask the gateway not to
  store the request or reply content in its logs, so only token counts, cost and status are
  logged.
- **R2 (uploads):** the storage bucket exists for the planned photo-reading feature. No feature
  uploads to it yet. When it does, the bucket will delete every file within 24 hours.
- **Where:** Cloudflare's global network; a request is handled at a data centre near the user,
  which can be outside the UK. Cloudflare is a US company. The storage location of the R2 bucket
  is not restricted to a region in our configuration yet (to confirm).
- **Safeguards:** Cloudflare's data processing terms; transfer safeguard to confirm.

#### 2.2 Neon: database

- **What it does:** hosts our Postgres database.
- **What it receives:** everything we store, as listed in section 4 of the
  [privacy notice](privacy-notice.md).
- **Where:** the database is created in Neon's London region. Neon is a US company, so staff or
  systems outside the UK may be able to access it for support and operations (to confirm).
- **Safeguards:** encryption of stored data by the provider; data processing terms and transfer
  safeguard to confirm.

#### 2.3 Google Cloud Run: maths engine

- **What it does:** runs our maths checker, which checks each line of a student's maths working
  with a computer algebra library. It does not use AI.
- **What it receives:** the lines of working (up to 200 characters of maths each) and the expected
  answer. No nickname, identifier or other personal details are sent. Nothing is stored.
- **Where:** Google Cloud; the region of the service is to confirm and will be recorded here.
  Google is a US company.
- **Safeguards:** Google Cloud's data processing terms; transfer safeguard to confirm.

#### 2.4 Anthropic: AI marking (Claude)

- **What it does:** suggests marks for short written answers that our fixed rules could not mark.
  Marking long answers and essays (with Claude) is prepared in the code but not switched on yet.
- **What it receives:** the question, the topic, the student's answer and the relevant official
  mark points, through Cloudflare AI Gateway. Our server refuses to send a request that contains
  the student's nickname, identifiers, avatar code, school year, an email address or a UK mobile
  number. We use a paid API account.
- **Where:** Anthropic is a US company and the request may be processed in the United States.
- **Retention by the provider:** under Anthropic's own commercial terms (to confirm and record
  here).
- **Safeguards:** Anthropic's commercial terms and data processing terms; transfer safeguard to
  confirm. This is the open decision described in section 3.

#### 2.5 OpenAI and Google Gemini: question checking (not used with student data)

- **What they do:** we use a second AI provider to check our own questions and answers before they
  are released (see [content accuracy](content-accuracy.md)). This happens offline, on our
  questions only.
- **What they receive:** our questions, answers and mark schemes. **No student or parent data.**
- The app's server also has an optional, switched-off connection to OpenAI for a live second
  check. It is not used by any feature today. If it is turned on, this page will be updated
  first and the same personal-data checks will apply.

#### 2.6 Google and Microsoft: parent sign-in

- **What they do:** let a parent sign in with an existing Google or Microsoft account, so we never
  hold a password.
- **What they receive:** the fact that you are signing in to RevisionDen, from your browser, under
  their own privacy policies (they act as separate controllers for your account with them).
- **What we receive from them:** your email address, whether it is verified, an account
  identifier and sign-in tokens. We blank your name and picture before saving your profile, and
  we do not keep the tokens (see the privacy notice, 4.5).

#### 2.7 Browser push services: reminders

- **What they do:** deliver reminders to a student's device if the student turns reminders on.
  The service is chosen by the browser, not by us (for example Google for Chrome, Apple for
  Safari, Mozilla for Firefox and Microsoft for Edge).
- **What they receive:** an empty message addressed to the device's push address. Reminders carry
  no text at all: the device fetches the words from our server after it wakes up. The push
  service sees that a message was sent to that device and when, and the device's IP address.
- **Where:** wherever the browser's push service runs, which may be outside the UK.

#### 2.8 Not used

We do not use any analytics, advertising, tracking, error-reporting or social media services, and
the app does not load fonts or scripts from other websites.

### 3. International transfers

3.1 Several providers above are based in the United States or may process data there. Our design
principle is to keep data in the UK or EU. That is not true today for AI marking, where answer
text may be processed in the United States.

3.2 The product owner has not yet decided whether to use UK or EU processing options where a
provider offers them, or to rely on a transfer safeguard. The UK GDPR allows transfers covered by
UK adequacy regulations (which include the UK Extension to the EU-US Data Privacy Framework, for
organisations certified under it), the ICO's International Data Transfer Agreement, or the UK
Addendum to the EU standard contractual clauses, together with a transfer risk assessment.

3.3 Until the safeguard for each provider is confirmed and recorded on this page, the app must not
be offered to anyone outside the operator's family.

## Changes

- 1.0 ({{EFFECTIVE_DATE}}): First version (draft, not yet reviewed by a solicitor).
