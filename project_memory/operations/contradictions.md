# Contradictions

> Where project memory, docs and code disagree and it was not settled in the same change.
> Add a `- [ ]` line naming both sides, the paths and why it was not settled. Tick when resolved.

## Open

- [ ] Extended-answer items can never be verified: `scripts/content/validate.mjs` requires a
      passing `blind-answer` check for every verified item, but an extended answer has no single
      answer to compare, so `scripts/verify/blind-answer.mjs` always fails it ("needs human
      approval"). Not settled by workstream V because it is a protocol decision for the product
      owner (`docs/VERIFICATION.md` section 3): for example, let human approval stand in for the
      blind answer on extended answers, or define a blind-marking check against the mark scheme.

## Resolved
