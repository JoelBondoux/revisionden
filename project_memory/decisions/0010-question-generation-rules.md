# 0010: Question generation rules (sampling, templates, set texts, fact tables, readability)

- Status: accepted by the product owner on the lead's recommendations, relayed to workstream QG
  by the lead, 2026-11-26. Item 9 goes to the owner's solicitor; item 10 decided later the same
  day (below).
- Date: 2026-11-26

## Context

The question generation research (`docs/research/question-generation-2026-11.md`, section 9) listed
eleven proposals that would change or add to the verification rules, so that subjects other than
maths can reach 600 to 1,000 verified items at a review cost one parent can keep up.

## Decision

1. **Computed items are sampled at 3%, at least 10** (instead of 10%, at least 30), but only in a
   batch where **every** item comes from a template whose preview the owner approved and whose
   cross-check passed. Any other batch (mixed, or with an unapproved template) keeps 10%, at least 30. Items needing human approval are still reviewed individually. Code:
   `packages/core/src/review-sampling.ts` (`samplingRule`, `templateApproved`), used by the batch
   routes in `apps/api/src/routes/review.ts`.
2. **Template-level approval.** The owner approves a template's preview once. Its instances then
   need the automated steps plus the batch sample. The approval is recorded on each instance as a
   passing `template-approval` check (`tool`: the reviewer role; `tool_version`:
   `<template id> v<version>`). A new template version needs a new approval.
3. **`set_text` source type**: a public-domain set text counts as an official source **for
   quotations only** (the words, who says them, where they occur). The item must also cite the
   board's set-text list for scope. Commentary about a text is not a quotation and needs its own
   citations.
4. **One named plain-text edition per set text**, fixed, with its SHA-256 recorded. Quotes are
   checked against that edition only.
5. **Fact tables.** Items generated from individually approved fact-table rows may be batch-sampled.
   Each item still runs the full pipeline.
6. **Board-neutral science calculations now.** Physics and chemistry calculations may be built from
   the DfE subject content (Open Government Licence) while AQA's answer on its AI terms is awaited.
7. **"Answers which round to" (awrt) is settled** for maths and science templates (no longer
   provisional in `docs/TEMPLATES.md`).
8. **Spreadsheet citations** use a "sheet, row, cell" location (`docs/VERIFICATION.md` section 9).
9. **Not decided here:** short quotes from in-copyright set texts and films go to the owner's
   solicitor. It stays open in `project_memory/operations/contradictions.md` and the owner's to-do
   list.
10. **Decided** (owner, 2026-11-26, after Oak's licence was confirmed below):
    - **In-house teaching notes** are approved individually at first. After 50 consecutive notes
      approved with no corrections, notes move to batch sampling at the same rule as fact-table
      items (10%, at least 30). Any correction resets the count to zero.
    - **Oak lessons published after 1 September 2022** (Open Government Licence v3.0) may be
      adapted as a **starting draft only**. Oak's required attribution is shown wherever adapted
      text appears, and nothing implies Oak endorses RevisionDen.
    - **Never used:** Oak content published before 1 September 2022, and anything Oak marks as
      third-party.
    - **Oak is never a citation source.** Every claim in a note is still cited to an official
      source under `docs/VERIFICATION.md`.
    - Not built yet: notes have no content schema. When it is added, it needs an
      `adapted_from` field (for example `oak`, with the lesson URL and publication date) that the
      validator refuses without the attribution statement, and refuses for a date before
      1 September 2022.

## Oak's licence: confirmed (read directly, 2026-11-26)

Source: Oak National Academy, Terms and conditions, https://www.thenational.academy/legal/terms-and-conditions
(HTML SHA-256 `58b15955b7d2568b299edd0da0f00a1232ebfa14f2d23623c51f437adee73a35`, which can change
on every fetch). Section on lesson content:

- **Collection 1** ("Lesson content originally published before 1st September 2022"): "made
  available to teachers on a revocable, non-exclusive, non-transferable, limited licence to use for
  non-commercial educational purposes". Not usable in RevisionDen.
- **Collection 2** ("Lesson content published after 1st September 2022, which is hosted on
  www.thenational.academy"): "made available to use under an Open Government Licence (OGL) v3.0,
  except where otherwise stated". Permitted uses listed: "copy, publish, distribute and transmit
  the content", "adapt the content", "exploit the content commercially and non-commercially for
  example, by combining it with other information, or by including it in your own product or
  application".
- **Attribution required**: "A [subject - English etc] lesson by Oak National Academy licensed
  under Open Government Licence (OGL)", plus a link to
  https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/.
- **Exclusions**: "Respect the rights of third parties for content which contains third-party
  copyright, trademarks or other licensing restrictions. So far as reasonably practicable, we have
  marked this content in the resource that is not covered by the OGL licence." Some resources are
  available only after signing in "Due to the terms of the licence we have with the rightsholder".
- **No endorsement**: users must not "say your organisation or website is associated with or
  endorsed by us".
- **Accuracy**: the terms say materials "may contain inaccuracies, errors and/or contain content
  which is not OGL compliant (Collection 2 lesson content only)". This supports the intended answer
  that Oak is never a citation source under `docs/VERIFICATION.md`.

Not read: Oak's "Guide to website licensing" on `support.thenational.academy` (still blocked), and
the OGL v3.0 text on `www.nationalarchives.gov.uk` (blocked). 11. **Readability warns, never blocks.** `textstat` scores notes and explanations; the aim is a
reading age of 13 to 14 for GCSE and 15 to 16 for A-Level (the A-Level figure is QG's
proposal, not stated by the owner). Subject terms from the specification are left out before
scoring.

## Consequences

- `docs/VERIFICATION.md`, `docs/TEMPLATES.md`, `docs/CONTENT_PLAN.md` and
  `project_memory/domain/product-facts.md` updated in the same change.
- The content schema allows the `template-approval` check name.
- Not built yet: the `set_text` source type in the schema and validator (with the set-text list
  citation rule), the spreadsheet location in `pnpm content:quote-check`, the fact-table pipeline,
  and the readability step. Until then the quote checker fails any location it cannot confirm, as
  now.
