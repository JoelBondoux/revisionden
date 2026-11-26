# Maths question templates

> Live document (workstream T1). How the maths engine writes maths questions from templates, so
> every answer is correct by construction, and how to add a template.

## Why templates

A hand-written maths item can carry a slip in its answer, its steps or its explanation. A
template is a small Python recipe that builds all of them from the same numbers with SymPy, then
has the maths engine check the result two independent ways. A wrong item cannot be written: the
build stops instead. The owner still reviews every item through the normal queue.

## How it works

Code: `services/maths/app/templates/` (`core.py`, `text.py`, `gcse_maths_higher.py`,
`build.py`). Tests: `services/maths/tests/test_templates.py`.

A template (`Template` in `core.py`) has:

| Part                        | What it is                                                                                                                                                            |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`, `version`             | For example `gcse-maths-h-a17-unknown-both-sides`, version 1. Change `version` whenever the wording or maths changes.                                                 |
| `topic`, `learning_point`   | An existing leaf topic and learning point                                                                                                                             |
| `params`                    | Typed whole-number parameters: `IntParam(name, low, high, exclude=(0,), step=1)`                                                                                      |
| `rules`                     | Plain-English constraints such as "the right-hand number is not zero" or "neither bracket has a common factor". A draw that breaks a rule is thrown away and redrawn. |
| `write(params)`             | Builds the question text, answer, `verify`, worked `steps`, hint, explanation and mark scheme from the parameters, using SymPy                                        |
| `recheck(params, item)`     | The independent check (below)                                                                                                                                         |
| `type`, `marks`, difficulty | Marking settings in the normal item schema (`numeric`, `worked_maths`, `short_answer`, with `any_order`, `unit` and so on)                                            |
| `source_ref`, `citations`   | The board, specification point and an official citation. Copied exactly from items already in the same topic whose quote check passed. Never write a new one here.    |

**Seeds.** `draw_params(template, seed)` is deterministic: the same template, version and seed
always give the same item. `generate` uses seeds 1, 2, 3, ... and skips a seed whose question
repeats an earlier one or a hand-written item already in the bank. Each item records
`"template": {"id", "version", "seed"}` (in `content/schemas/item.schema.json`).

**The cross-check.** Before an item is accepted, `cross_check` runs:

1. **The content checks** (`app/content_check.py`, the same code `pnpm content:validate` runs in
   CI): the answer against `verify`, the form (for example expanded), and every line of the
   worked steps.
2. **The template's `recheck`**, which does not trust `write`: it reads the question text back
   with the engine's parser, confirms it shows the parameters' maths, and recomputes the answer
   another way (whole-number formulas, exact fractions, solving the equations shown).

Any disagreement raises `GenerationError` and nothing is written. Tests prove a wrong answer, a
wrong step, question text that disagrees with its numbers, and a non-standard-form answer are
each caught.

## Build and review

```bash
pnpm content:templates   # writes content/items/gcse-maths-higher/templated/*.json and docs/TEMPLATE_PREVIEW.md
```

- One file per template, 5 items each. Items start as `draft` with two checks recorded:
  `grounded-writing` (the template, from the cited specification point) and `maths-engine` (the
  cross-check). They then go through the normal pipeline like any other item: `pnpm
content:quote-check --only <id> --write`, `pnpm content:model-check --blind gemini --review
gemini --only <id> --write`, `pnpm content:validate`, then the owner's review queue
  (`docs/REVIEW_GUIDE.md`).
- A rebuild keeps the review record (`verification`, `checked_by`) of every item whose content
  is unchanged, so pipeline results survive. A changed item gets a new draft version and must go
  through the pipeline again.
- `python -m app.templates.build --check` (in pytest, so CI) fails if the committed files differ
  from a fresh generation. Never edit template items by hand: change the template and rebuild.
- `docs/TEMPLATE_PREVIEW.md` lists every question with its answer, steps, explanation and checks,
  for the owner to read.

## Add a template

1. Pick an existing leaf topic in `content/topic-trees/` that already has items, and copy one of
   their citations (same `location`, `quote`, `sha256`). A test fails if the citation is not
   already used in that topic.
2. Write a failing test in `tests/test_templates.py` (at least: a deliberately broken version of
   the template is caught).
3. Add the `Template` to `gcse_maths_higher.py` (or a new module for another course) and to
   `TEMPLATES`. Keep wording in the style of the existing items in the topic; use `text.py` to
   write terms (`3x - 5`, `x^2 + 2x - 15`) so the engine can read them back.
4. Write `recheck` by a different method from `write`. Read the question text back rather than
   trusting the parameters.
5. Add rules until every draw is a fair exam-style question (no zero coefficients, whole-number
   answers, no common factors, sizes a student can do without a calculator where that applies).
6. `pnpm content:templates`, read the preview, then run the pipeline.

## Pilot (2026-11-26)

GCSE Maths Higher, Pearson Edexcel 1MA1: 5 templates, 25 items.

| Template                                 | Topic | Type           | Notes                                              |
| ---------------------------------------- | ----- | -------------- | -------------------------------------------------- |
| `gcse-maths-h-a4-double-brackets`        | A4    | `worked_maths` | (ax + p)(bx + q), x term never cancels             |
| `gcse-maths-h-a17-unknown-both-sides`    | A17   | `worked_maths` | ax + b = cx + d, whole-number solution             |
| `gcse-maths-h-a19-elimination`           | A19   | `short_answer` | Linear pair, y eliminated by adding or subtracting |
| `gcse-maths-h-n12-percentage-change`     | N12   | `numeric`      | Increase or decrease a price with a multiplier     |
| `gcse-maths-h-n9-standard-form-multiply` | N9    | `worked_maths` | (A × 10^m) × (B × 10^n), answer with 1 ≤ A < 10    |

Percentage change sits under N12 ("interpret fractions and percentages as operators"), where the
bank already has a multiplier item, because R9 has no items or citation yet. `numeric` and
`short_answer` items have no `steps` field, so their worked steps are written out in the
explanation.

## Later

- Fresh numbers per student at run time (the engine serves a new seed per attempt, marked against
  its own computed answer): `docs/BACKLOG.md` T1.
- More templates for thin Algebra and Number topics.
