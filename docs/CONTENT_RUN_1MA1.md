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
| `gcse-maths-h-a18-0002` | flashcard       | Ready (#111): `back_formula` added, so the blind answer is compared by the maths engine. Gemini gave "x = (-b +- sqrt(b^2 - 4*a*c)) / (2\*a) where a != 0": same formula, condition stated. Review re-run: no problems                                     |

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
When a question asks for rounding ("to 2 decimal places", "to 3 significant figures", "to the
nearest whole number"), set answer.decimal_places or answer.significant_figures (not tolerance)
and write answer.value to exactly that accuracy. When the answer is the value of a letter or
function ("make t the subject", "find f^-1(x)"), set answer.subject (e.g. "t" or "f^-1(x)") so
answers written "t = ..." are accepted.
Short answers need only one written form: spaces, capitals, minus signs, × or *, ÷, superscripts,
≤ and √ are matched automatically. Set answer.any_order: true when order does not matter (a
product, a sum, a list of values, x = 3, y = 2), and answer.units for units the answer may add
(e.g. ["cm"]). Still list different forms of the value (√32 and 4√2, three and 3).
Each interchangeable item goes through the pipeline on its own.
Every item needs an "Explain" walkthrough (F7): an `explanation` of one to four short sentences
that a Year 10 to 12 student can follow, saying why the answer is right. For a calculation, also
give the working: `steps` on worked_maths (each line is checked by the maths engine); for
numeric, short_answer and flashcard items, put the working in the explanation itself ("Brackets
first: 8 - 2 = 6. ..."). Check every number in an explanation with exact arithmetic and say how
in the grounded-writing note. Explanations go through the same pipeline as the rest of the item
(the adversarial review reads them), and a standard fact they state follows decisions 0008 and 0009.

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

## Step 2 progress: S4 Probability (P1 to P9, 2026-11-27)

95 draft items in `content/items/gcse-maths-higher/probability/` (p1.json to p9.json): 49 numeric,
2 worked maths, 15 multiple choice, 2 short answer and 27 flashcards. Citations quote the P points on
page 19 (PDF page 31). Where a term needs a definition (relative frequency), the question states it,
so the item does not rest on an unsourced definition.

| Step                 | Result                                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| 2 Quote check        | 95 pass, all exact                                                                                        |
| 3 Blind answer       | OpenAI: 89 pass. 6 fail: 4 flashcards where the model wrote its working ("3/30 = 0.1"), 1 wording, 1 slip |
| 4 Adversarial review | OpenAI: 76 pass. 19 fail, mostly "unsupported claim" (set notation, dice outcomes, scale words)           |
| 4b Fact check        | Not run (needs Gemini): 27 items list `facts` (independence, equally likely outcomes)                     |
| 5 Maths engine       | All 51 numeric and worked items pass                                                                      |
| 6 Schema and links   | Pass                                                                                                      |

Flashcard blind answers are compared word for word, so a correct answer with working shown fails;
p9-0107's blind answer (9/58) is an arithmetic slip by the model (18/117 = 2/13).

## Step 2 progress: S4 (Ratio, Geometry, Probability, Statistics)

**Ratio, R1 to R16 (2026-11-27).** 185 draft items in `content/items/gcse-maths-higher/ratio/`
(r1.json to r16.json): 88 numeric, 13 worked maths, 22 multiple choice, 14 short answer and 48
flashcards, with at least 3 items per learning point. Citations quote the R points on page 16
(PDF page 28) of the specification; the R13 sentence "X is inversely proportional to Y is
equivalent to X is proportional to 1/Y" is quoted only up to "proportional to", because the PDF
text breaks the fraction.

| Step                 | Result                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| 2 Quote check        | 185 pass, all exact                                                                                           |
| 3 Blind answer       | OpenAI `gpt-5.4-2026-03-05` (Gemini returned 429: monthly spend cap): 185 pass                                |
| 4 Adversarial review | OpenAI: 174 pass. 11 fail on "unsupported claim": unit, scale, tangent and proportion definitions (see below) |
| 4b Fact check        | Not run: 15 items list `facts`; the stater must differ from the writer and from OpenAI, so it needs Gemini    |
| 5 Maths engine       | All 101 numeric and worked items pass                                                                         |
| 6 Schema and links   | Pass                                                                                                          |

The 11 review failures (r1-0101, r1-0109, r1-0111, r2-0109, r2-0110, r11-0111 to r11-0113,
r12-0110, r13-0110, r14-0110) rest on a standard unit or definition that no allowed source states
(1 litre = 1000 ml, what a scale 1 : n means, speed, density and pressure as compound measures).
41 items set `needs_human_approval` under decision 0008 for the same reason. Writing notes: decimals
raised to powers are written as fractions in `verify` (`(103/100)^2`), because the engine reads
`1.03^2` inexactly; worked items whose answer is a sum of money ask for a letter (`£x`), because the
blind comparison of worked expressions is exact text.

## Step 2 progress: S4 Probability (P1 to P9, 2026-11-27)

95 draft items in `content/items/gcse-maths-higher/probability/` (p1.json to p9.json): 49 numeric,
2 worked maths, 15 multiple choice, 2 short answer and 27 flashcards. Citations quote the P points on
page 19 (PDF page 31). Where a term needs a definition (relative frequency), the question states it,
so the item does not rest on an unsourced definition.
Flashcard blind answers are compared word for word, so a correct answer with working shown fails;
p9-0107's blind answer (9/58) is an arithmetic slip by the model (18/117 = 2/13).
