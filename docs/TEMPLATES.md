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

**Template approval and sampling (decision 0010).** The owner reads a template's preview
(`docs/TEMPLATE_PREVIEW.md`) and approves it once. The content session then records a passing
`template-approval` check on each of its items (`tool`: the reviewer role, `tool_version`:
`<template id> v<version>`, for example `gcse-maths-h-a4-double-brackets v1`). A batch made only of
such items, with their cross-check (`maths-engine`) passed, is sampled at 3%, at least 10; a mixed
batch keeps 10%, at least 30 (`docs/VERIFICATION.md` section 3). A new template version changes
its items, so they need a new approval. Science templates may use the DfE subject content
equations (board-neutral, Open Government Licence) while AQA's answer is awaited.

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

## Thin topics (T1c, 2026-11-26)

5 more templates, 5 items each, for topics with few items:

| Template                                 | Topic | Type           | Notes                                                       |
| ---------------------------------------- | ----- | -------------- | ----------------------------------------------------------- |
| `gcse-maths-h-a18-quadratic-factorising` | A18   | `worked_maths` | x^2 + bx + c = 0 with two different whole-number roots      |
| `gcse-maths-h-a25-linear-nth-term`       | A25   | `short_answer` | dn + c from four terms, going up or down                    |
| `gcse-maths-h-n10-recurring-decimal`     | N10   | `numeric`      | 0.ababab... as a fraction in its simplest form, by 100x - x |
| `gcse-maths-h-n5-product-rule`           | N5    | `worked_maths` | Starters, mains and desserts: the product rule for counting |
| `gcse-maths-h-a7-composite-function`     | A7    | `numeric`      | fg(k) or gf(k) with f linear and g(x) = x^2 + r             |

The recheck for N10 does long division of the answer; for N5 it counts the meals one by one.

## A-Level Computer Science, strand 1: data representation (S5, 2026-11-27)

OCR H446 (board confirmed by the owner). `app/templates/alevel_cs.py`, built with
`python -m app.templates.build --course alevel-cs` (part of `pnpm content:templates`) into
`content/items/alevel-computer-science/templated/`, 7 items per template; preview for the owner:
`docs/TEMPLATE_PREVIEW_CS.md`.

- Answers come from the CS engine (`app/cs/bases.py`, `app/cs/floating.py`). Each `recheck`
  reads the question text back and recomputes by another method (place values, Python's own
  integer conversions, digit tables, bit weights), so `GenerationError` stops any disagreement.
