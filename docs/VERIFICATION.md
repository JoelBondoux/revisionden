# Verification protocol

> Live document. Requirement from the product owner: there can be no mistakes on the education
> side. Every question, answer, explanation, diagram, fact, concept and mark must be grounded in a
> source and verified, with at least one official citation wherever one exists. Citations are not
> shown in the app, but every item can produce an audit report on demand.

No process can promise zero errors. This one is built so that an error has to get past several
independent checks before a student sees it, every claim can be traced to its source, and any
error that slips through is caught, removed and traced to its cause quickly.

## 1. What must be verified

| Content                             | Must be verified                                                                                |
| ----------------------------------- | ----------------------------------------------------------------------------------------------- |
| Topic trees                         | Every leaf maps to a specification point                                                        |
| Questions                           | Wording, the correct answer, every wrong option (it really is wrong), explanation, worked steps |
| Flashcards                          | Front and back                                                                                  |
| Diagrams                            | Every label, value and relationship shown                                                       |
| Mark schemes and level descriptors  | Criteria, marks and wording                                                                     |
| Lesson text and interactive lessons | Every factual statement and every simulated behaviour                                           |
| AI marking                          | Each awarded mark tied to a criterion; overall accuracy measured (section 7)                    |
| Grade boundaries                    | The published figures for that board, tier and year                                             |

## 2. Citations

At least one citation per item, and one per factual claim within it where claims come from
different places. Stored with the content (`content/`), never shown to students.

**Allowed sources, in order of preference**

1. Exam board documents: specification, mark schemes, examiner reports, sample assessment
   materials, required practical handbooks, published grade boundaries.
2. Government and regulator documents: DfE subject content, Ofqual.
3. Other authoritative sources (for example national scientific bodies, standard reference
   data). Items relying only on these need human approval before release.

Commercial revision sites, forums and AI output are never sources.

**Standard definitions with no official source** (decision 0008). When no official source defines
a standard term (for example "tangent": the 1MA1 specification only names it), an item may rest on
the specification point that names the term, cited with its quote, plus a standard definition. It
must set `needs_human_approval: true` and is approved individually, never through a batch sample.
An official definition, where one exists, is always cited instead.

**Standard facts with no official source** (decision 0009). An item that rests on a standard maths
fact (not just a definition) that no cited source states lists it in `facts` and must pass the
**fact-check stage (step 4b)**. A fact passes with an official citation whose quote check passed and whose quote the judge confirms
states the fact (not just its topic),
or with both a maths engine proof (`engine`, for example `identity`) and a matching blind
statement. That statement comes from a third provider (neither the writer nor the blind
answerer), which answers the neutral `ask` without our wording; another provider judges the
match, with high confidence throughout. Items whose facts all pass go into normal batches. A fact
that fails or cannot be proved keeps `needs_human_approval` for individual review. An engine proof
only proves the check given, so reviewers check that it captures the fact.

**Fact proofs (maths engine, `services/maths/app/facts.py`).** Besides `identity`, a fact's
`engine` can be one of these kinds (the schema refuses any other). None uses AI:

| Kind             | Fields                                                      | Proves                                                                                                                                                                 |
| ---------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `transformation` | `graph` (with `f`, e.g. `f(x - a)`), `image` (`(x + a, y)`) | y = graph is the image of y = f(x) under (x, y) → image: symbolically for an unknown f, then on sampled functions and constants; the image must reach every x          |
| `implication`    | `given` (inequalities), `then`                              | No counterexample in 4,000 seeded samples, and a symbolic proof (each given written as a positive gap: b = a + p, c = −q); if either step fails the fact is not proved |
| `sign_change`    | `function` (of x), `interval` (`["1", "2"]`)                | The function is continuous on the interval, changes sign, and a root is found between the ends (root location by the intermediate value theorem, on this function)     |
| `parallel`       | `lines` (two equations), optional `parallel` (true/false)   | Numeric lines: parallel or not as claimed (gradients and intersection agree). Letter gradients: the lines meet at one point exactly when the gradients differ          |
| `trig_value`     | `function` (sin, cos, tan), `degrees`, `value`              | The exact value, or `undefined` (tan 90°)                                                                                                                              |
| `graph_measure`  | `y`, `x`, `measure` (gradient or area), `is`                | By units: gradient is y per x, area is y times x (distance-time gradient = speed; velocity-time area = displacement)                                                   |

