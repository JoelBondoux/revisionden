# Operator console (AppDeck)

> Live document. Requested by the product owner on 2026-11-25 to run RevisionDen with real
> customers. The operator console is the owner's existing **AppDeck Admin** (repository
> `appdeck-admin`, Next.js, sign-in through the shared identity service, Manager and Agent roles).
> RevisionDen becomes one more managed app there. Workstreams O (RevisionDen side) and AD (AppDeck
> side).

## How AppDeck connects (privacy first)

- **No database access from AppDeck.** RevisionDen holds children's data, so AppDeck never reads
  RevisionDen's database (unlike the Shopify apps). Everything goes through a signed **operator
  bridge** on the RevisionDen API, which returns only what the screen needs.
- **Signature:** HMAC-SHA256 over `["appdeck-revisionden-operator-v1", timestamp, METHOD, path,
operatorEmail, operatorRole, requestId, rawBody]` with a shared secret
  (`APPDECK_OPERATOR_SHARED_SECRET`, 32+ characters, one per environment), the same pattern AppDeck
  uses for HireLine. Requests older than 5 minutes are refused; request ids make changes
  idempotent; every call is rate-limited.
- **Audit:** every operator read of a family and every change is recorded in RevisionDen with the
  operator's email, role, action, target and time, and kept for 2 years. Operators are named in
  this internal log only (never shown to families).
- **Roles** (from AppDeck): **Agent** = support work (tickets, complaints, replies, confirming
  bugs, viewing families); **Manager** = also money and data (discount codes, free places, refunds,
  plan changes, deletions, exports).
- The bridge exists in development, staging and production with separate secrets; AppDeck shows
  which environment it is looking at.

## Wire format (O1, built)

Every operator route is under `/v1/operator` on the RevisionDen API host of that environment.
AppDeck sends these headers with every request:

| Header                     | Value                                                                       |
| -------------------------- | --------------------------------------------------------------------------- |
| `X-AppDeck-Timestamp`      | Whole Unix seconds (for example `1795600800`)                               |
| `X-AppDeck-Request-Id`     | Unique per request: 1–128 of `A-Z a-z 0-9 . _ : -` (a UUID is ideal)        |
| `X-AppDeck-Operator-Email` | The signed-in operator's work email                                         |
| `X-AppDeck-Operator-Role`  | `agent` or `manager` (any letter case; signed exactly as sent)              |
| `X-AppDeck-Signature`      | Lower-case hex HMAC-SHA256 of the payload below with the environment secret |

Signed payload: the JSON text of
`["appdeck-revisionden-operator-v1", timestamp, METHOD, path, operatorEmail, operatorRole, requestId, rawBody]`,
where `METHOD` is upper case, `path` is the path **and query string** exactly as requested
(`/v1/operator/families?id=…`), the header values are exactly as sent, and `rawBody` is the body
text exactly as sent (an empty string for none). JSON as `JSON.stringify` writes it (no spaces).

Rules the API enforces:

- No `APPDECK_OPERATOR_SHARED_SECRET` set in that environment: every operator route is 404.
- 120 requests a minute per address (`OPERATOR_RATE_LIMITER`), then 429 with `Retry-After: 60`.
- Missing header, bad signature, bad role or email: 401 `operator_unauthorized`. More than
  5 minutes from the server clock either way: 401 `operator_request_expired`.
- Request ids are used once (kept 1 day). A read (GET) sent again: 409
  `operator_request_replayed`. A change (POST, PATCH, DELETE) sent again with the same id, method,
  path and body gets the first answer again with `X-AppDeck-Replayed: true` and does not run
  twice; with a different body: 409 `operator_request_conflict`; still running: 409
  `operator_request_in_progress`. A change that failed with a 5xx can be retried with its id.
- An Agent calling a Manager action: 403 `operator_forbidden` (the refusal is audited).
- Errors use the API's shared shape: `{ "error": { "code", "message", "ref" } }`.

Audit log (`operator_audit_log`, 2 years): operator email and role, action, target type and id,
request id, outcome (`ok` or `denied`), time. The target is a plain id, so entries outlive a
deleted family; search text and content are never recorded.

### Test vector (pin this in AppDeck's client)

Also checked by `packages/core/src/operator-signature.test.ts` (`OPERATOR_TEST_VECTOR`). The
secret is a test value used nowhere else.

