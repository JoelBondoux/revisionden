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

## Items, strand 1 (data representation)

- 119 template items (17 templates) for 1.4.1 (b) to (i). Each item's citation is its topic
  leaf's citation, word for word, with `supports: ["question"]`: the specification puts the
  question in scope; the answer is computed by the CS engine and rechecked by a second method.
- Quote check, 2026-11-27: all 119 items pass (exact).
- Unsupported by any cited source (listed in `facts`, decision 0009): two's complement place
  values and negation, sign and magnitude, the meaning of the mantissa bits, the normalisation
  rule, shift fill rules, and AND/OR/XOR. These 70 items need individual human approval.
- Model checks on a sample of 17 (one per template; OpenAI `gpt-5.4-2026-03-05` for blind answer
  and adversarial review, while Gemini is capped): see the PR for results.
- Floating point blind-answer failures (lead ruling 2026-11-27): the four sampled floating point
  items failed blind answer because the model's own arithmetic was wrong (it gave 9, then 4.5,
  for an item whose answer is 1.125). They go to individual review and are not re-run to get a
  pass. Each item's `maths-engine` check records that the CS engine wrote the answer and the
  template's independent recheck agreed; every floating point item is also hand-checkable in
  `docs/TEMPLATE_PREVIEW_CS.md`.

## Still open

- Owner to confirm the board.
- Leaf titles are RevisionDen summaries, not specification text.
