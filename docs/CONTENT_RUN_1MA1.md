# Content run: GCSE Maths Higher, Pearson Edexcel 1MA1

> Live document. Step 1 (the pilot) and the plan for step 2 (scaling to every topic). The rules
> are in `VERIFICATION.md` and `CONTENT_PLAN.md`; the owner's review steps in `REVIEW_GUIDE.md`.

## Step 1: pilot results (workstream S2, 2026-11-25)

11 draft items in `content/items/gcse-maths-higher/pilot.json`, the mark scheme
`gcse-maths-ms-consecutive-integers-proof` and the topic tree. Results are recorded in each
file's `verification.checks`.

| Step                 | Result                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1 Grounded writing   | 11 pass (G9 under decision 0008). Audited after writing, since no writer record existed                                  |
| 2 Quote check        | All 11 items and the mark scheme pass exactly. Topic tree: 95 exact, 2 near matches (A22, A25) confirmed by the owner    |
| 3 Blind answer       | Gemini (`gemini-2.5-pro`): 11 pass (the A6 proof by blind marking, all three exemplars exact; A18-0002 by formula, #111) |
| 4 Adversarial review | Gemini: 11 pass, after fixing A4-0001 (see below)                                                                        |
| 5 Exact checks       | Maths engine passes all 7 maths items. No item has an `exact` block (units, equations)                                   |
| 6 Schema and links   | Pass                                                                                                                     |
| 7 Human approval     | **All 11 items ready** for the owner (A6 and G9 individually)                                                            |

**Per item**

| Item                    | Type            | Result                                                                                                                                                                                                                                                     |
| ----------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gcse-maths-h-n7-0001`  | numeric         | Ready for approval                                                                                                                                                                                                                                         |
| `gcse-maths-h-r9-0001`  | numeric         | Ready for approval                                                                                                                                                                                                                                         |
| `gcse-maths-h-g17-0001` | numeric         | Ready for approval                                                                                                                                                                                                                                         |
| `gcse-maths-h-a18-0001` | worked_maths    | Ready for approval                                                                                                                                                                                                                                         |
| `gcse-maths-h-a17-0001` | worked_maths    | Ready for approval                                                                                                                                                                                                                                         |
| `gcse-maths-h-a4-0001`  | worked_maths    | Ready, after two fixes from the adversarial review: a working step added (the steps showed none), and the mark scheme reworded as "B2 for 3x(2x + 3) (B1 for a partial factorisation …)" so the full answer clearly earns 2 marks. Re-checked from scratch |
| `gcse-maths-h-a4-0002`  | worked_maths    | Ready for approval                                                                                                                                                                                                                                         |
| `gcse-maths-h-n4-0001`  | multiple_choice | Ready (explanation arithmetic checked with SymPy)                                                                                                                                                                                                          |
| `gcse-maths-h-a6-0001`  | extended_answer | Ready; needs individual approval. Exemplars (top 3, middle 2, low 1 marks) written from the mark scheme; blind marking matched all three                                                                                                                   |
| `gcse-maths-h-g9-0001`  | short_answer    | Ready; needs individual approval. No official source defines a tangent, so it rests on the G9 spec point plus a standard definition under decision 0008 (owner, 2026-11-25)                                                                                |
| `gcse-maths-h-a18-0002` | flashcard       | Ready (#111): `back_formula` added, so the blind answer is compared by the maths engine. Gemini gave "x = (-b +- sqrt(b^2 - 4*a*c)) / (2*a) where a != 0": same formula, condition stated. Review re-run: no problems                                      |

**Decisions (settled by the owner, 2026-11-25)**

1. **Near-match quotes** (topic tree A22, A25): confirmed word for word; recorded as a human
   (content-lead) quote check.
2. **Definitions** (G9): decision 0008, a standard definition may rest on the spec point that names
   the term, with individual human approval.
3. **Formula flashcards** (A18-0002): compared by the maths engine (#111); A18-0002 re-run there and passes.

**How steps 3 and 4 run** (Gemini key saved as an environment network secret for
`generativelanguage.googleapis.com`, header `x-goog-api-key`; Node's fetch only uses the proxy
with `NODE_USE_ENV_PROXY=1`):

```bash
NODE_USE_ENV_PROXY=1 GEMINI_API_KEY=dummy VERIFY_GEMINI_MODEL=gemini-2.5-pro \
  pnpm content:model-check --blind gemini --review gemini --write
```

**Review queue**

- The batch page shows hint, mark scheme, exemplars and checks (S2, #108).
- "Create batch from draft items" for content leads on `/review` (S2, #109, migration 0018).
- A reviewer role is a database row (`reviewer_roles`); the lead adds the owner's on dev.
- Topic trees and near-match quotes are not in the queue; they are confirmed with the lead.

## Step 2: scaling plan (not started; the lead starts it after the owner approves step 1)

**Similar-question retries (owner request, F is building them):** every learning point needs at
least 3 interchangeable items. Items carry the optional `learning_point` (an id such as
`gcse-maths-h-n7-lp-fractional-indices`) and `expected_seconds` (5 to 900, the time a confident
student takes) in `content/schemas/item.schema.json`; F5 (#110) syncs and uses them.

**Before starting:** #111 (formula flashcards) and #109 (create batch
from draft items) has merged.

**Six writer sessions, one per area**

| Session | Area                                  | Topics    | Count | Items (5 to 8 a topic) |
| ------- | ------------------------------------- | --------- | ----- | ---------------------- |
| S3-N    | Number                                | N1 to N16 | 16    | 80 to 128              |
| S3-A    | Algebra                               | A1 to A25 | 25    | 125 to 200             |
| S3-R    | Ratio, proportion and rates of change | R1 to R16 | 16    | 80 to 128              |
| S3-G    | Geometry and measures                 | G1 to G25 | 25    | 125 to 200             |
| S3-P    | Probability                           | P1 to P9  | 9     | 45 to 72               |
| S3-S    | Statistics                            | S1 to S6  | 6     | 30 to 48               |

About 485 to 775 items in all, which fits the plan's first target of about 500. Geometry and
Statistics need code-drawn diagrams (`content/diagrams/`); those topics go last in their sessions.

**Batch size for the 10% rule: 300 items.** The sample is 10% of a batch but at least 30, so 300
is the size where the sample is exactly 10%; anything smaller still costs the owner 30 reviews.
Batches by area so one error only sends back related work:

| Batch | Areas               | About      | Owner reviews                  |
| ----- | ------------------- | ---------- | ------------------------------ |
| 1     | Number + Ratio      | 160 to 256 | 30, plus every extended answer |
| 2     | Algebra             | 125 to 200 | 30, plus every extended answer |
| 3     | Geometry            | 125 to 200 | 30, plus every extended answer |
| 4     | Probability + Stats | 75 to 120  | 30, plus every extended answer |

That is about 120 sampled reviews in all, plus each proof or extended answer individually.

**Prompt for each writer session** (replace `<ID>`, `<AREA>`, `<TOPICS>`):

```text
You are workstream <ID> for RevisionDen: write verified GCSE Maths Higher content for Pearson
Edexcel 1MA1, area <AREA>, topics <TOPICS>. Read CLAUDE.md and follow it exactly, then read
docs/VERIFICATION.md, docs/CONTENT_PLAN.md, docs/CONTENT_RUN_1MA1.md, content/README.md and
project_memory/misadventures/content-sourcing.md. The pilot (content/items/gcse-maths-higher/
pilot.json) is the model for format, citations and verification records.

Branch from dev as feature/<ID>-content. Only change content/items/gcse-maths-higher/<area>/**
(one file per topic, named after the spec reference, e.g. a17.json), content/diagrams/** for
your own diagrams, and your row in docs/WORKSTREAMS.md. Open a draft PR into dev. Don't merge it.

Work topic by topic, in spec order. For each topic write 5 to 8 original items (mixed types:
numeric, worked_maths, multiple_choice, short_answer; difficulty 1 to 5), 2 to 4 flashcards, and
at least one worked_maths item with full steps that can serve as a worked example. Add an
extended_answer (proof or "show that") only where the spec point asks for reasoning, with a
mark scheme in content/mark-schemes/ and three exemplars (top, middle, low).

Similar-question retries: every learning point needs at least 3 interchangeable items (same
skill, different numbers or context), so a student who gets one wrong can try another. Tag
every item with its topic and, where the topic is broader than one skill, a learning_point id
(<topic id>-lp-<short-name>, e.g. gcse-maths-h-n7-lp-fractional-indices). Give each item
expected_seconds (5 to 900): how long a confident student takes; slower than twice this counts
as shaky. Without it the app guesses by type (flashcard 15, multiple choice 20, numeric 40,
short answer 45, worked maths 120).
Each interchangeable item goes through the pipeline on its own.

Sources: only Pearson's own documents for 1MA1 (specification, sample assessment materials,
past papers, mark schemes, examiner reports) and DfE or Ofqual. Get document URLs from the
board's site, never guess them. Past papers are cited, never copied: write original questions.
Never put board PDFs in the repo. No commercial revision sites. No personal data. Never invent
a fact, citation or quote. Cite only what a quote really supports; maths answers are backed by
the maths engine, not by the specification.
If no official source defines a standard term, follow decision 0008
(project_memory/decisions/0008-definitions-policy.md): cite the spec point that names it, add the
standard definition, and set needs_human_approval: true.
If an item rests on a standard maths fact that no cited source states, follow decision 0009: list
it in facts (statement, a neutral ask, an engine check such as identity where the maths engine can
prove it, or citation N if an official quote states it) and run
  NODE_USE_ENV_PROXY=1 OPENAI_API_KEY=proxy-injected VERIFY_OPENAI_MODEL=gpt-5.4-2026-03-05 \
    GEMINI_API_KEY=dummy VERIFY_GEMINI_MODEL=gemini-2.5-pro \
    pnpm content:model-check --fact-check openai --write
A fact that fails keeps needs_human_approval: true.

Run every item through the pipeline and record results with --write:
  pnpm content:validate                      (schema, links, maths engine)
  pnpm content:quote-check --write           (step 2)
  pnpm content:exact-check --write           (units and similar, where an `exact` block applies)
  NODE_USE_ENV_PROXY=1 GEMINI_API_KEY=dummy VERIFY_GEMINI_MODEL=gemini-2.5-pro \
    pnpm content:model-check --blind gemini --review gemini --write   (steps 3 and 4)
Record grounded-writing yourself as you write. Fix and re-run anything that fails, or leave it
out with the reason in your PR. Never weaken a check to get a pass. Near-match quotes: list them
in the PR for a person to confirm. Keep items draft; the owner approves through the review
queue.

Green before PR: pnpm lint && pnpm typecheck && pnpm test:coverage && pnpm test:scripts.
When a topic set is done, message the lead (session <LEAD>) with: items per topic, any failures
and why, near matches, and anything the owner must decide.
```
