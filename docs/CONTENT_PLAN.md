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
  "marks": 3,
  "mark_scheme": ["M1 correct factorisation", "A1 x = 1/3", "A1 x = -2"],
  "source_ref": "Specification A19",
  "checked_by": ["model-b", "maths-engine"]
}
```

The full schemas live in `content/schemas/` (workstream D).
