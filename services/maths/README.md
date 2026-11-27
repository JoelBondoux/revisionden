# Maths engine

Exact maths checking with SymPy (no AI), served by FastAPI on Google Cloud Run.

## Endpoints

| Method and path       | Body                                                          | Returns                                                    |
| --------------------- | ------------------------------------------------------------- | ---------------------------------------------------------- |
| `GET /health`         |                                                               | `{"status": "ok"}`                                         |
| `POST /equivalent`    | `{"a": "2(x+3)", "b": "2x+6"}`                                | `{"equivalent": true}`                                     |
| `POST /solutions`     | `{"expression": "x^2 = 4", "answers": ["2", "-2"]}`           | `{"correct": true}`                                        |
| `POST /check-working` | `{"lines": ["2x + 3 = 7", "2x = 4", "x = 2"], "expected": …}` | `{"first_wrong_line": null, "final_answer_correct": true}` |

`/check-working` takes up to 50 ordered lines. `first_wrong_line` is the 0-based index of the
first line that does not follow from the line before (`null` when every step is right).
`expected` is optional:

- `{"solutions": ["1/3", "-2"]}` for equations: the last line must be `x = …` (several roots
  joined by `or` or commas) with exactly these values.
- `{"expression": "(x+2)(x+3)", "form": "factorised"}` for expressions; `form` is optional and
  can be `factorised` or `expanded`.

- `form` can also be an answer form (`app/forms.py`): `fraction`, `simplest_fraction`,
  `improper_fraction` (lowest terms, never a mixed number), `standard_form` (1 ≤ A < 10) or `index_form` (different primes with powers). The answer must
  then have the right value and be written that way: `360` is not index form.

Everyday notation is read first (`app/notation.py`, matching `packages/core`'s answer
normaliser): `×`, `·` and `x` between numbers are times, superscripts are powers, `−` and dashes
are minus, and thousands separators are dropped between groups of exactly three digits.

`final_answer_correct` is `null` when no `expected` answer is given. Unreadable or unsafe input
returns 400.

How steps are compared: expressions must be identical; equations in one unknown must have the
same solutions (so losing a root, as in `x^2 = 9` to `x = 3`, is caught); equations in several
letters (rearranging a formula) must be constant multiples of each other.
Decimals in working are read exactly (as fractions), so `(6*1.6)*10^10` equals
`(6*10^2)*(1.6*10^8)` without floating-point rounding.

## Input safety

Input is untrusted. After the notation above is rewritten, only digits, single letters, `sqrt sin cos tan log ln exp pi`, `+ - * / ^ ( )`,
`.` and spaces are allowed, at most 200 characters per expression. Python builtins are switched
off during parsing, scientific-notation literals and powers inside exponents are refused, and
numeric exponents are capped at 50, so input like `9^9^9^9` cannot hang the service. Implicit
multiplication (`3x`, `(x+1)(x+2)`) and `^` for powers are understood.

## Content checks

`python -m app.content_check` reads `{"checks": [...]}` on stdin and writes results to stdout.
`pnpm content:validate` uses it to verify every maths answer in `content/`.

## Question templates

`app/templates/` writes maths items from templates, correct by construction: SymPy builds the
question, answer, steps and explanation from seeded parameters, and every instance is
cross-checked by the content checks and an independent recheck before it is written.
`pnpm content:templates` builds them; `python -m app.templates.build --check` fails if the
committed items are stale. How to add one: `docs/TEMPLATES.md`.

## Computer Science engine

`app/cs/` (workstream S5, A-Level Computer Science, OCR H446, board provisional) computes CS
answers by code, with no AI:

- `bases.py`: binary and hexadecimal conversion, sign and magnitude, two's complement, column
  addition (carries, carry out, overflow), two's complement subtraction, logical, arithmetic and
  circular shifts, AND/OR/XOR masks, and answer matching (`same_bits` needs every bit written;
  `same_hex` reads by value).
- `floating.py`: normalised floating point with a two's complement mantissa and exponent, the
  binary point after the mantissa's first bit; exact values (`Fraction`), so a value that cannot be
  held exactly is refused rather than rounded.
- `logic.py`: Boolean expressions in OCR's notation (appendix 5d) and every alternative it
  accepts, truth tables, equivalence, shortest sum of products (SymPy's Quine-McCluskey, checked
  against our own truth-table evaluator), `is_simplest` for marking, Karnaugh maps in Gray code
  order, and half and full adders.

- `pseudocode.py`: an interpreter for OCR's exam reference pseudocode (appendix 5d): variables
  and `global`, casting, `print`, `input` from a supplied list, `for`/`next` (with `step`),
  `while`, `do`/`until`, `if`/`elseif`/`else`, `switch`/`case`, arithmetic (`MOD`, `DIV`, `^`),
  comparison and logical operators, `.length`, `.substring`, functions and procedures with
  `byVal`/`byRef`, recursion and arrays of any dimension. `run` gives the output, the final
  variables and a trace for trace tables: `{line, name, value, cell}` per assignment (`cell` is
  the storage written, the caller's for a byRef parameter) and `{line, output}` per print. No
  Python `eval`; a step limit stops runaway loops. Not yet: files and classes.

Not yet: algorithm tracers (next S5 step), and a content-check kind so `pnpm content:validate`
re-runs CS answers.

## Run and test

```bash
cd services/maths
pip install -r requirements-dev.txt
python -m pytest -q          # includes the 90% line and branch coverage gate
uvicorn app.main:app --reload
./smoke-test.sh              # builds the Docker image and checks /health and /check-working
```
