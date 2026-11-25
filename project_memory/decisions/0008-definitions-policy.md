# 0008: Standard definitions with no official source

- Status: accepted (product owner, confirmed directly to workstream S2, 2026-11-25)
- Date: 2026-11-25

## Context

The verification pipeline (`docs/VERIFICATION.md`) fails grounded writing when any claim lacks a
citation. Exam board specifications often name a term without defining it. For example, the
Pearson Edexcel 1MA1 specification (G9) lists "tangent" among the circle terms but never says what
a tangent is, and the DfE GCSE maths subject content doesn't define it either. Pilot item
`gcse-maths-h-g9-0001` ("a straight line that touches a circle at exactly one point") failed
grounded writing for this reason (workstream S2).

## Decision

- Where no official source defines a standard term, an item may rest on **the specification point
  that names the term**, cited with its quote, **plus a standard definition**.
- Such an item must set `needs_human_approval: true`. A person approves it individually in the
  review queue, so it is never released through batch sampling.
- Grounded writing passes for that claim only on this basis, and its notes cite this decision.
- An official definition, where one exists, is always preferred and cited instead.

## Consequences

- `gcse-maths-h-g9-0001` carries `needs_human_approval: true` and passes grounded writing under
  this decision.
- Review batches always include these items (the sample adds every item that needs human
  approval).
- Writer sessions follow this decision for definition flashcards and short answers
  (`docs/CONTENT_RUN_1MA1.md`).
