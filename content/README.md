# Content

Topic trees (from official exam board specifications) and question banks, stored as JSON and
validated in CI. Owned by workstream D (see `docs/WORKSTREAMS.md`).

- No personal data here, ever.
- Every item records its source (specification point or mark scheme reference) and how it was
  checked (second model, maths engine, human).

| Folder             | Holds                                                                                                                                                              | Schema                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `subjects/`        | One file per subject (boards, spec codes, tiers)                                                                                                                   | `schemas/subject.schema.json`                                                    |
| `topic-trees/`     | One tree per subject, board and tier                                                                                                                               | `schemas/topic-tree.schema.json`                                                 |
| `items/`           | JSON arrays of items, any sub-folder                                                                                                                               | `schemas/item.schema.json` (each item)                                           |
| `mark-schemes/`    | Reusable mark schemes (points or levels)                                                                                                                           | `schemas/mark-scheme.schema.json`                                                |
| `learn-links/`     | One file per topic, `<topic id>.json`: "Learn it first" links to Oak National Academy and BBC Bitesize (title, URL, provider, level, optional board, `checked_at`) | `schemas/learn-links.schema.json`; `pnpm content:check-links` requests every URL |
| `equation-sheets/` | Official equation sheets, with citations                                                                                                                           | checked by `pnpm content:exact-check`                                            |

Check everything with `pnpm content:validate` (see `docs/CONTENT_PLAN.md`). The verification
tools (`pnpm content:quote-check`, `content:model-check`, `content:exact-check`,
`content:audit`) are described in `docs/VERIFICATION.md` section 9.
