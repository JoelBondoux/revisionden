# Content run: GCSE Maths Higher, Pearson Edexcel 1MA1

> Live document. Step 1 (the pilot) and the plan for step 2 (scaling to every topic). The rules
> are in `VERIFICATION.md` and `CONTENT_PLAN.md`; the owner's review steps in `REVIEW_GUIDE.md`.

## Step 1: pilot results (workstream S2, 2026-11-25)

11 draft items in `content/items/gcse-maths-higher/pilot.json`, the mark scheme
`gcse-maths-ms-consecutive-integers-proof` and the topic tree. Results are recorded in each
file's `verification.checks`.

| Step                 | Result                                                                                                           |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1 Grounded writing   | 10 pass, 1 fail (G9, below). Audited after writing, since no writer record existed                               |
| 2 Quote check        | All 11 items and the mark scheme pass exactly. Topic tree: 95 of 97 exact, 2 near matches (A22, A25)             |
| 3 Blind answer       | **Not run**: no OpenAI or Gemini key is configured (the writer is Claude, so the blind answer can't be)          |
| 4 Adversarial review | **Not run**: no provider key is configured                                                                       |
| 5 Exact checks       | Maths engine passes all 7 maths items. No item has an `exact` block (units, equations), so nothing else to check |
| 6 Schema and links   | Pass                                                                                                             |
| 7 Human approval     | Waiting for steps 3 and 4                                                                                        |

**Per item**

| Item                    | Type            | Steps 1, 2, 5, 6                                                                                               | Still to do                                      |
| ----------------------- | --------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `gcse-maths-h-n7-0001`  | numeric         | pass                                                                                                           | 3, 4, 7                                          |
| `gcse-maths-h-r9-0001`  | numeric         | pass                                                                                                           | 3, 4, 7                                          |
| `gcse-maths-h-g17-0001` | numeric         | pass                                                                                                           | 3, 4, 7                                          |
| `gcse-maths-h-a18-0001` | worked_maths    | pass                                                                                                           | 3, 4, 7                                          |
| `gcse-maths-h-a17-0001` | worked_maths    | pass                                                                                                           | 3, 4, 7                                          |
| `gcse-maths-h-a4-0001`  | worked_maths    | pass                                                                                                           | 3, 4, 7                                          |
| `gcse-maths-h-a4-0002`  | worked_maths    | pass                                                                                                           | 3, 4, 7                                          |
| `gcse-maths-h-n4-0001`  | multiple_choice | pass (explanation arithmetic checked with SymPy)                                                               | 3, 4, 7                                          |
| `gcse-maths-h-g9-0001`  | short_answer    | **grounded writing fails**: the answer rests on a definition of a tangent that no quoted official source gives | owner ruling or an official source, then 3, 4, 7 |
| `gcse-maths-h-a18-0002` | flashcard       | pass (the formula on the back is typeset; the reviewer compares it with DfE page 14)                           | 3, 4, 7                                          |
| `gcse-maths-h-a6-0001`  | extended_answer | pass; three exemplars (top 3, middle 2, low 1 marks) added from the mark scheme for blind marking              | 3 (blind marking), 4, 7                          |

**Decisions needed**

1. **Provider key for steps 3 and 4.** Recommended: a Gemini API key saved as an environment
   network secret for `generativelanguage.googleapis.com` (header `x-goog-api-key`), then
   `VERIFY_GEMINI_MODEL=<model id> GEMINI_API_KEY=dummy pnpm content:model-check --blind gemini --review gemini --write`.
   `api.openai.com` and `gateway.ai.cloudflare.com` are blocked from content sessions, and
   `scripts/verify/providers.mjs` does not send the AI Gateway's `cf-aig-authorization` header.
2. **Two near-match quotes** (topic tree A22 and A25): a person compares them with the PDF page
   (`REVIEW_GUIDE.md`). On the rendered page both read word for word as quoted.
3. **Definitions in maths items (G9).** Either find an official source that states the
   definition, or rule that a standard definition may rest on the specification point plus
   individual human approval. This ruling decides how step 2 writes flashcards.

**Gaps found in the review queue (outside S2's paths)**

- No button or script creates a review batch: `POST /v1/review/batches` needs a signed-in
  reviewer and a snapshot of each item.
- ~~The batch page does not show hints, mark schemes, exemplars or the checks that passed.~~
  Fixed in S2: it shows them (the linked mark scheme from `mark_scheme_detail` in the snapshot).
- A reviewer role is a database row only (`reviewer_roles`); the owner needs one on dev.
- Topic trees and near-match quotes are not in the queue; they are confirmed with the lead.

## Step 2: scaling plan (not started; the lead starts it after the owner approves step 1)

**Similar-question retries (owner request, F is building them):** every learning point needs at
least 3 interchangeable items, and items carry `learning_point` (and, if F adds it,
`expected_seconds`). Neither field is in `content/schemas/item.schema.json` yet; F
owns that schema change and it must merge before writers use the fields.

**Before starting:** decisions 1 and 3 above are settled, F's schema change has merged, and a batch can be created for the
owner (gap 1).

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
every item with its topic and, where the topic is broader than one skill, a learning_point.
Add expected_seconds to each item if F's schema change has merged; otherwise leave it out.
Each interchangeable item goes through the pipeline on its own.

Sources: only Pearson's own documents for 1MA1 (specification, sample assessment materials,
past papers, mark schemes, examiner reports) and DfE or Ofqual. Get document URLs from the
board's site, never guess them. Past papers are cited, never copied: write original questions.
Never put board PDFs in the repo. No commercial revision sites. No personal data. Never invent
a fact, citation or quote. Cite only what a quote really supports; maths answers are backed by
the maths engine, not by the specification.

Run every item through the pipeline and record results with --write:
  pnpm content:validate                      (schema, links, maths engine)
  pnpm content:quote-check --write           (step 2)
  pnpm content:exact-check --write           (units and similar, where an `exact` block applies)
  pnpm content:model-check --blind gemini --review gemini --write   (steps 3 and 4)
Record grounded-writing yourself as you write. Fix and re-run anything that fails, or leave it
out with the reason in your PR. Never weaken a check to get a pass. Near-match quotes: list them
in the PR for a person to confirm. Keep items draft; the owner approves through the review
queue.

Green before PR: pnpm lint && pnpm typecheck && pnpm test:coverage && pnpm test:scripts.
When a topic set is done, message the lead (session <LEAD>) with: items per topic, any failures
and why, near matches, and anything the owner must decide.
```