**Template items** (workstream T1, `docs/TEMPLATES.md`). Maths items generated by the maths
engine from a template record `template: {id, version, seed}`. Before one is written, the content
checks (step 5) and an independent recheck of the question text must agree with the template's
own computation, or the build fails. Generation records `grounded-writing` and `maths-engine`;
every other step (quote check, blind answer, adversarial review, human approval or batch
sampling) runs as for any item. Template citations reuse quotes already checked in the same topic.

**The judge compares meaning, not wording** (S3-A run, 2026-11-25). B is the same as A when it
states all of A, however worded; it may explain, give an example or an equivalent form, make
explicit a condition A's words imply ("non-vertical" for lines with a gradient), or add further
related facts. It is not the same when it contradicts A, states a different fact, leaves out part
of A or a condition A needs, adds a condition that changes when the fact holds, or covers only a
narrower case. Unsure means not the same. `pnpm evals fact-judge --golden
evals/golden/fact-judge.json --judge gemini --live` checks the judge on 20 pairs: 8 recorded
same-fact pairs from the S3-A run and 12 that differ in meaning. Bars: every different pair refused,
at least 90% of same pairs accepted. On 2026-11-25, with `gemini-2.5-pro`, the old prompt accepted
3 of 8 same pairs, and the new one accepted 8 of 8 and refused 12 of 12 (two runs).

**Citation record**

| Field          | Meaning                                                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `source_type`  | specification, mark_scheme, examiner_report, sample_assessment, dfe_subject_content, ofqual, required_practical, grade_boundaries, other_authoritative |
| `publisher`    | For example AQA, Pearson Edexcel, OCR, WJEC Eduqas, DfE, Ofqual                                                                                        |
| `title`        | Document title                                                                                                                                         |
| `document_ref` | Code, version or year                                                                                                                                  |
| `url`          | Official location                                                                                                                                      |
| `location`     | Page, section, paragraph or specification point                                                                                                        |
| `quote`        | Short verbatim excerpt (about 50 words at most) that supports the claim                                                                                |
| `supports`     | Which part it backs: question, answer, explanation, option N, diagram                                                                                  |
| `retrieved_at` | Date the source was read                                                                                                                               |

Copies of exam board documents are not stored in the public repository. A private archive of the
source PDFs (with their SHA-256 hashes recorded in the citation) is kept in a private bucket once
storage exists, so a citation still works if a board moves a document.

## 3. The pipeline every item passes before release

| Step | Check              | Who or what                                                                                                       | Fails if                                                             |
| ---- | ------------------ | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1    | Grounded writing   | Writer model, given only the source excerpts                                                                      | Any claim lacks a citation                                           |
| 2    | Quote check        | Code                                                                                                              | The quoted text is not found in the source at the stated location    |
| 3    | Blind answer       | A model from a different provider, without seeing the answer                                                      | Its answer differs                                                   |
| 4    | Adversarial review | A third pass told to find errors, ambiguity, a second correct option, or content outside the specification        | Any problem found                                                    |
| 4b   | Fact check         | Items with `facts` only: official citation, or maths engine proof plus a third provider's blind statement         | A fact neither cited nor proved and matched (then individual review) |
| 5    | Exact checks       | Maths engine (all numeric and algebraic answers), unit checks, chemical equation balancing, equation-sheet checks | Any mismatch                                                         |
| 6    | Schema and links   | Content validator in CI                                                                                           | Missing fields, broken topic links, duplicate IDs                    |
| 7    | Human approval     | Product owner or a subject teacher, in a review queue                                                             | Rejected, or any earlier step marked uncertain                       |

**Extended answers and essays.** There is no single correct answer to check blind, so step 3
becomes **blind marking**: the writer also produces three exemplar answers from the mark scheme
(top, middle and low band) with their intended levels; a model from a different provider marks
them against the mark scheme without seeing the intended levels and must match all three exactly.
Every extended-answer item also needs individual human approval (never batch sampling).

Release rule: an item is published only when steps 1 to 6 all pass unanimously **and** it is
human-approved, or it falls in a batch that passed the sampling rule below with zero defects.

**Sampling rule for large batches.** A human reviews a random 10% of each batch (at least 30
items). One confirmed error sends the whole batch back through steps 3 to 5 and a fresh sample.
Items needing human approval (section 2) are always reviewed individually.

## 4. Diagrams and images

- No AI-generated images for teaching content.
- Diagrams are drawn by code (SVG) from verified data, so labels and values are exactly what was
  checked, and each diagram has its own citations.
- Any photograph comes from a licensed source with its licence recorded.

