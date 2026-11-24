# Content

Topic trees (from official exam board specifications) and question banks, stored as JSON and
validated in CI. Owned by workstream D (see `docs/WORKSTREAMS.md`).

- No personal data here, ever.
- Every item records its source (specification point or mark scheme reference) and how it was
  checked (second model, maths engine, human).

| Folder          | Holds                                            | Schema                                 |
| --------------- | ------------------------------------------------ | -------------------------------------- |
| `subjects/`     | One file per subject (boards, spec codes, tiers) | `schemas/subject.schema.json`          |
| `topic-trees/`  | One tree per subject, board and tier             | `schemas/topic-tree.schema.json`       |
| `items/`        | JSON arrays of items, any sub-folder             | `schemas/item.schema.json` (each item) |
| `mark-schemes/` | Reusable mark schemes (points or levels)         | `schemas/mark-scheme.schema.json`      |

Check everything with `pnpm content:validate` (see `docs/CONTENT_PLAN.md`).
