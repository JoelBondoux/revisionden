# 0006: Complaints: who complains, deadlines and escalation

- Status: accepted (product owner, 2026-11-25, relayed by the lead session)
- Date: 2026-11-25

## Context

Workstream O4 added formal complaints (`docs/legal/complaints-policy.md`). Session L's draft left
four points for the owner: firm or "aim to" deadlines, whether students complain directly, an
escalation timescale, and the ICO contact wording.

## Decision

1. Deadlines are what we **aim** for, not firm promises: acknowledge within 2 working days,
   resolve within 14 days. The policy and the app say "we aim to".
2. **Only parents make complaints.** A student can ask their parents to raise something ("Ask a
   parent to raise something", from Settings): a topic from a short list and an optional note of
   up to 300 characters. It appears for both parents in the parent area, where a parent can start
   a complaint pre-filled with the topic (not the child's note) or dismiss it. The note goes to
   the parents only, never to AppDeck. The page links the child to Get help for safety or
   wellbeing.
3. **Escalation:** a complaint not resolved within 5 working days of acknowledgement can be
   escalated (the parent's "Ask for a manager to review", or a Manager in AppDeck). AppDeck shows
   the escalation date and when acknowledgement or resolution is overdue.
4. **ICO details:** the owner checks ico.org.uk personally. Until then the policy has a marked
   placeholder (see `operations/contradictions.md`).

## Consequences

- `packages/core/src/complaints.ts`: `COMPLAINT_ESCALATE_AFTER_WORKING_DAYS` (5),
  `complaintEscalationFrom`, `COMPLAINT_REQUEST_TOPICS`.
- `complaint_requests` table (deleted when a parent acts on it, with the student, or after 90
  days); included in the family export. Complaints policy 1.1, data retention policy 1.7.