- Citations are the topic tree leaf's own citation (quote check passed), with `supports:
["question"]`; a test checks they match the tree word for word.
- Every question states the conventions it depends on (8 bits, two's complement, the floating
  point format), and a guard test fails if one does not.
- Hints and explanations that state a rule the specification does not state (two's complement
  place values, normalisation, shift and mask rules) list it in `facts` with a neutral `ask`, and
  the item sets `needs_human_approval: true` (decision 0009), until the fact-check stage can run.
- Denary answers are `numeric` items (marked by value, so 1.1250 is 1.125 and 034 is 34), with a
  place-value sum in `verify.expression` that the maths engine re-evaluates. Hexadecimal answers
  also accept `0x` and a leading 0. Binary answers stay `short_answer` and must show every bit.
- `build.py` now takes `--course` (`COURSES`); GCSE Maths Higher stays the default, unchanged.

| Template                                            | Topic   | Items | Facts (0009) |
| --------------------------------------------------- | ------- | ----- | ------------ |
| `alevel-cs-ocr-1-4-1-b-binary-to-denary`            | 1-4-1-b | 7     | no           |
| `alevel-cs-ocr-1-4-1-b-denary-to-binary`            | 1-4-1-b | 7     | no           |
| `alevel-cs-ocr-1-4-1-c-denary-to-sign-magnitude`    | 1-4-1-c | 7     | yes          |
| `alevel-cs-ocr-1-4-1-c-denary-to-twos-complement`   | 1-4-1-c | 7     | yes          |
| `alevel-cs-ocr-1-4-1-c-twos-complement-to-denary`   | 1-4-1-c | 7     | yes          |
| `alevel-cs-ocr-1-4-1-d-binary-addition`             | 1-4-1-d | 7     | no           |
| `alevel-cs-ocr-1-4-1-d-twos-complement-subtraction` | 1-4-1-d | 7     | yes          |
| `alevel-cs-ocr-1-4-1-e-denary-to-hexadecimal`       | 1-4-1-e | 7     | no           |
| `alevel-cs-ocr-1-4-1-f-binary-to-hexadecimal`       | 1-4-1-f | 7     | no           |
| `alevel-cs-ocr-1-4-1-f-hexadecimal-to-binary`       | 1-4-1-f | 7     | no           |
| `alevel-cs-ocr-1-4-1-f-hexadecimal-to-denary`       | 1-4-1-f | 7     | no           |
| `alevel-cs-ocr-1-4-1-g-denary-to-floating-point`    | 1-4-1-g | 7     | yes          |
| `alevel-cs-ocr-1-4-1-g-floating-point-to-denary`    | 1-4-1-g | 7     | yes          |
| `alevel-cs-ocr-1-4-1-g-normalise-floating-point`    | 1-4-1-g | 7     | yes          |
| `alevel-cs-ocr-1-4-1-h-floating-point-addition`     | 1-4-1-h | 7     | yes          |
| `alevel-cs-ocr-1-4-1-i-masks`                       | 1-4-1-i | 7     | yes          |
| `alevel-cs-ocr-1-4-1-i-shifts`                      | 1-4-1-i | 7     | yes          |

## A-Level Computer Science, strand 2: Boolean algebra (S5, 2026-11-27)

`app/templates/alevel_cs_boolean.py`, joined to `alevel_cs.TEMPLATES`, so the same build and
preview make it. 9 templates, 7 items each, for 1.4.3 (a) to (e).

- Answers come from the CS engine (`app/cs/logic.py`: truth tables, `simplify`, Karnaugh maps,
  `full_adder`). Each `recheck` reads the question back and checks it without `app.cs.logic`:
  its own evaluator built on Python's `ast` module (OCR's binding, NOT, AND, XOR, OR, is Python's
  for `~ & ^ |`), the shapes of the two expressions for the named rules, binary arithmetic for the
  full adder and an edge-by-edge simulation for the flip-flop.
- A Boolean expression cannot be marked as text (one function has many right forms), so a
  question asks for something with one right form: a column of bits, one bit, a count, or one of
  four options (`multiple_choice`) where exactly one is equivalent to what the question
  describes. Wrong options are near misses (a literal negated, a term dropped, AND and OR
  swapped), each checked not to be equivalent.
- Questions state what they depend on: truth table rows in counting order, top row first;
  Karnaugh map rows and columns in the order 00, 01, 11, 10; when a D type flip-flop changes.
- `core.make_item` now copies `options`; the preview shows them with the right one in bold.
- A Karnaugh map question asks for the simplest sum of products (a factored form can have fewer
  letters). Every item that uses OCR's symbols lists what they mean as a fact (decision 0009).

| Template                                           | Topic   | Type              | Facts (0009) |
| -------------------------------------------------- | ------- | ----------------- | ------------ |
| `alevel-cs-ocr-1-4-3-a-define-a-problem`           | 1-4-3-a | `multiple_choice` | yes          |
| `alevel-cs-ocr-1-4-3-b-simplify-expression`        | 1-4-3-b | `multiple_choice` | yes          |
| `alevel-cs-ocr-1-4-3-b-karnaugh-map-three-letters` | 1-4-3-b | `multiple_choice` | yes          |
| `alevel-cs-ocr-1-4-3-b-karnaugh-map-four-letters`  | 1-4-3-b | `multiple_choice` | yes          |
| `alevel-cs-ocr-1-4-3-c-de-morgan`                  | 1-4-3-c | `multiple_choice` | yes          |
| `alevel-cs-ocr-1-4-3-c-name-the-rule`              | 1-4-3-c | `multiple_choice` | yes          |
| `alevel-cs-ocr-1-4-3-d-truth-table`                | 1-4-3-d | `short_answer`    | yes          |
| `alevel-cs-ocr-1-4-3-e-full-adder`                 | 1-4-3-e | `short_answer`    | yes          |
| `alevel-cs-ocr-1-4-3-e-d-type-flip-flop`           | 1-4-3-e | `short_answer`    | yes          |

## Later

- Fresh numbers per student at run time (the engine serves a new seed per attempt, marked against
  its own computed answer): `docs/BACKLOG.md` T1.
- More templates for thin Algebra and Number topics.

## Design: physics and chemistry calculation templates (not built)

> Design only (T1, 2026-11-26). No science template or item exists yet. Nothing here is a
> product fact until it is built and recorded in `project_memory/`.

The same idea carries over to science calculations: an answer built from the parameters and
cross-checked independently before anything is written. Science adds three things maths does
not have: **units**, **data that must come from the board** (equations, constants, relative
atomic masses) and **rounding to the data given**.

### Before any science template is written

1. **Sourced data first.** A template may only use an equation from a verified equation sheet
   (`content/equation-sheets/`, checked by `scripts/verify/exact/equation-sheet.mjs`) and
   constants or relative atomic masses from a cited board data sheet stored as content. No
   template carries a hand-typed constant or equation. If the board's sheet is not sourced
   yet, the template waits.
2. **A topic with items.** The citation rule is the same as for maths: reuse a quote, location
   and SHA-256 already used by items in the same topic (the citation-reuse test). So a topic
   needs hand-written, quote-checked items first.
3. **The libraries.** Add `pint` (units, BSD-3-Clause) and `chempy` (equation balancing,
   BSD-2-Clause) to `services/maths/requirements.txt` with pinned versions, as recommended in
   `docs/research/specialist-tools-2026-11.md`. Neither may read untrusted input: templates only
   feed them our own parameters, never student text.

### Parameters

- **`QuantityParam(name, low, high, step, unit)`**: a measured value, for example a mass from 0.5
  to 20.0 kg in steps of 0.5. Values are held as exact fractions (`Fraction`), never floats, so
  rounding is decided exactly. `pint` is created with `UnitRegistry(non_int_type=Fraction)` so
  unit conversions stay exact too.
- **Given-data precision** comes from `step` (0.5 kg is given to 1 decimal place), and is what
  the "give your answer to N significant figures" wording is based on.
- **Rules** add physical sense on top of the maths rules: an efficiency no more than 1, a
  speed well below the speed of light, a concentration a solution could really have, an answer
  that does not round to 0 at the accuracy asked for. Each rule is a plain-English `Rule`, as
  now.
- **Contexts** (a car, a kettle, a lift) come from a short reviewed list per template. Each
  context names the quantity it uses, so a context cannot be paired with a quantity it does
  not fit.

### Writing an item

- `write` takes the equation by its sheet id (`exact.equation_sheet` on the item, written as the
  sheet writes it), rearranges it with SymPy for the unknown, converts every given value to SI
  base units with `pint` (kJ to J, g to kg, cm³ to dm³), substitutes, and rounds half up to the
  significant figures asked for.
- Items are `numeric` with `answer.unit`, `answer.significant_figures` (or `decimal_places`) and
  `exact.quantity` (for example `energy`). The existing units check
  (`scripts/verify/exact/units.mjs`) then confirms the unit has that dimension.
- The worked steps (in the explanation, since `numeric` items have no `steps` field) follow the
  usual order: equation, unit conversions, substitution, rearrangement, value, rounding. Every
  number in them comes from the same exact computation.
- Units and symbols are written the way the board's equation sheet writes them, read from the
  sheet, not chosen by the template.

### Chemistry specifics

- **Balanced equations**: `exact.chemical_equation` is checked by
  `scripts/verify/exact/chemistry.mjs` (atoms, charge, lowest terms). The template balances with
  ChemPy's `balance_stoichiometry`. That gives two independent balancers, which must agree.
- **Relative formula mass**: ChemPy may parse a formula and count atoms, but its atomic masses
  are not the board's. Masses always come from the board's cited data table. A test fails if any
  value in the template does not match that table.
- First candidates, once sourced: moles from mass and Mr, reacting masses from a balanced
  equation, concentration in mol/dm³ or g/dm³, and percentage yield.

### The cross-check

A science instance is written only if all of these agree:

1. the maths engine content checks (`value` with `significant_figures` or `decimal_places`);
2. the exact checks: units (`exact.quantity`), the equation sheet (`exact.equation_sheet`) and,
   for chemistry, the balanced equation;
3. the template's `recheck`. It reads the numbers and units back from the question text,
   converts them by hand to SI with a small table of prefixes (not `pint`), and recomputes with
   the sheet equation solved by SymPy. It also checks that the dimensions of the formula give
   the answer unit (`pint` dimensionality).

### Risks and rulings

- **Rounding of intermediate values.** Settled (owner, decision 0010, 2026-11-26): follow the exam boards' "awrt" (answers which round to) convention. Accept
  a final answer within the range that rounding the intermediate values to the item's stated
  accuracy can produce. The template computes that range exactly for each instance, never as a
  blanket percentage, and the recheck recomputes it independently.
- **Board conventions differ** (constants, units such as m/s or m s⁻¹, "show that" questions).
  Templates are per board and per specification, never shared across boards.
- **Required practicals and graphs** are out of scope for calculation templates.

### Tasks (when the owner approves scaling up)

1. Source one board's physics equation sheet and data sheet, and one chemistry data table, as
   verified content.
2. Add `QuantityParam`, the `pint` and `chempy` dependencies, and a units-aware recheck helper,
   with tests that a wrong unit, a wrong prefix and a wrong rounding are each caught.
3. Pilot: 3 physics templates (for example kinetic energy, density, power) and 2 chemistry
   templates (moles from mass, concentration), 5 instances each, through the usual pipeline and
   the owner's review queue.
