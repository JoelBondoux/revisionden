# 0009: A fact-check stage for standard maths facts

- Status: accepted by the product owner in the lead session ("Keep them in, but have a third
  review stage"), relayed to workstream S2 by the lead, 2026-11-25
- Date: 2026-11-25

## Context

Decision 0008 covers standard definitions that no official source states. Writer sessions also
need items that rest on a standard maths fact rather than a definition (for example "the gradients
of perpendicular lines multiply to -1", or "a tangent is perpendicular to the radius"). The
specification names the topic but does not state the fact, so grounded writing has no quote for it.

## Decision

- Such items stay in. They list each fact in `facts` (`statement`, a neutral `ask`, an optional
  maths engine check `engine`, an optional `citation` number) and must pass a **fact-check stage
  (step 4b)** before human review. Per fact:
  - **(a) Official source:** a citation, counting from 1, whose quote check passed (the quote is
    really in the source) and whose quote the judge confirms states the fact, not just its topic.
    Then it is an ordinary cited fact. Only the judge is called, and if it says no, the fact falls
    back to (b) and (c).
  - **(b) Maths engine proof:** an `engine` check that proves it (for example `identity`: an
    equation true for every value). Facts the engine cannot express are recorded as unprovable.
  - **(c) Third-provider blind statement:** a provider that is neither the writer nor the blind
    answerer (OpenAI by default) answers the neutral question without seeing our wording. Another
    provider (Gemini by default) judges that both state the same fact. Every answer must be given
    with high confidence.
- A fact passes with (a), or with both (b) and (c). An item whose facts all pass goes into normal
  batches (10% sampling).
- An item with a fact that fails or cannot be proved keeps `needs_human_approval: true` and is
  approved individually. The `fact-check` record's notes say what failed.
- A maths engine proof only proves the equation the writer supplied. The adversarial review and
  the human reviewer check that the equation really captures the fact.
- Cost: only items that list `facts` are sent, and a fact with an official citation calls only the
  judge.

## Consequences

- `pnpm content:model-check --fact-check openai [--fact-judge gemini]` runs the stage
  (`scripts/verify/fact-check.mjs`); the maths engine has an `identity` check kind.
- The validator requires a `fact-check` record on verified items with `facts`. A failed one is
  allowed only with `needs_human_approval` and a passing `human-approval`.
- The review batch readiness rule (#109) must treat a failed fact-check as "individual review",
  not "not ready".
