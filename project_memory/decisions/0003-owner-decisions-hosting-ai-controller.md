# 0003: Hosting keys, AI processing in the US, and who runs the app

- Status: accepted (product owner, 2026-11-25)
- Date: 2026-11-25

## Context

Deploys (workstream G) were blocked on whether to create keys just for RevisionDen. The privacy
principle "data stays in the UK or EU" disagreed with AI marking by US providers (see
`project_memory/operations/contradictions.md`). The policies needed to know who the controller is.

## Decision

1. **Hosting keys.** Reuse the product owner's existing Cloudflare token and Neon key (they are
   also used by other projects). Rules for every session that uses them:
   - Create only resources named `revisionden` or starting `revisionden-`; in Cloudflare, touch DNS
     and routes only in the `revisionden.com` zone.
   - Never change, delete or read the data of any other project's resources (listing names to
     avoid clashes is fine).
   - Database: a new Neon project `revisionden` in the London region (`aws-eu-west-2`).
2. **AI processing in the US is accepted for now.** Stored data (database, uploads) stays in the
   UK or EU. The text sent for AI marking (the question, the student's answer and the mark scheme,
   with nothing identifying the student) may be processed in the United States by the AI
   provider. The policies say so plainly. The transfer safeguard for each provider is still to be
   confirmed before the app is offered outside the family. Revisit before any public release.
3. **Controller.** The app is run by the product owner as a **sole trader** under a trading name.
   The trading name, contact email and postal address are never committed; they are supplied at
   build time (`VITE_OPERATOR_NAME`, `VITE_CONTACT_EMAIL`, `VITE_POSTAL_ADDRESS`). Contact email for the policies: `privacy@revisionden.com`; no postal address shown (owner,
   2026-11-25). Whether the ICO
   data protection fee is due is for the product owner to confirm with the ICO.

## Consequences

- G is unblocked. Secret values are never printed or committed; GitHub Actions secrets are added
  by the product owner where a value cannot be read by a session.
- `docs/PRIVACY.md` principle 5 and the privacy notice section 8 now describe the US processing as
  a decision, not an open question.
