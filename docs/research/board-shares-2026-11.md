# Exam board shares and AI terms per subject (November 2026)

> Research document, checked 2026-11-25. Answers two questions. Which exam board do most students
> in England take for each subject in our initial set? And do any boards' terms forbid our
> AI-assisted content pipeline? The family doesn't know their boards yet, so we build for the
> most-used board first. Official sources only. No personal data.

## Summary

- **The source.** Ofqual's _Annual qualifications market report: academic year 2024 to 2025_
  (published 19 March 2026) gives each board's share of **certificates** by subject in England.
  - Ofqual does not publish **entries** by board. Certificates awarded is the closest official
    measure.
- **AQA is the biggest board in 9 of our 15 subjects.**
  - GCSE: English Language, English Literature, Biology, Chemistry, Physics, Combined Science,
    Drama and French.
  - A-Level: Physics.
- **Pearson Edexcel leads in four:** GCSE Maths and History, and A-Level Maths and Further Maths.
- **OCR leads in A-Level Computer Science.**
- **WJEC Eduqas is the only board for GCSE Film Studies.**
- **AI terms, board by board** (detail in section 3):
  - **AQA:** explicitly forbids what our pipeline does.
  - **Pearson:** reported to reserve rights over AI training. That could not be confirmed directly.
  - **OCR and WJEC Eduqas:** no AI clause found.
- **Recommended build order:**
  1. Start with the six subjects whose top board is not AQA.
  2. In parallel, ask AQA and Pearson in writing for a clear answer. Hold the AQA-led subjects
     until AQA replies (section 4).

## 1. Source and method

- **Dataset.** Ofqual, _Annual qualifications market report: academic year 2024 to 2025_, data
  tables `AQMR_2024_to_2025_academic_year.ods`.
  - Page:
    https://www.gov.uk/government/statistics/annual-qualifications-market-report-academic-year-2024-to-2025
  - File:
    https://assets.publishing.service.gov.uk/media/69b9e7faf6acd3f43e9612f5/AQMR_2024_to_2025_academic_year.ods
  - SHA-256 of the file we read: `c75e39e357f5ecbefa5faa44ac89fa39e5504b21818c53d710a1240a70deba9d`.
  - Downloaded directly from gov.uk on 2026-11-25.
- **Tables used.**
  - Table 8: "GCSE subjects - market share of awarding organisations by subject".
  - Table 10: "A level subjects - market share of awarding organisations by subject".
  - Table 1 (certificates per specification) for single-specification checks.
- **What the numbers mean.** These are Ofqual's own definitions, from the release's Notes sheet and
  background page:
  - The data covers "qualifications offered in England" and regulated by Ofqual.
  - The academic year runs from "the start of October 2024 until the end of September 2025".
  - Numbers of certificates are "rounded to the nearest 5".
  - The data "is supplied by awarding organisations".
- **"WJEC" in Ofqual's tables.** It is WJEC CBAC Ltd's Ofqual-regulated qualifications, which are
  sold in England as **Eduqas**. For example, Table 1 lists "WJEC Eduqas … GCSE (9-1) in Film
  Studies" (C670QS). WJEC's GCSEs for Wales are regulated by Qualifications Wales and are not in
  these figures.
- **No estimates.** Every share below is Ofqual's own figure, copied from the table, and no
  secondary site was used. Where a subject sits inside a broader Ofqual category, we say so.

## 2. Table: top board per subject

All figures are certificates in England, 2024 to 2025.