## 5. Versions and audit trail

- Verified items are immutable. A change creates a new version and goes through the pipeline again.
- Each version keeps a verification record: every check, its result, the tool or model and its
  version, the time, and the reviewer's role (never a name).
- Student answers record the item version they saw, so any past question can be audited exactly.

## 6. Reporting and correction

- Every item has "Report a problem". A report hides the item from all students at once
  (status `quarantined`) until it is reviewed.
- A confirmed error: the item is fixed or retired; affected students' scores and mastery are
  recalculated; the cause is recorded in `project_memory/misadventures/`; every item from the same
  batch, writer prompt or source is re-checked.
- **Audit report on demand:** `pnpm content:audit <item-id | topic | subject>` produces a report
  listing each item's citations (with quotes and locations), every check and result, the reviewer
  role, version history and any reports. The parent portal can export the same report as a PDF.

## 7. Marking systems

| Marking                                       | How it is verified                                                                                                                                                                                                                                                                                               |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Multiple choice, numeric, short fixed answers | Exact rules, not AI; covered by unit tests                                                                                                                                                                                                                                                                       |
| Maths working                                 | Maths engine, line by line                                                                                                                                                                                                                                                                                       |
| Short written answers                         | Rule match first; AI only for wording variants, checked against the official mark scheme points                                                                                                                                                                                                                  |
| Long answers, essays, homework                | Two independent AI markings against the official mark scheme or level descriptors; each awarded mark must cite the criterion it meets; if the two differ by more than one level, or either is unsure, the result says so and recommends a teacher check instead of giving a mark; always labelled "Marked by AI" |

Marking accuracy is measured against a golden set with known marks before release and on every
prompt or model change (pass bars in `docs/AI.md`). Teacher marks entered by families are compared
with AI marks over time.

## 8. Targets

| Measure                                      | Target                          |
| -------------------------------------------- | ------------------------------- |
| Published items with at least one citation   | 100%                            |
| Citations whose quote is found in the source | 100%                            |
| Confirmed errors in released items           | 0 (each one triggers section 6) |
| Time from report to quarantine               | Immediate                       |
| Time from report to decision                 | Within 48 hours                 |

## 9. How the pipeline is built (workstream V)

The tools live in `scripts/verify/` (offline, run by content sessions), the review queue and
quarantine in `apps/api` and `apps/web/src/features/review/`, and the marking rules in
`packages/core`. Commands:

| Command                                                | Step | What it does                                                                                      |
| ------------------------------------------------------ | ---- | ------------------------------------------------------------------------------------------------- |
| `pnpm content:quote-check [--only <id>] [--write]`     | 2    | Fetches each cited source, finds the quote at its location, records the result and source SHA-256 |
| `pnpm content:model-check --blind <p> --review <p>`    | 3, 4 | Blind answer and adversarial review (providers: `anthropic`, `openai`, `gemini`); costs money     |
| `pnpm content:exact-check [--only <id>] [--write]`     | 5    | Units, chemical equations and equation-sheet lookups (maths stays with `pnpm content:validate`)   |
| `pnpm content:audit <item, topic, tree or subject id>` | 6    | Markdown audit report (`--reports <file>` adds reports exported from the review API)              |
| `pnpm evals essay --golden <file> --live`              | 7    | Double-marking accuracy against a golden set; never in CI                                         |

`--write` only changes draft content: verified versions are immutable.

**Quote check (step 2).** Sources are fetched only from the official hosts in
`scripts/verify/sources.mjs` (Pearson, AQA, OCR, Eduqas, WJEC, gov.uk) over https, and cached
outside the repository (`REVISIONDEN_SOURCE_CACHE`, default `~/.cache/revisionden/sources`);
exam board documents are never committed. Text is compared after normalising whitespace,
ligatures, curly quotes, dashes, soft hyphens, words split across lines and spaces inside
brackets or before punctuation; letter case and words must match exactly. Only that exact
match passes on its own. Text extraction can still break a genuine quote, so the checker then
looks for a **near match**, which never passes automatically:

- `letters`: the same letters and digits in order, ignoring everything else (a hyphen dropped
  at a line end, "position-toterm"; "n th" for a superscript);
- `words`: every word of the quote within a window only slightly longer than the quote,
  allowing inserted fragments ("Y" from a two-column layout, the "1" of a fraction) and some
  reordering (a formula split across lines); confidence is the share of words in order, and
  anything below 0.5 is not a match.

