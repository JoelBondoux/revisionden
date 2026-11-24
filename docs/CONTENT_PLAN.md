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

1. **Topic tree.** Read the specification; write the tree as JSON with a specification reference
   on every leaf. Validate.
2. **Write items.** In subscription working sessions, generate items topic by topic from the
   specification text. Each item stores `source_ref` (spec point or mark scheme).
3. **Check items.** A second, different AI model independently answers each item; disagreements
   are flagged for review. Maths answers are checked by the maths engine.
4. **Validate.** `pnpm content:validate` must pass in CI (schema, IDs, links, maths answers).
5. **Spot-check.** A human samples 5% of each batch; any error rate above 1% sends the batch back.
6. **Release.** Content merges like code: pull request into `dev`.

## Keeping it right

- "Report a problem" on every item; reported items are hidden until reviewed.
- Items reported twice or failing the second check are removed automatically.
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

Item types: `multiple_choice`, `short_answer`, `numeric`, `worked_maths`, `flashcard`,
`extended_answer`. Maths items carry a `verify` block the maths engine can check:

- `numeric`: `verify.expression` is evaluated and compared with `answer.value` (exactly, or
  within `answer.tolerance` for rounded answers).
- `worked_maths`: `verify.method` is `solve` (`equation`, `variable`) compared with
  `answer.solutions`, or `expression` (`expression`, optional `form`: `factorised` or
  `expanded`) compared with `answer.expression`. Optional `steps` (a model solution) are checked
  line by line.

`checked_by` values: `maths-engine`, `model-b` (second AI model agreed), `human`, and `author`
(only the writing session checked it; needs `model-b` or `human` before release). Maths items
must include `maths-engine`.

## Validator

```bash
pip install -r services/maths/requirements.txt   # once, for maths answer checks
pnpm content:validate                             # schemas, ids, links, maths answers
pnpm content:validate --no-maths                  # schemas and links only (prints a warning)
MATHS_PYTHON=.venv/bin/python pnpm content:validate   # pick the Python that has SymPy
node --test 'scripts/content/*.test.mjs'          # validator tests
```

It fails on: schema errors, duplicate ids (across all files), items linked to a missing or
non-leaf topic, trees linked to a missing subject, missing mark schemes, multiple-choice answers
outside the options, maths items without `maths-engine`, and any maths answer or model solution
the engine does not confirm. Maths checks run locally by starting `python -m app.content_check`
in `services/maths`; CI runs the same in the `content` job.

## Pilot

GCSE Maths Higher, Pearson Edexcel 1MA1: `content/topic-trees/gcse-maths-edexcel-1ma1-higher.json`
(content references N1 to S6, one leaf each) and sample items in
`content/items/gcse-maths-higher/`.