| Subject                  | Ofqual category (table)                 | Top board (share, certificates) | Runner-up (share)          | Total certificates | AI-policy risk for the top board                  |
| ------------------------ | --------------------------------------- | ------------------------------- | -------------------------- | ------------------ | ------------------------------------------------- |
| GCSE English Language    | English language (T8)                   | AQA 73.5% (628,210)             | Pearson 14.0% (119,335)    | 854,870            | **High** (AQA)                                    |
| GCSE English Literature  | English literature (T8)                 | AQA 81.7% (485,580)             | WJEC Eduqas 9.7% (57,660)  | 594,105            | **High** (AQA)                                    |
| GCSE Maths               | Mathematics (T8)                        | Pearson 61.9% (542,035)         | AQA 22.9% (201,085)        | 876,255            | Medium: Pearson's reservation is unconfirmed      |
| GCSE Biology             | Biology (T8)                            | AQA 81.9% (138,335)             | Pearson 12.6% (21,340)     | 168,840            | **High** (AQA)                                    |
| GCSE Chemistry           | Chemistry (T8)                          | AQA 82.0% (132,020)             | Pearson 12.7% (20,465)     | 161,100            | **High** (AQA)                                    |
| GCSE Physics             | Physics (T8)                            | AQA 82.3% (131,870)             | Pearson 12.6% (20,270)     | 160,230            | **High** (AQA)                                    |
| GCSE Combined Science    | Combined science (T8)                   | AQA 83.4% (753,725)             | Pearson 13.2% (119,365)    | 903,525            | **High** (AQA)                                    |
| GCSE Drama               | Drama (T8)                              | AQA 39.1% (18,790)              | WJEC Eduqas 26.2% (12,600) | 48,075             | **High** (AQA); runner-up is Low                  |
| GCSE Film Studies        | Media / film / TV studies (T8); Table 1 | WJEC Eduqas (only board)        | None                       | 5,620 (Table 1)    | Low                                               |
| GCSE French              | French (T8)                             | AQA 76.4% (95,785)              | Pearson 21.3% (26,670)     | 125,320            | **High** (AQA)                                    |
| GCSE History             | History (T8)                            | Pearson 57.3% (159,420)         | AQA 32.6% (90,690)         | 278,390            | Medium: Pearson's reservation is unconfirmed      |
| A-Level Maths            | Mathematics (T10)                       | Pearson 72.4% (73,010)          | AQA 14.5% (14,600)         | 100,835            | Medium: Pearson's reservation is unconfirmed      |
| A-Level Further Maths    | Mathematics (further) (T10)             | Pearson 69.8% (12,630)          | OCR 21.2% (3,840)          | 18,080             | Medium: Pearson's reservation is unconfirmed      |
| A-Level Computer Science | Computing (T10)                         | OCR 68.4% (12,315)              | AQA 29.1% (5,235)          | 17,995             | Low–medium: no OCR clause; Cambridge terms unread |
| A-Level Physics          | Physics (T10)                           | AQA 55.2% (21,915)              | OCR 32.6% (12,925)         | 39,670             | **High** (AQA); runner-up is Low–medium           |

**Notes on the table:**

- **Combined Science.** AQA's share is two specifications added together, Trilogy and Synergy.
  - Trilogy (8464): 456,590 Foundation + 286,625 Higher.
  - Synergy (8465): 8,590 + 1,925.
  - Source: Table 1.
- **GCSE Film Studies.** Ofqual groups it with Media and TV Studies in Table 8, so we used Table 1.
  The only GCSE Film Studies specification in Table 1 is WJEC Eduqas C670QS, with 5,620
  certificates. This matches `product-facts.md`: "GCSE Film Studies is offered only by WJEC Eduqas".
- **GCSE Maths and English Language** totals include resits, because they count all certificates in
  the year. The data does not show how many are resits.
- **A-Level Computer Science** is Ofqual's "Computing" row. All its specifications are Computer
  Science.
- **Stability.** Table 1 gives five years per specification, and the top boards above hold the same
  place in every year listed. For example, Pearson Edexcel's GCSE Drama (1DR0) fell from 13,980 to
  10,760, while WJEC Eduqas's (C690QS) rose from 11,625 to 12,600.

## 3. Board AI policies

"Read directly" means the page was downloaded from the board's own site in this session. Some sites
are blocked by this session's network, and each is named below.

### AQA: explicit ban (high risk)

Source (read directly):
https://www.aqa.org.uk/about-us/who-we-are/our-standards/copyright-and-intellectual-property-policy

AQA's two AI sentences:

> "AQA does not permit the use of any AQA material in any manner or for any purposes in connection
> with the training of Artificial Intelligence powered tools or technologies."

> "AQA will not allow the use of any AQA material in or on any edition of a third-party work where
> any part of that work is generated or produced using Artificial Intelligence or similar tools or
> technologies."

