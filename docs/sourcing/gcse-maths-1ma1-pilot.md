# Sourcing record: GCSE Maths Higher pilot (Pearson Edexcel 1MA1)

> Live document. What was read to cite the pilot content, what each citation backs, and what is
> still not backed by an official source. Conventions: `docs/CONTENT_PLAN.md` (Citation
> conventions). Copies of the documents are not kept in this repository.

Retrieved 2026-11-24 (workstream S). All pilot content stays `draft`: blind answer, adversarial
review and human approval are still to do (workstream V and the product owner).

## Documents read

| Document                                                                                      | Issue / reference                                                                 | URL                                                                                                                                           | SHA-256                                                            |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Pearson Edexcel Level 1/Level 2 GCSE (9–1) in Mathematics (1MA1) Specification (54 PDF pages) | Issue 2, June 2015 (first teaching September 2015, first certification June 2017) | https://qualifications.pearson.com/content/dam/pdf/GCSE/mathematics/2015/specification-and-sample-assesment/gcse-maths-2015-specification.pdf | `c30745f274663c5f910e3706ea836c6f7e95e0a00ff38eac860622232ed84f8b` |
| Mathematics: GCSE subject content and assessment objectives (DfE, 17 PDF pages)               | DFE-00233-2013, published on GOV.UK 1 November 2013                               | https://assets.publishing.service.gov.uk/media/5a7cb5b040f0b6629523b52c/GCSE_mathematics_subject_content_and_assessment_objectives.pdf        | `647a751b51c71d9ced1c9356aa70b15ceb1a4acb2fd5bc9af49619ead06d0ee6` |

The Higher tier content (N1 to S6) is on printed pages 12 to 20 (PDF pages 24 to 32) of the
specification. The printed page number is 12 lower than the PDF page number throughout.

## Topic tree (97 leaves)

Every leaf `gcse-maths-h-<ref>` cites its own content reference, with the quote taken from that
statement. The spec_ref mapping (one reference per leaf, N1 to S6) matched the specification; no
leaf was moved.

Quotes that are only part of the statement, because the full statement is over 50 words or has
typeset maths in it: N5, N8, N9, N10, A1, A4, A12, A24, R9, R13, G2, G3, G17, G19, G20, G22, G23,
S4. Of these, G22 quotes only "know and apply the sine rule" (the cosine rule follows a typeset
formula) and G23 quotes only the words after the formula. The six quotes that cross a typeset
formula or a line-break hyphen (A12, A23, A24, R13, G20, G23) were checked against a rendered
image of the page, because plain text extraction interleaves the maths with the words.

The groupings under Ratio, Probability and Statistics (for example "Ratio and scale") are
RevisionDen's; the specification lists R1 to R16, P1 to P9 and S1 to S6 without sub-headings.

## Items and mark scheme

| Id                                       | Citation location                                                | Quote backs         | Answer checked by                                                   |
| ---------------------------------------- | ---------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------- |
| gcse-maths-h-n7-0001                     | Spec N7, page 12                                                 | question            | maths engine; SymPy: 8^(2/3) = 4                                    |
| gcse-maths-h-r9-0001                     | Spec R9, page 16                                                 | question            | maths engine; SymPy: 80 × 115/100 = 92                              |
| gcse-maths-h-g17-0001                    | Spec G17, page 18                                                | question            | maths engine; SymPy: 9π = 28.2743…, so 28.27 to 2 d.p.              |
| gcse-maths-h-a18-0001                    | Spec A18, page 15                                                | question            | maths engine; SymPy: roots 1/3 and −2; (3x − 1)(x + 2) expands back |
| gcse-maths-h-a17-0001                    | Spec A17, page 15                                                | question            | maths engine; SymPy: x = 7                                          |
| gcse-maths-h-a4-0001                     | Spec A4 ("taking out common factors"), page 14                   | question            | maths engine; SymPy: factor(6x² + 9x) = 3x(2x + 3)                  |
| gcse-maths-h-a4-0002                     | Spec A4 ("expanding products of two or more binomials"), page 14 | question            | maths engine; SymPy: 2x² + 7x − 4                                   |
| gcse-maths-h-n4-0001                     | Spec N4, page 12                                                 | question            | SymPy: 51 = 3 × 17, 57 = 3 × 19, 63 = 3² × 7, 59 prime              |
| gcse-maths-h-g9-0001                     | Spec G9, page 17                                                 | question            | not officially sourced (see below)                                  |
| gcse-maths-h-a18-0002                    | Spec A18, page 15; DfE Appendix section 1, page 14               | front; back         | SymPy: solve(ax² + bx + c) gives the formula                        |
| gcse-maths-h-a6-0001                     | Spec A6, page 14                                                 | question            | mark scheme below                                                   |
| gcse-maths-ms-consecutive-integers-proof | Spec A6, page 14                                                 | mark_scheme (scope) | SymPy: n + (n + 1) + (n + 2) = 3(n + 1)                             |

For gcse-maths-h-a18-0002, the DfE quote is the heading of the list of formulae candidates must
know; the formula itself is typeset under "The quadratic formula" on the same page and was
compared by eye.

## Not backed by an official source (still to resolve before release)

- **gcse-maths-h-g9-0001, answer.** The specification lists "tangent" among the circle
  definitions students must know (G9) but does not define it. The definition in the prompt
  ("a straight line that touches a circle at exactly one point") is standard but has no official
  citation yet. Needs a board document that defines it, or human approval.
- **gcse-maths-ms-consecutive-integers-proof, mark points.** Written for RevisionDen in the
  board's B1/M1/A1 style; no official Pearson mark scheme is cited. The A6 quote only shows that
  algebraic proof is assessed. The maths in each point is correct.
- **Item `mark_scheme` arrays** on gcse-maths-h-r9-0001, g17-0001, a18-0001, a17-0001, a4-0001 and
  a4-0002: hand-written mark allocations, not from official mark schemes. The maths in each is
  correct (checked with SymPy), but the allocation of marks is not officially sourced.
- **Hint on gcse-maths-h-n7-0001 and explanation on gcse-maths-h-n4-0001:** mathematical
  statements checked with SymPy; no citation needed for their truth, but the multiple-choice item
  is not checked by the maths engine in the validator (only numeric and worked maths are).

## Problems found and fixed

- Every citation had `document_ref` "1MA1 (issue not yet confirmed)", pointed at the
  qualification web page rather than the document, and gave a location without a page. Now the
  issue, the PDF URL, the heading path and both page numbers are recorded.
- Every item citation claimed the specification backed the answer (and hints, steps, mark
  schemes, distractors). A specification cannot show an answer is right, so `supports` now names
  only what the quote backs.
- gcse-maths-h-a18-0002 (flashcard): the back read `x = (-b ± √(b^2 - 4ac)) / 2a`, which in
  linear notation can be read as dividing by 2 and then multiplying by a, and left out the
  condition a ≠ 0 that the DfE document states. Now `x = (-b ± √(b^2 - 4ac)) / (2a), where a ≠ 0`.

No wrong answers, wrong options or wrong topic mappings were found.
