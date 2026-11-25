# Content plan

> Live document. How topic trees and question banks are built, checked and kept up to date.

## Initial subject set

| Level   | Subjects                                                                                                       |
| ------- | -------------------------------------------------------------------------------------------------------------- |
| GCSE    | English Language, English Literature, Maths, Biology, Chemistry, Physics, Drama, Film Studies, French, History |
| A-Level | Maths, Further Maths, Computer Science, Physics                                                                |

Exam boards and tiers are chosen in the app. Content is built only for the board and tier
combinations actually selected, starting with the subjects that need most help.

## What is built per subject

| Content                 | Target per subject        | Notes                                                     |
| ----------------------- | ------------------------- | --------------------------------------------------------- |
| Topic tree              | Every specification point | From the board's published specification                  |
| Quiz items              | 600 to 1,000              | Mixed types, every topic covered, difficulty tagged       |
| Flashcards              | 200 to 400                | Key terms, formulae, quotes, dates                        |
| Worked examples         | 1 to 3 per topic          | Step by step, for the lesson player                       |
| Command-word lessons    | Shared across subjects    | Explain, describe, evaluate, compare and so on            |
| Extended-answer prompts | 20 to 40                  | With mark-scheme-style level descriptors (essay subjects) |

Start smaller (about 500 items) and grow where students struggle.

## Sources (allowed)

- The exam board's published specification, sample assessment materials, past papers, mark
  schemes and examiner reports (used as references; past papers are linked, not copied).
- Required practical sheets.
- No content copied from commercial revision sites.

## Build process

Every item goes through the verification pipeline in [`VERIFICATION.md`](VERIFICATION.md) before
release. In short:

1. **Topic tree.** Read the specification; write the tree as JSON with a citation (specification
   point, quote and location) on every leaf. Validate.
2. **Write items.** In subscription working sessions, generate items topic by topic from the
   source excerpts only. Every claim carries a citation (at least one official citation per item).
3. **Verify.** Quote check against the source, blind answer by a different provider's model,
   adversarial review, exact checks (maths engine, units, equations), schema validation.
4. **Approve.** Human approval for each item, or a 10% sample per batch with zero defects allowed;
   items with no official source are always approved individually.
5. **Release.** Content merges like code: pull request into `dev`.

## Keeping it right

- "Report a problem" on every item; reported items are hidden until reviewed.
- Reported items are quarantined immediately; confirmed errors trigger a re-check of the whole
  batch and are recorded in `project_memory/misadventures/`.
- `pnpm content:audit` reports the citations and checks behind any item, topic or subject.
- When a board publishes a new specification, the affected subject is rebuilt and versioned
  (`spec_version` on topics and enrolments).

## Item format (summary)

```json
{
  "id": "gcse-maths-h-alg-quad-0042",
  "topic": "gcse-maths-h-alg-quadratics",
  "type": "worked_maths",
  "difficulty": 3,
  "prompt": "Solve 3x^2 + 5x - 2 = 0",
  "answer": { "solutions": ["1/3", "-2"] },
  "verify": { "method": "solve", "equation": "3x^2 + 5x - 2 = 0", "variable": "x" },
  "steps": ["3x^2 + 5x - 2 = 0", "(3x - 1)(x + 2) = 0", "x = 1/3 or x = -2"],
  "marks": 3,
  "mark_scheme": ["M1 correct factorisation", "A1 x = 1/3", "A1 x = -2"],
  "source_ref": "Pearson Edexcel GCSE Mathematics (1MA1) content reference A18",
  "checked_by": ["model-b", "maths-engine"]
}
```

## Schemas and folders

The full schemas (JSON Schema draft 2020-12) live in `content/schemas/`:

| Content      | Folder                  | Schema                    | Key rules                                                              |
| ------------ | ----------------------- | ------------------------- | ---------------------------------------------------------------------- |
| Subjects     | `content/subjects/`     | `subject.schema.json`     | Level GCSE or A-Level; boards with spec codes and tiers                |
| Topic trees  | `content/topic-trees/`  | `topic-tree.schema.json`  | At most 3 levels; every leaf has `spec_ref`; links to a subject        |
| Items        | `content/items/**`      | `item.schema.json`        | Files hold arrays; every item has `source_ref` and `checked_by`        |
| Mark schemes | `content/mark-schemes/` | `mark-scheme.schema.json` | `points` (M1, A1, B1) or `levels` (level descriptors with mark ranges) |

Optional on every item: `learning_point` (an id for the finer skill, e.g.
`gcse-maths-h-n7-lp-fractional-indices`; similar-question retries pick another item with the same
one, so write at least 3 per learning point) and `expected_seconds` (5 to 900, how long a
confident student takes; slower than twice this counts as shaky).

Item types: `multiple_choice`, `short_answer`, `numeric`, `worked_maths`, `flashcard`,
`extended_answer`. Maths items carry a `verify` block the maths engine can check:

- `numeric`: `verify.expression` is evaluated and compared with `answer.value` (exactly, or
  within `answer.tolerance` for rounded answers).
- `worked_maths`: `verify.method` is `solve` (`equation`, `variable`) compared with
  `answer.solutions`, or `expression` (`expression`, optional `form`: `factorised` or
  `expanded`) compared with `answer.expression`. Optional `steps` (a model solution) are checked
  line by line.