**Why it matters for us.** Our items are written in AI working sessions from short official
excerpts, which are then quoted in citations (`docs/CONTENT_PLAN.md`, `docs/VERIFICATION.md`). The
second sentence reads directly onto that. This was first logged in
`project_memory/operations/contradictions.md`.

### Pearson Edexcel: rights reportedly reserved (medium risk, not confirmed directly)

**What we read directly.** Neither page has any wording on AI, machine learning or text and data
mining.

- **Copyright policy:**
  https://qualifications.pearson.com/en/support/support-topics/exams/past-papers/pearson-copyright-policy.html
  - Key line: "All materials published by Edexcel are protected by copyright legislation and may
    not be copied or made available electronically in whole or in part without permission from
    Pearson."
- **Qualification and Assessment publication policy**, version 2.3, dated 21 August 2026:
  https://qualifications.pearson.com/content/dam/pdf/Support/policies-for-centres-learners-and-employees/qualification-assessment-publication-policy.pdf
  - Section 7.1: "All materials published by Pearson are protected by copyright legislation."
  - Copyright queries go to "copyright@pearson.com".

**What search reported but we could not open.** A search extract reports two more statements.
**Not confirmed.**

- A footer line: "All rights reserved, including those for text and data mining and training of
  artificial intelligence and similar technologies."
- A Pearson acceptable use policy that bars "training or fine-tuning AI systems" and text and data
  mining (https://loginstatic.pearson.com/html/PEPAcceptableUsePolicy.html).

We could not check them: `pearson.com` and `loginstatic.pearson.com` are blocked by this session's
network, and the footer line was not in the qualifications pages we downloaded.

**What it means.** If confirmed, this is a reservation of training and mining rights. It is narrower
than AQA's second sentence, because it says nothing about AI-assisted third-party works. Whether
prompting an AI with short quotes counts as "training" or "data mining" is a legal question.

### OCR: no AI clause found (low to medium risk)

**What we read directly.** None of these pages mentions AI, machine learning or data mining.

- **Copyright policy:** https://www.ocr.org.uk/about/our-policies/copyright/
  - "you must not publish any Cambridge OCR materials on your public website. Materials are not
    offered for sale in any format."
  - Publishers: "If you would like to reproduce our material, please email our Publisher
    Relationship Manager".
- **Past paper policy:** https://www.ocr.org.uk/qualifications/past-paper-finder/past-paper-policy/
- **Website terms and conditions.**

**OCR's parent company.** OCR belongs to Cambridge University Press & Assessment. A search extract of
Cambridge's general copyright page (`cambridge.org/legal/copyright`) reports two things:

- It allows text and data mining for non-commercial purposes.
- It reserves commercial text and data mining rights.

`cambridge.org` and `cambridgeassessment.org.uk` are blocked by this session's network, so this is
**not confirmed**. Nor is it confirmed that these terms cover OCR exam materials.

### WJEC / Eduqas: no AI clause found (low risk)

**What we read directly.** None of these mentions AI, machine learning or data mining.

- **Terms and conditions:** https://www.eduqas.co.uk/home/terms-and-conditions/ (the WJEC site has
  the same wording)
  - 6.3: "Visitors are permitted to access, download and print the content for personal,
    non-commercial and class room use only."
  - 6.4: reproducing content "on any website not owned by the company" needs "written permission".
  - 6.5: "Visitors are prohibited from creating a database of copyrighted content by downloading and
    storing large quantities of content, unless it is for personal, non-commercial and class room
    use only."
- **WJEC Publication Policy** (effective from September 2025):
  https://www.eduqas.co.uk/media/rpaa4cij/wjec-publications-policy-effective-from-september.pdf
- **Eduqas policies page:** https://www.eduqas.co.uk/home/about-us/policies/
- **AI guidance.** WJEC and Eduqas do publish AI guidance, but it is about students using AI in
  their own coursework, not about third parties using WJEC materials. For example:
  https://www.eduqas.co.uk/home/student-support/ai-in-assessments-guidance-for-students/

**What it means for us.** RevisionDen is a private, free family app, which looks like "personal,
non-commercial" use. A public release (stage 5) would need this checked again.

