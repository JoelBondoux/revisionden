# Evaluations

Measures AI marking against golden sets with known marks (pass bars in `docs/AI.md`). These
call real models and cost money, so they **never run in CI by default**: `pnpm evals` needs
`--live`, and refuses to run when `CI` is set unless `--allow-ci` is given.

The unit tests here (`*.test.mjs`) use fake markers only and do run in CI (`pnpm test:scripts`).

## Essay marking (double AI marking)

```bash
pnpm evals essay --golden evals/golden/essays.json --markers anthropic,openai --live
```

Each answer is marked twice, independently (`packages/core/src/double-marking.ts`). A result
counts as within the bar when it is marked and within one level of the known level; a
"check with your teacher" result counts as a miss. The run fails if fewer than 90% are within one
level, any result lacks the AI label, or any disagreement of more than one level was given a mark.

Keys and model ids come from the environment (keep them in `.dev.vars`, never in git):
`ANTHROPIC_API_KEY` + `VERIFY_ANTHROPIC_MODEL`, `OPENAI_API_KEY` + `VERIFY_OPENAI_MODEL`,
`GEMINI_API_KEY` + `VERIFY_GEMINI_MODEL`.

## Fact-check judge

```bash
pnpm evals fact-judge --golden evals/golden/fact-judge.json --judge gemini --live
```

Runs the fact-check judge prompt (`scripts/verify/fact-check.mjs`) on pairs of fact statements.
Every pair that differs in meaning must be refused, and at least 90% of same-fact pairs accepted.
The set holds pairs recorded in the S3-A fact-check run and pairs written to differ; maths facts
only.

## Golden sets

Golden sets live in `evals/golden/` and are written by the sourcing session, not by build
sessions. They contain anonymised or synthetic answers only: no real names, schools or any
personal data. Format (`essays.json`):

```json
{
  "scheme": { "type": "levels", "levels": [{ "level": 1, "marks": [1, 3] }] },
  "cases": [{ "id": "essay-0001", "question": "...", "answer": "...", "knownLevel": 1 }]
}
```

`evals/fixtures/` holds tiny synthetic sets for the harness tests; they are not golden sets.
