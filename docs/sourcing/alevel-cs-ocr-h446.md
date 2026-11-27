# Sourcing record: A-Level Computer Science, OCR H446

> Live record (workstream S5). What was read, what each citation backs and what is still open.

## Board

OCR H446 is **provisional**: it is the most-used A-Level Computer Science board in England and no
OCR AI clause has been found (`docs/research/board-shares-2026-11.md`,
`docs/research/question-generation-2026-11.md`). The owner has not confirmed it yet.

## Source read

| Document                                                                                 | Version                  | URL                                                                                                 | SHA-256 (as fetched 2026-11-27)                                    |
| ---------------------------------------------------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Cambridge OCR Level 3 Advanced GCE in Computer Science H446 Specification (56 PDF pages) | Version 3.0 (April 2026) | https://www.ocr.org.uk/Images/170844-specification-accredited-a-level-gce-computer-science-h446.pdf | `8551bc2636fa4d8718d97901b462b0642b4bb6148e06407f662c507750764a44` |

The hash matches the one recorded in the question-generation research. The file is not
committed (public repository); the quote checker caches it outside the repo.

## Topic tree

- Section 2c, Components 01 (printed pages 6 to 10) and 02 (pages 11 to 12). Printed page N is
  PDF page N + 6; every location gives both.
- Structure: section (1.1 to 2.3) > subsection (1.1.1 to 2.3.1) > lettered point. 1.5.2 has
  bullets, not lettered points, so it is one leaf whose quote is its lead-in sentence.
- Not included: the programming project (Component 03 or 04, non-exam assessment) and the
  appendices. Appendix 5d (pseudocode, SQL, HTML and Boolean notation) is referenced by 1.2.4,
  1.3.2, 1.3.4 and 1.4.3 and will be read when the engines are built.
- Every leaf's quote is the point's own wording. Each backs `topic` only: it shows the topic is
  in the specification, nothing more.
- Shortened quotes: 1.2.1(c) stops before "role within the Fetch-Decode-Execute Cycle", because
  the checker's PDF text splits that word ("Fetch - Decode"); 1.2.4(e) starts at "with an
  understanding of" to skip the appendix cross-reference; 1.2.2(d) leaves out "Translators:";
  1.3.3(b) and 2.2.2(f) quote the lead-in line before their bullet lists.
- Quote check (`pnpm content:quote-check --only alevel-computer-science-ocr-h446`), 2026-11-27:
  111 of 111 citations exact, 0 near matches.

## Engine notation (appendix 5d, printed pages 32 to 43; PDF pages 38 to 49)

- Boolean algebra: OCR uses ∧, ∨, ¬, exclusive disjunction and ≡, and accepts AND, A.B, OR, +,
  a bar, ~, NOT, XOR, ⊕ and ↔ from learners. The engine reads all of them except the bar (not
  typeable). The specification's glyphs for exclusive disjunction do not survive text
  extraction, so questions write ⊕, an accepted alternative.
- Pseudocode: the interpreter follows the appendix 5d guide (printed pages 32 to 37). The
  guide says learners may answer "in any style of pseudocode", so the interpreter computes
  answers to questions; it never marks a student's code. Files and classes are not built yet.
- LMC mnemonics, SQL, HTML and CSS: read; not built yet.
- Floating point: the specification names "Representation and normalisation of floating point
  numbers in binary" (1.4.1(g)) but not the format. The engine uses a two's complement mantissa
  and exponent with the binary point after the first bit; each question must state this itself,
  so no item relies on an unstated convention.

## Still open

- Owner to confirm the board.
- Leaf titles are RevisionDen summaries, not specification text.