A near match makes the citation `near` and the entry's quote-check `fail`, with notes such as
"near match (words, confidence 0.60): a reviewer must confirm it". A reviewer compares the quote
with the source by hand; the content session then records the quote-check as passed with the
reviewer's role as the tool. A quote that appears
more than once (Foundation and Higher tiers repeat text) passes if any copy is at the stated
location. The location must be checkable:

- `page N` matches the PDF page or the printed page number on that page (board specifications
  number pages from the start of the content, so printed page 5 can be PDF page 17);
- a specification code (`N7`, `A17`, `4.2.1`) must be the nearest code of its kind before the
  quote, or inside it; a section code also covers its subsections (`4.2.1` covers `4.2.1.3`);
- a web page has no pages, so its citations need a code; a location with neither a page nor a
  code fails. Anything the checker cannot confirm fails, for a person to fix.

**Blind marking for extended answers (step 3).** The item lists three `exemplars` (`band`: top,
middle or low; the intended `level`; the `answer`), written from the mark scheme. Each is marked
by a model from a different provider from the writer (`scripts/verify/blind-marking.mjs`,
run by `pnpm content:model-check --blind <provider>`), given only the question, the exemplar
and the mark scheme. The check passes only if all three are marked at exactly their intended
levels (total marks for mark-point schemes), confidently, with every mark citing the scheme.
Verified extended answers need a passing `blind-marking` check (not `blind-answer`), all three
exemplars, and a `human-approval` check; review batches always include them in the sample.