| Input          | Value                                                                                                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Secret         | `revisionden-operator-test-vector-secret-0001`                                                                                                                                                    |
| Timestamp      | `1795600800`                                                                                                                                                                                      |
| Method         | `POST`                                                                                                                                                                                            |
| Path           | `/v1/operator/families/00000000-0000-4000-8000-000000000001/notes`                                                                                                                                |
| Operator email | `operator@example.com`                                                                                                                                                                            |
| Operator role  | `agent`                                                                                                                                                                                           |
| Request id     | `req-0001`                                                                                                                                                                                        |
| Raw body       | `{"note":"Test note"}`                                                                                                                                                                            |
| Signed payload | `["appdeck-revisionden-operator-v1","1795600800","POST","/v1/operator/families/00000000-0000-4000-8000-000000000001/notes","operator@example.com","agent","req-0001","{\"note\":\"Test note\"}"]` |
| Signature      | `a83dae3e05e726fc32810568b530376f5bdd43bb58457f0918d1e4c7a1169874`                                                                                                                                |

### Endpoints

| Route                   | Role  | Returns                                                                 | Audited |
| ----------------------- | ----- | ----------------------------------------------------------------------- | ------- |
| `GET /v1/operator/ping` | Agent | `{ environment, version, operator: { email, role } }` (connection test) | no      |

Read endpoints come with O2, actions with O3 to O5.

## What the operator can see and do

| Area                         | View                                                                                                                                                                                                    | Actions (role)                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Overview**                 | Families, active students (7 and 30 days), Premium families, trials, free places, open tickets, complaints                                                                                              | none                                                                                                           |
| **Families**                 | Search by exact parent sign-in email or family id only (no browsing names). Family: created, parents (sign-in emails), plan and trial, children as nickname + year group + subjects, last active, flags | Agent: add an internal note. Manager: extend trial, grant or end a free place, comp Premium                    |
| **Tickets**                  | Bug reports, ideas, confusing, other; error reports grouped by RD code; status, device details, history                                                                                                 | Agent: reply (shown in the family's app), change status, confirm bug / mark duplicate (Bug Hunter)             |
| **Complaints**               | Formal complaints (new feedback kind "complaint"), with dates due                                                                                                                                       | Agent: acknowledge, reply, resolve with outcome. Manager: escalate, record a refund or goodwill                |
| **Discount codes**           | Codes, percentage or fixed, duration, expiry, maximum uses, redemptions                                                                                                                                 | Manager: create, disable. Codes are applied at checkout (workstream $)                                         |
| **Free school meals places** | Claims (scheme and date), renewals due, spot checks                                                                                                                                                     | Manager: start a spot check, record "checked on date", end a place                                             |
| **Data requests**            | Export and deletion requests, statutory deadline (one calendar month), status                                                                                                                           | Manager: mark handled; deletion runs the existing deletion code (both parents' confirmation rules still apply) |
| **Content reports**          | "Report a problem" on questions (quarantined items) with the review queue status                                                                                                                        | Agent: view and link to the review queue                                                                       |
| **Audit log**                | Every operator action                                                                                                                                                                                   | none                                                                                                           |
| **Service status**           | API health, version per environment, error-report rate                                                                                                                                                  | none                                                                                                           |

Never shown in AppDeck: answers, flashcards a student wrote, homework photos (deleted anyway), AI
prompts, push keys, sign-in tokens, or anything from the Get help page (which records nothing).

## Complaints

- A parent can make a formal complaint from the parent area ("Make a complaint") or by email to
  help@; operators can log an emailed complaint in AppDeck.
- Acknowledge within 2 working days; aim to resolve within 14 days; if not resolved, the family is
  told why and when to expect an answer. Complaints about personal data also say the family can
  contact the ICO. A short complaints policy goes in `docs/legal/` (following `docs/LEGAL.md`).

## Discount codes

- Codes are case-insensitive, 6–16 characters, created only by Managers; percentage (1–100%) or
  fixed amount, for a number of months or forever, with an expiry date and a maximum number of uses.
- One code per family at a time; they never stack with the free school meals place (which is
  already free). Applied through the payment provider when payments exist (workstream $).

## Out of scope for now

- Refunds and plan changes in the payment provider: added with workstream $.
- Messaging families by email (marketing): not planned; replies appear in the app and a parent
  may also be emailed a plain notice that a reply is waiting.