### A route for AQA-led subjects: DfE subject content

- **What it is.** Every board's GCSE and A-Level specification has to cover the Department for
  Education's subject content. The DfE publishes it on gov.uk, and gov.uk content is under the
  "Open Government Licence v3.0" (gov.uk footer) unless stated otherwise. Examples:
  - https://www.gov.uk/government/publications/gcse-combined-science
  - https://www.gov.uk/government/publications/gcse-single-science
  - https://www.gov.uk/government/publications/gce-as-and-a-level-for-science
- **We already use it.** The pilot already cites DfE subject content (DFE-00233-2013) for the
  quadratic formula.
- **How it would help.** Board-neutral items could cite DfE content instead of AQA's.
- **What it doesn't solve.**
  - Mapping items to AQA's topic tree and paper structure still needs facts from AQA's
    specification.
  - The AQA clause's reach over that is a legal question.
  - The DfE page and licence still need checking for English, French and Drama.

## 4. Recommended build order

The rule: build first where the most-used board's terms don't forbid our pipeline, and don't
build AQA content until AQA has answered. This is a recommendation for the product owner, not a
decision.

**Wave A: build now, highest-share board, no AI clause found**

1. **A-Level Computer Science: OCR (68.4%).**
2. **GCSE Film Studies: WJEC Eduqas (the only board).**

**Wave B: build now, Pearson, while we ask for written confirmation**

- Send one email to copyright@pearson.com asking whether its reported AI reservation covers our
  use: AI-assisted writing of original questions, citing short quotes. The address is from the
  publication policy.
- These four subjects carry the most students per subject in our set:

3. **GCSE Maths: Pearson Edexcel (61.9%).** This continues the 1MA1 pilot.
4. **A-Level Maths: Pearson Edexcel (72.4%).**
5. **A-Level Further Maths: Pearson Edexcel (69.8%).**
6. **GCSE History: Pearson Edexcel (57.3%).**

If Pearson says no, stop Wave B and decide again. GCSE Maths is already drafted, so the pilot
would also need a decision.

**Wave C: AQA-led subjects, on hold until AQA gives written permission or we get legal advice**

- GCSE English Language (73.5%), English Literature (81.7%), Biology (81.9%), Chemistry (82.0%),
  Physics (82.3%), Combined Science (83.4%) and French (76.4%).
- **Two exceptions** where the runner-up is large enough to build first, if the owner wants:
  - **GCSE Drama:** WJEC Eduqas has 26.2%, against AQA's 39.1%.
  - **A-Level Physics:** OCR has 32.6%, against AQA's 55.2%.
- **Options while we wait:**
  - Ask AQA (copyright@aqa.org.uk) now.
  - Build board-neutral practice that cites only the DfE subject content.
  - Wait until the family knows its boards.

**Why not just build the runner-up board for AQA subjects?** For most of them, the runner-up holds
only 10 to 21% of students. The family's school is about 4 to 8 times more likely to use AQA, so
the content would probably be for the wrong board.

## 5. Not confirmed, and why

**Blocked by this session's network.** These pages could not be opened, and nothing from them was
guessed:

- `pearson.com` (the legal notice and permissions pages);
- `loginstatic.pearson.com` (the acceptable use policy);
- `cambridge.org` and `cambridgeassessment.org.uk`;
- `analytics.ofqual.gov.uk` (Ofqual's interactive data tool; the published data tables were enough).

**Open questions:**

- Whether the Pearson footer reservation exists and applies to qualification materials.
- Whether Cambridge University Press & Assessment's text and data mining terms cover OCR exam
  materials.
- The DfE subject content pages and their licence for English, French and Drama.

**Entries.** We found no Ofqual table of entries by board. Certificates are used instead, as stated
in section 1.

**Changes to the docs.** `docs/CONTENT_PLAN.md` builds "only for the board and tier combinations
actually selected". It also leaves Combined Science out of the initial set, while
`product-facts.md` lists it as a subject. This research doesn't change either doc. The product
owner decides whether "most-used board first" replaces that rule; if so, `CONTENT_PLAN.md` and its
initial set need updating.
