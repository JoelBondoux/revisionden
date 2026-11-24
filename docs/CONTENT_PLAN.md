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
  "marks": 3,
  "mark_scheme": ["M1 correct factorisation", "A1 x = 1/3", "A1 x = -2"],
  "source_ref": "Specification A19",
  "checked_by": ["model-b", "maths-engine"]
}
```

The full schemas live in `content/schemas/` (workstream D).