**Blind answer and adversarial review (steps 3 and 4).** Providers share one interface
(`scripts/verify/providers.mjs`) with structured JSON output that is validated before use. To go
through the authenticated AI Gateway, set `<PROVIDER>_BASE_URL` to the gateway's provider URL and
`AI_GATEWAY_TOKEN`; the token is sent as `cf-aig-authorization`, with
`cf-aig-collect-log-payload: false` so prompts and answers are not logged. The token is sent only to
https addresses on `gateway.ai.cloudflare.com`, never to a provider's own API. The blind answer must come from a different provider from the writer (Claude by default, read from
the grounded-writing check). It sees no answer, hint or explanation, and passes only on a match
with high confidence (multiple choice: same option; numeric: within the item tolerance, or, when the answer sets `decimal_places` or `significant_figures`, written to exactly that accuracy with the correctly rounded value (see "Answer format" below); short
answers: same words ignoring case and end punctuation, or the same answer under the marking normaliser (`sameAnswer` in `packages/core`: maths notation such as `x²` for `x^2`, plus the item's `any_order` and `units`); flashcards: same words ignoring case and end punctuation; maths flashcards with a
`back_formula`: the maths engine finds the same formula (`±` gives both branches, a bare right-hand
side is compared with the expected one, notation is read strictly so `/ 2a` is not `/ (2a)`), and the
answer states every listed condition such as `a ≠ 0` as a whole clause (`a ≠ 0.5` does not count), otherwise it fails for a person to check; worked maths: the same
solutions in any order (a solution may use other letters, `x = 2a`), or the same expression; an answer written `<subject> = …` counts as its right-hand side when the item declares that `answer.subject`). The reviewer sees the whole item and the
quoted sources (and, for typed answers, a note of the marking normaliser's rules such as spaces and multiply signs, and for `any_order` items a note not to ask for reordered versions of the accepted answers, so it does not ask for forms marking already accepts) and must report factual errors, a wrong answer, ambiguity, a second correct
option, content outside the specification, unsupported claims or poor wording; any problem or
an unsure reviewer fails. Tests use recorded fixtures only.

**Answer format (S3-A rulings, 2026-11-25).** One set of rules in `packages/core/src/answer-format.ts`
serves student marking, content validation and the blind check, and the maths engine applies the same
ones:

- _Subject._ A numeric or expression answer may declare `answer.subject` (`t`, `f^-1(x)`). An answer
  written `<subject> = RHS` (spaces ignored) is then read as RHS; another letter, or no declared
  subject, is not. In a student's working the final line may state the subject; with a letter
  subject, a rearranging step may multiply or divide by anything without that letter (so
  `a t = v - u` to `t = (v - u)/a` follows), and a function-notation line such as
  `f^-1(x) = (x + 3)/2` follows from `y = (x + 3)/2`.
- _Rounding._ When a question asks for rounding, the numeric answer sets `decimal_places` (0 to 10)
  or `significant_figures` (1 to 15) instead of `tolerance` (the schema refuses two of these
  together). A right answer has the correctly rounded value and is written to that accuracy:
  `28.274` and `28.270` are wrong for 2 decimal places. Whole numbers with trailing zeros may count
  them or not (4500 is 2, 3 or 4 significant figures). The engine rounds the exact value half up,
  as UK exams do. Validation fails an item whose question mentions decimal places, significant
  figures or the nearest whole number without one of these fields, one with a field but no such
  words, and one whose `answer.value` is not itself written to that accuracy.

**Clean text.** Model output is recorded in check notes, and models sometimes return control
characters. `withCheck` (`scripts/verify/record.mjs`), which writes every check record, replaces
any control character other than tab and newline with a space, and `pnpm content:validate` refuses
any that reach content by hand, naming the field (for example
`control character U+0000 in verification.checks[5].notes`). Postgres cannot store `\u0000` in
jsonb, so one such character fails the whole content sync (22P05).

**Exact checks (step 5).** An item names the facts to check in an optional `exact` block:
`quantity` (its `answer.unit` must have that dimension), `chemical_equation` (atoms and charge
balance, coefficients in lowest terms) and `equation_sheet` (`sheet`, `equation`, optional
`as_written`). Verified items then need a passing `units`, `chemical-equation` or
`equation-sheet` check. Equation sheets are sourced content in `content/equation-sheets/`
(`id`, `title`, `citations`, `verification`, `equations[]` with `id`, `equation`, `symbols` as
units); every sheet equation must be dimensionally consistent, and an item can only use a
verified sheet. `as_written` matches the same equation in any equivalent form (`1/2` or `0.5`,
any order of factors); a rearranged equation does not match and needs a person. Chemical
equations put spaces around `+` between species and write a polyatomic charge above 1 with `^`
or a space (`SO4^2-`).

**Human review (step 7).** Reviewers are parent accounts with a row in `reviewer_roles`
(`subject-specialist`, `content-lead` or `parent-reviewer`), added by the product owner; every
decision stores the role, never a name. A batch (`POST /v1/review/batches`, with a snapshot of
each item) draws its sample with a recorded seed so the draw can be replayed. One confirmed
error fails the batch and files re-check requests for the batch (steps 3 to 5 and a fresh
sample), its writer prompt and its source. A passed batch is then recorded in each item as a
`batch-sample` check by the content session.

**Batches from draft items (S2).** Content sync keeps each item's full content record, with its
linked mark scheme as `mark_scheme_detail`, in `items.review_snapshot` (never served). On
`/review`, a `content-lead` sees how many drafts are ready and can **Create batch from draft
items** (`GET, POST /v1/review/batches/from-drafts`): only drafts whose snapshot has every
automated check passed (grounded writing, quote check, blind answer or blind marking, adversarial
review, schema, and the maths engine for maths items; `readyForHumanReview` in
`packages/core`), and not already in a batch under review or passed at that version. An item with
`facts` also needs a fact-check record; if it failed, the item is batched for individual review
(`needsIndividualReview`), never sampling. Exact checks the item names (units, chemical equation, equation
sheet) must pass too. After a batch fails, its items stay out of new batches until the batch's
recheck is marked done and their steps 3 to 5 checks have re-run since the failure (`recheckedSince`). The batch
page shows each item's hint, mark scheme, exemplars and checks.

**Reports and quarantine (section 6).** "Report a problem" stores only the item, its version and
a reason (no free text, so no personal data) and hides the item at once: a row in
`quarantined_items` and status `quarantined` in `items`, which the learning loop's content gate
never serves. Students report by the item id the app was given. Every content sync puts the
`quarantined` status back (`reapplyQuarantine`), so content/ cannot lift it. "No error" releases
the item once no report is left open and restores its earlier status. A confirmed-error
quarantine lifts when a newer version of the item is synced (a fixed version that has been
through the pipeline again). A confirmed error keeps it hidden, queues a recalculation job, calls the
`onConfirmedError` hook (the learning loop recalculates scores and mastery there) and files an
item re-check. The audit report reads version history from git and reports from
`GET /v1/review/reports?item=<id>`. The parent-portal PDF export is still to do.

**Double marking (section 7).** `packages/core/src/double-marking.ts`: each marking must cite a
mark point code or the level (`L3`) for every mark, with evidence, and stay within the scheme.
An invalid or unsure marking, a marker failure, or a gap of more than one level (more than one
mark for mark-point schemes) gives "check with your teacher" instead of a mark. When the two
agree, the lower marking is used. Every result carries the AI label.