`checked_by` values: `maths-engine`, `model-b` (second AI model agreed), `human`, and `author`
(only the writing session checked it). It is a short summary; the full audit trail is the
`verification` record below. Maths items must include `maths-engine`.

### Citations and verification (see `docs/VERIFICATION.md`)

Shared definitions live in `content/schemas/common.schema.json`.

- **`citations`** (required, at least one) on every item, topic leaf, mark scheme and diagram.
  Each has `source_type`, `publisher`, `title`, `document_ref`, `url` (https), `location` and
  `supports` (`question`, `answer`, `explanation`, `hint`, `steps`, `mark_scheme`, `diagram`,
  `topic`, `front`, `back`, or `distractor:N` for wrong option N). `quote` (at most 50 words,
  verbatim) and `retrieved_at` (ISO date) go together. Optional `sha256` of the archived source.
  Never commit copies of board documents: the validator refuses PDFs and raster images in
  `content/`.
- Items whose citations are all `other_authoritative` must set `needs_human_approval: true`.
- **`verification`** (required) on every item, topic tree, mark scheme and diagram: `status`
  (`draft`, `verified`, `quarantined`, `retired`), integer `version`, `checks` (name, pass or
  fail, tool or model id, tool version, UTC time) and `reviewed_by` (a role, never a name).
- Check names are the pipeline steps: `grounded-writing`, `quote-check`, `blind-answer`,
  `adversarial-review`, `maths-engine`, `schema`, then `human-approval` or `batch-sample`.
  A `verified` item needs every step to pass (plus `maths-engine` for maths items), a quote in
  every citation, a reviewer role, and `human-approval` (not just `batch-sample`) when
  `needs_human_approval` is set. Topic trees, mark schemes and diagrams need `quote-check`,
  `schema` and a release check.
- Verified content is immutable: a change needs a higher `version`, and versions never go down.
  CI checks this against the base branch.
- **Diagrams** (`content/diagrams/`, `diagram.schema.json`): SVG drawn by code from verified
  `data`, with alt text, citations and verification. AI-generated and raster images are refused.
  Items point at them with `diagram_ref`.

Draft content may have citations without quotes yet (for example when the source still needs to
be read). The validator passes it but lists every entry that still needs sourcing; it can never
become `verified` without quotes.

## Validator

```bash
pip install -r services/maths/requirements.txt   # once, for maths answer checks
pnpm content:validate                             # schemas, ids, links, maths answers
pnpm content:validate --no-maths                  # schemas and links only (prints a warning)
pnpm content:validate --baseline <old content dir> # also refuse in-place edits to verified content
pnpm content:validate --report                    # audit summary for everything, as JSON
pnpm content:validate --audit <item, topic, tree or subject id>  # full audit trail (JSON)
MATHS_PYTHON=.venv/bin/python pnpm content:validate   # pick the Python that has SymPy
node --test 'scripts/content/*.test.mjs'          # validator tests
```

It fails on: schema errors, missing or empty citations, quotes over 50 words, distractor
citations that do not point at a wrong option, verified content missing quotes, checks or a
reviewer role, edits to verified content without a new version, PDFs or images in `content/`,
duplicate ids (across all files), items linked to a missing or
non-leaf topic, trees linked to a missing subject, missing mark schemes, multiple-choice answers
outside the options, maths items without `maths-engine`, and any maths answer or model solution
the engine does not confirm. Maths checks run locally by starting `python -m app.content_check`
in `services/maths`; CI runs the same in the `content` job.

## Pilot

GCSE Maths Higher, Pearson Edexcel 1MA1: `content/topic-trees/gcse-maths-edexcel-1ma1-higher.json`
(content references N1 to S6, one leaf each) and sample items in
`content/items/gcse-maths-higher/`. Every citation has been sourced from the official documents
(quote, page, `retrieved_at`, `sha256`); the record of what was read, what each citation backs
and what is still unsupported is in [`sourcing/gcse-maths-1ma1-pilot.md`](sourcing/gcse-maths-1ma1-pilot.md).
All pilot content is still `draft` until it passes the rest of the pipeline.

## Citation conventions (settled while sourcing the pilot)

- **`url`** points at the document itself (the PDF), not the qualification page, so the
  `sha256` refers to exactly that file. **`sha256`** is the hash of the file as fetched on
  `retrieved_at`; the private archive (once it exists) must store that same file.
- **`title`** is the title printed on the document; **`document_ref`** is the code plus the
  issue and date printed on it (for example `1MA1 Issue 2 (June 2015)`), not the PDF's
  modified date.
- **`location`** gives the heading path, the content reference and both page numbers: the page
  number printed on the page and the PDF page, for example
  `Higher tier knowledge, skills and understanding, 1. Number, Structure and calculation, content reference N7 (page 12; PDF page 24)`.
- **`quote`** is one contiguous, word-for-word run of text from that location, at most 50 words.
  Do not join pieces with ellipses. Typeset maths (superscripts, fractions, formulae) does not
  survive copying as text, so choose a run of plain words next to it instead, and check the
  quote against a rendered image of the page, not only against extracted text.
- **`supports`** names only the parts the quote itself backs. A specification quote shows the
  question is in scope for that tier (`question`, `topic`, `front`); it does not show that an
  answer is right. Maths answers, steps and worked values are backed by the maths engine (or,
  for types the engine does not check yet, an exact check recorded in the sourcing record).
  Definitions, hints, explanations and hand-written mark points that no official document
  states are listed as unsupported in the sourcing record, so review can see them.
