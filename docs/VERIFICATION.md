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

| Step | Check              | Who or what                                                                                                       | Fails if                                                          |
| ---- | ------------------ | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1    | Grounded writing   | Writer model, given only the source excerpts                                                                      | Any claim lacks a citation                                        |
| 2    | Quote check        | Code                                                                                                              | The quoted text is not found in the source at the stated location |
| 3    | Blind answer       | A model from a different provider, without seeing the answer                                                      | Its answer differs                                                |
| 4    | Adversarial review | A third pass told to find errors, ambiguity, a second correct option, or content outside the specification        | Any problem found                                                 |
| 5    | Exact checks       | Maths engine (all numeric and algebraic answers), unit checks, chemical equation balancing, equation-sheet checks | Any mismatch                                                      |
| 6    | Schema and links   | Content validator in CI                                                                                           | Missing fields, broken topic links, duplicate IDs                 |
| 7    | Human approval     | Product owner or a subject teacher, in a review queue                                                             | Rejected, or any earlier step marked uncertain                    |

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
