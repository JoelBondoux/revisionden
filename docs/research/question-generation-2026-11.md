# Question generation per subject (November 2026)

> Research document (workstream QG), checked 2026-11-26. Answers the owner's question: "Have we
> found solutions to generating all the other categories of questions yet?" For each subject it
> sets out the question types the exams use, how we could produce 600 to 1,000 verified items
> (`docs/CONTENT_PLAN.md`) with the strongest guarantee available, and what that costs the owner in
> review time. This is research, not a decision. No rule is changed here; proposals that would
> change a rule are listed in section 9. No personal data.

## Summary

**Short answer: partly.** Maths is solved. For the other subjects we now have a method for every
question type, but the strength of the guarantee varies a lot, and four subjects (English
Language, Drama, Film Studies and much of History) are mostly essay subjects with no way to make
volume without a lot of owner review.

**Four guarantee tiers** (section 1). Strongest first:

| Tier                  | What makes it right                                                                   | Owner review per 100 items (estimate) |
| --------------------- | ------------------------------------------------------------------------------------- | ------------------------------------- |
| (a) **Computed**      | Code works out the answer and a second, independent method checks it                  | About 8 minutes (10% sample)          |
| (b) **Source-quoted** | The answer is copied from an official or public-domain text and checked by code       | About 4 to 6 minutes (10% sample)     |
| (c) **Fact**          | Official citation plus the three model checks; a person samples or approves each item | About 20 minutes, up to 200           |
| (d) **Judgement**     | Essays and long answers, marked as a guide against level descriptors                  | About 10 minutes per prompt           |

**Best methods per subject** (detail in section 3, ranking in section 8):

| Subject                                    | Best method for volume                                                                        | Share that can be computed or source-quoted (estimate) |
| ------------------------------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| A-Level Maths and Further Maths            | Existing templates and SymPy (extend to calculus, vectors, matrices, complex numbers)         | 80 to 90%                                              |
| A-Level Computer Science                   | Code engines: number bases, logic, our own pseudocode interpreter, algorithm traces, SQL      | 60 to 70%                                              |
| GCSE and A-Level Physics                   | Templates with pint units, equations from the DfE list or the board's sheet                   | 40 to 50%                                              |
| GCSE Chemistry                             | Templates: moles, masses, concentration, yield, balancing (ChemPy plus our own checker)       | 30 to 40%                                              |
| GCSE French                                | Vocabulary from the DfE Annex E word list (official, Open Government Licence), grammar drills | 50 to 60%, but capped by the size of the DfE list      |
| GCSE English Literature                    | Quotes, speakers and scenes from public-domain set texts (14 of AQA's 25 texts)               | 30 to 40% for those texts; near 0% for modern texts    |
| GCSE Biology                               | Mostly facts from the specification; computed genetics crosses and magnification              | 10 to 15%                                              |
| GCSE History                               | Facts, plus chronology items computed from a verified date table                              | 10 to 20%                                              |
| GCSE English Language, Drama, Film Studies | Mostly judgement; small fact and terminology banks                                            | Under 10%                                              |

**Proofs of concept** (section 10): 5 physics items made by templates through the existing maths
engine with pint unit checks, and 5 French vocabulary items read from the DfE spreadsheet with
mechanical cell checks. Both work. Both also found real traps: the physics source marks Higher-tier
equations only by underlining, which text extraction loses; and French meanings must keep their
person markers ("(we) must") or a question can have two right answers.

**Biggest blockers are legal, not technical.** AQA leads 9 of our 15 subjects and its copyright
policy bars its material from AI-assisted works (`docs/research/board-shares-2026-11.md`). The
board-neutral DfE subject content (Open Government Licence) is the safest source for the
AQA-led sciences and French while that is settled.

## 1. The four guarantee tiers

### (a) Computed

**How.** A template draws parameters, code builds the question, answer, steps and explanation from
them, and an independent second method recomputes the answer from the question text before the
item is written (`docs/TEMPLATES.md`). Engines: SymPy (maths, already in place), pint (units),
ChemPy (equation balancing) next to our own chemical-equation check, and our own interpreters
for exam pseudocode.

**Why it is trustworthy.** The answer cannot disagree with the question: two methods must agree or
nothing is written. Every instance is reproducible from `template: {id, version, seed}`.

**Where it can still go wrong.**

- The **template idea** can be wrong: a misread equation, the wrong tier, a context that does not
  fit (a "trolley of mass 1,800 kg"). Both methods then agree on a wrong question. Mitigation:
  the template's source (equation, data value) must be a verified, cited record, and the owner
  reads the template preview.
- **Data** typed into code (a constant, a relative atomic mass) can be wrong. Rule already in
  `docs/TEMPLATES.md`: data only from cited, verified data sheets.
- **Rounding conventions** ("answers which round to"). Already a provisional ruling waiting for the
  owner (`docs/TEMPLATES.md`, "Risks and rulings").
- **Wording** can be unclear even when the maths is right. The blind answer and adversarial review
  (steps 3 and 4) still run on every item.

### (b) Source-quoted

**How.** The answer is copied from an authoritative text and checked by code: a word and its
meaning from the DfE French list, a line and its speaker from a public-domain play. The citation
points at the exact place (page, or sheet and row), and code confirms the quoted text is there.

**Why it is trustworthy.** Nobody writes the answer; it is the source's own words. A mechanical check
proves it was copied exactly from a file whose SHA-256 is recorded.

**Where it can still go wrong.**

- **The question around it.** "Who says this line?" is only fair if the line is said once. Code
  must check uniqueness in the whole text (our French proof of concept found a real case, section
  10.2).
- **Editions differ.** Shakespeare editions differ in wording and line numbers. Which editions a
  board accepts is not confirmed for AQA English Literature (section 3.2).
- **Display clean-up.** Source markers (`*`, `**`, `†`, "(m, f)") must be shown in a friendly way
  without changing meaning.
- **Typed answers with synonyms.** "Write the French for 'tomorrow'" may have a correct answer that
  is not on the list. Multiple choice or recognition (French to English) avoids this.

### (c) Fact

**How.** The current pipeline (`docs/VERIFICATION.md`): writer given only official excerpts, quote
check, blind answer by a second provider, adversarial review by a third pass, then owner approval
or batch sampling. Decisions 0008 and 0009 cover definitions and facts with no official source.

**Why it is trustworthy.** Every claim is tied to an official quote that code has found in the source,
and three separate model passes must agree.

**Where it can still go wrong.**

- A specification says what is **in scope**, rarely what is **true** (misadventure recorded in
  `project_memory/misadventures/content-sourcing.md`). Many biology, history and literature facts
  are not stated in any official document, so they fall back to "other authoritative" sources,
  which need individual owner approval.
- The models can share the same mistake. The owner's sample is the last line of defence.

### (d) Judgement

**How.** Essay and long-answer prompts with the board's level descriptors; three exemplar answers per
prompt, blind-marked by a second provider; every prompt approved individually; student answers
double-marked by AI and always labelled "Marked by AI" (`docs/VERIFICATION.md` sections 3 and 7).

**Why it is trustworthy.** It is not a right answer; it is guidance against the board's criteria, with
disagreements shown as "check with your teacher" rather than a mark.

**Where it can still go wrong.** Level descriptors and mark schemes are board material. For AQA
subjects that collides with AQA's AI clause. The accuracy bar (90% within one level, `docs/AI.md`)
has no golden set yet for any subject.

## 2. Across all subjects

### 2.1 Wrong options for multiple choice

A wrong option must be plausible and **provably wrong** (`docs/VERIFICATION.md` section 1).

| Method                      | How it works                                                                                                                       | Proof it is wrong                                                                                | Subjects                      |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------- |
| **Computed misconceptions** | Run the same calculation with a known slip: unit not converted, divided instead of multiplied, forgot to square, wrong sign        | Code: its value differs from the answer at the accuracy asked for; the item is refused otherwise | Maths, physics, chemistry, CS |
| **Same-group confusions**   | Pick options from the same group in the source (other indefinite adjectives, other organelles, other characters in the same scene) | Code: none of the option's meanings overlaps the answer's in the source table                    | French, biology tables, Lit   |
| **Verified fact table**     | Options are other rows of a verified table (other dates, other battles, other functions)                                           | Each row is itself verified; code checks the option's value differs from the asked property      | History, biology, chemistry   |
| **Written by a model**      | Allowed only as now: each wrong option cited (`distractor:N`) and checked in adversarial review                                    | The pipeline's steps 3 and 4 plus the owner's sample                                             | Anything else                 |

Rules for every method: options are shown with their text, never just an index (misadventure on
option numbering), no two options may be equal at the accuracy shown, and a computed misconception
that happens to give the right answer forces a fresh draw (the physics proof of concept does this).

### 2.2 Diagrams

The rule: SVG drawn by code from verified data, no AI images (`docs/VERIFICATION.md` section 4).

| Subject               | Diagrams needed                                                   | Library (licence, from PyPI on 2026-11-26)                                                                                                        | Notes                                                                                                          |
| --------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Physics               | Circuits, graphs (distance-time, velocity-time), waves, ray paths | schemdraw 0.23 (MIT); matplotlib 3.11.2 (Python Software Foundation licence)                                                                      | Build time only; component symbols must match the board's symbol list                                          |
| Chemistry             | Molecules, energy profiles, dot-and-cross                         | RDKit 2026.9.2 (BSD-3-Clause); matplotlib                                                                                                         | Dot-and-cross drawn from a computed electron arrangement                                                       |
| Biology               | Graphs, Punnett squares (a table, not an image), cells and organs | matplotlib; our own SVG templates                                                                                                                 | Cells and organs have no trustworthy code method: each is a hand-made SVG template needing individual approval |
| Maths (all levels)    | Function graphs, geometry, statistics charts                      | matplotlib (build time); JSXGraph or function-plot in the browser (licences in the tools survey)                                                  | Values come from the same SymPy computation                                                                    |
| Computer Science      | Logic circuits, graphs and trees, finite state machines           | schemdraw logic module (MIT); networkx 3.7 (BSD-3-Clause); graphviz 0.21 Python wrapper (MIT; the Graphviz program's own licence was not checked) | Layout by code, labels from the item data                                                                      |
| History               | Timelines                                                         | Our own SVG from the verified date table                                                                                                          | Dates are verified facts first                                                                                 |
| Drama                 | Stage areas (upstage left and so on)                              | Our own SVG grid                                                                                                                                  | Labels from a verified terminology table                                                                       |
| French, English, Film | None needed for the main question types                           | None                                                                                                                                              | Film stills are copyright: link out only                                                                       |

### 2.3 Owner review time, and how to cut it within the rules

These are **estimates** for planning, not measurements. They assume a reader who knows the topic,
the current review page (`docs/REVIEW_GUIDE.md`) and the sampling rule in
`docs/VERIFICATION.md` section 3 (a random 10% of each batch, at least 30 items).

| Tier                                                                                  | Seconds per item looked at (estimate) | Items looked at per 100 | Minutes per 100 items                               |
| ------------------------------------------------------------------------------------- | ------------------------------------- | ----------------------- | --------------------------------------------------- |
| Computed                                                                              | 45                                    | 10 (in batches of 300+) | About 8                                             |
| Source-quoted                                                                         | 25 to 35                              | 10 (in batches of 300+) | About 4 to 6                                        |
| Fact, official citation                                                               | 90 to 120                             | 10 (in batches of 300+) | About 15 to 20                                      |
| Fact, needing individual approval (decisions 0008 and 0009, other authoritative only) | 90 to 120                             | 100                     | About 150 to 200                                    |
| Judgement (each prompt with 3 exemplars)                                              | 600                                   | 100                     | About 1,000 (but only 20 to 40 prompts per subject) |

**Ways to cut review without changing a rule:**

1. **Batch in 300s.** The minimum of 30 is what costs most on small batches: a batch of 100 needs
   30 looked at (30%), a batch of 300 needs 30 (10%). Same rule, a third of the work.
2. **Keep items batchable.** Prefer an official citation (DfE subject content, the specification)
   over an "other authoritative" one, because the latter forces individual approval. For the
   sciences and French the DfE content often states the fact or the word directly.
3. **Show the evidence next to the claim.** For source-quoted items the review page can show the
   cited cell or line beside the question, so checking is a glance. For computed items, show the
   template preview once per template so the sample is read against it.
4. **Table view for vocabulary.** 20 words per screen with word, meaning, source row and options.
5. **Refuse early.** Generation drops any item that would need individual approval when a
   batchable alternative exists for the same learning point.
6. **Turn verified tables into many items.** A table of verified rows (dates, organelle functions,
   element data, character-scene-line) feeds several computed item types (ordering, matching, odd
   one out, multiple choice). The rows are verified once; each item still runs the full pipeline.

Changes that **would** need a rule change (for example a lower sample rate for computed items) are in
section 9.

## 3. Subject by subject

Each subject lists: the question types the exams use (cited), which types the app should support,
the method and tier per type, and a rough yield. "PDF page" is the page in the PDF file. Quotes are
from documents downloaded on 2026-11-26 unless said otherwise; SHA-256 values are in section 11.

### 3.1 GCSE sciences: Biology, Chemistry, Physics and Combined Science (AQA most used)

**What the exams use.** Each AQA science specification lists the same question types for every
paper: "Multiple choice, structured, closed short answer and open response." (Biology 8461, PDF
page 9; Chemistry 8462, Physics 8463, and Combined Science: Trilogy 8464, which writes "closed short
answer, and open response"). The assessment section adds: "Extended responses may be prose,
extended calculations, or a combination of both" (Biology 8461, section 5.1, PDF page 76;
same wording in 8462 and 8463). Each GCSE paper is a "Written exam: 1 hour
45 minutes" with "100 marks" (8461, PDF page 7).

**Board-neutral source.** DfE, _Biology, Chemistry and Physics GCSE subject content_ (Open
Government Licence) has every physics equation students must recall or select (Appendix 1, pages
46 and 47: 19 lines in list (a), 9 in list (b), Higher-only ones underlined), the SI units
(Appendix 2) and statements such as "calculate relative formula masses of species separately and in
a balanced" equation (PDF page 28) and "calculate the percentage yield of a reaction product" (PDF
page 31).

| Question type                             | Support? | Method and tier                                                                                                                                                                                                                                                                    |
| ----------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Calculations (all three)                  | Yes      | **(a) Computed.** Physics: every DfE equation, rearranged for each quantity, with unit prefixes. Chemistry: relative formula mass, moles, reacting masses, concentration, percentage yield, atom economy. Biology: magnification, percentage change, means, surface area to volume |
| Balancing equations                       | Yes      | **(a) Computed.** ChemPy `balance_stoichiometry` plus our own `chemical_equation` check (`scripts/verify/exact/chemistry.mjs`); two balancers must agree                                                                                                                           |
| Genetic crosses                           | Yes      | **(a) Computed.** Punnett squares and ratios worked out by code from the parents' alleles                                                                                                                                                                                          |
| Electron arrangements (first 20 elements) | Yes      | **(a) Computed** from the atomic number, once the rule is cited from the specification; dot-and-cross diagrams drawn from it                                                                                                                                                       |
| Multiple choice on facts                  | Yes      | **(c) Fact**, from the specification or DfE content; wrong options from verified tables (organelles and functions, tests and results)                                                                                                                                              |
| Closed short answer                       | Yes      | **(c) Fact**; marking by rule, AI only for wording variants (`docs/AI.md`)                                                                                                                                                                                                         |
| Graph and table reading                   | Yes      | **(a) Computed**: data generated by code, graph drawn from the same data, answer read off by code                                                                                                                                                                                  |
| Open response (6 marks)                   | Some     | **(d) Judgement**, as extended answers with level descriptors                                                                                                                                                                                                                      |
| Required practicals                       | Some     | Methods are **(c) Fact**; data analysis parts **(a) Computed** (gap 8)                                                                                                                                                                                                             |

**Combined Science** reuses the same items: the Trilogy content is a subset of the three separate
sciences, so it needs a mapping from each item to the Trilogy topic tree, not new generation.

**Data a template needs.** Relative atomic masses and A-Level constants must come from a cited
board data sheet (`docs/TEMPLATES.md`). The DfE content does not list atomic masses.

### 3.2 GCSE English Literature (AQA most used)

**What the exams use.** AQA 8702 (version 1.3, 28 September 2022). Paper 1 is a "written exam: 1
hour 45 minutes", "64 marks": "Section A Shakespeare: students will answer one question on their play
of choice. They will be required to write in detail about an extract from the play and then to
write about the play as a" whole (PDF page 8). Paper 2, "2 hour 15 minutes", "96 marks", has "Section
A Modern texts: students will answer one essay question from a choice of two", "Section B Poetry:
students will answer one comparative question on one named poem printed" on the paper and "Section C
Unseen poetry" (PDF page 9). Every exam question is an essay.

| Question type (app)                                         | Method and tier                                                                                                        |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Complete the quotation; who says this; which act or chapter | **(b) Source-quoted** from public-domain texts (6 Shakespeare plays, 7 19th-century novels, Animal Farm; tools survey) |
| Quote recognition with wrong options from the same scene    | **(b)**; wrong options are real lines by other speakers, checked by code                                               |
| Plot order (which happens first)                            | **(a) Computed** from the text's own act and scene order                                                               |
| Context, themes, terminology                                | **(c) Fact**; context rarely has an official source, so mostly individual approval                                     |
| Essays (extract then whole text; poetry comparison; unseen) | **(d) Judgement**; public-domain extracts can be printed in the app; anthology poems mostly cannot (gap 1)             |

Not confirmed: whether AQA names editions for its Shakespeare and novel texts (the 8702 text read
here was not searched for an edition list). It matters for quote wording (section 9, item 4).

### 3.3 GCSE English Language (AQA most used)

**What the exams use.** AQA 8700 (version 1.5, 14 October 2021), PDF page 8, Paper 1: "Reading (40
marks) (25%)– one single text", "1 short form question (1 x 4 marks)", "2 longer form questions (2 x
8 marks)", "1 extended question (1 x 20 marks)", and "Writing (40 marks) (25%)", "1 extended writing
question (24 marks for content, 16 marks for technical accuracy)". Paper 2 (PDF page 9): "two linked
texts", with longer form questions "(1 x 8, 1 x 12 marks)" and an extended question "(1 x 16 marks)".

| Question type (app)                                  | Method and tier                                                                                                                                                   |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Short retrieval (list things from a set of lines)    | **(b) Source-quoted** on public-domain extracts: the accepted answers are the extract's own phrases; still needs a person to judge the list of acceptable answers |
| Terminology (word classes, devices)                  | **(c) Fact**; definitions mostly fall under decision 0008 (individual approval)                                                                                   |
| Spelling, punctuation and grammar drills             | **(c) Fact**; small bank                                                                                                                                          |
| Language and structure analysis, evaluation, writing | **(d) Judgement**                                                                                                                                                 |

### 3.4 GCSE History (Pearson Edexcel most used)

**What the exams use.** Pearson Edexcel 1HI0, Issue 6 (June 2024). "Paper 1: Thematic study and
historic environment", "Written examination: 1 hour and 20 minutes", "52 marks"; Paper 2 "1 hour and
50 minutes", "64 marks"; Paper 3 "1 hour and 30 minutes", "52 marks" (PDF pages 8 and 9). "Question 2
is a two-part question, targeting AO3. It uses two contemporary sources." (PDF page 54). "Question 3
(b): this targets AO4 and uses two later written interpretations." (PDF page 56). "Many of the
questions that reward extended writing provide stimulus points" (PDF page 56). The specification
describes questions one by one; it does not list multiple choice. The sample assessment materials
were not read (not confirmed).

| Question type (app)                              | Method and tier                                                                                                   |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Key facts (who, what, where) as multiple choice  | **(c) Fact**; facts named in the specification are batchable; others need other authoritative sources (gap 4)     |
| Chronology: order these events, which came first | **(a) Computed** from a verified date table (each row a fact)                                                     |
| Timeline diagrams                                | Code-drawn SVG from the same table                                                                                |
| Source and interpretation questions              | **(d) Judgement**; primary sources from The National Archives or Hansard (text under open licences, tools survey) |
| Describe, explain, "how far" essays              | **(d) Judgement**                                                                                                 |

### 3.5 GCSE Drama (AQA most used; WJEC Eduqas runner-up)

**What the exams use.** AQA 8261 (version 1.7, 26 April 2022), PDF page 9: "Written exam: 1 hour and
45 minutes", "Section A: multiple choice (4 marks)", "Section B: four questions on a given extract
from the set play chosen (44 marks)", "Section C: one question (from a choice) on the work of theatre
makers in a single live theatre production (32 marks)". The roles students must know are listed on
PDF page 13 (playwright, performer, understudy, lighting designer and so on). AQA's set plays include
Romeo and Juliet (PDF page 14). WJEC Eduqas (version 10): "A series of questions on one set text from
a choice of seven" (PDF page 5), including Macbeth; "The extract selected for assessment in the
examination will be published within the question paper" (PDF page 21).

| Question type (app)                              | Method and tier                                                                   |
| ------------------------------------------------ | --------------------------------------------------------------------------------- |
| Multiple choice on theatre roles and stage terms | **(c) Fact** from the specification's role list; stage-area diagram drawn by code |
| Set play quotes (Romeo and Juliet, Macbeth only) | **(b) Source-quoted**                                                             |
| Extract questions as performer or designer       | **(d) Judgement**                                                                 |
| Live theatre evaluation                          | **(d) Judgement** only                                                            |

### 3.6 GCSE French (AQA most used)

**What the exams use.** AQA 8652 (first teaching 2024), scheme of assessment web page (the PDF was
blocked): Listening has "a range of comprehension question types in English, requiring non-verbal
responses or responses in English" and a dictation of "a minimum of 20 words" at Foundation and 30 at
Higher; Speaking has "Role-play (10 marks)", "Reading aloud task (15 marks)", "Discussion of Photo
card (25 marks)"; Reading includes "a translation of sentences from French into English"; Writing at
Higher includes "A translation of sentences from English into French, requiring a minimum of 50
words". "Access to dictionaries is not permitted". AQA's news page (16 September 2025): "The
vocabulary list totals are still 1,200 at Foundation tier and 1,700 at Higher tier". The DfE subject
content (2025, PDF page 6) requires "1,200 lexical items for foundation tier, and a further 500
lexical items for higher tier" and says lists "must include, as part of the 1,200 or 1,700 items,
the words listed at Annex E".

| Question type (app)                                | Method and tier                                                                                                      |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Vocabulary flashcards and multiple choice          | **(b) Source-quoted** from DfE Annex E (proof of concept, section 10.2); the rest of the list is the board's (gap 3) |
| Verb forms and grammar drills                      | **(a) Computed** by our own rule-based conjugator, cross-checked against Annex E's listed irregular forms            |
| Reading comprehension (multiple choice in English) | **(b)/(c)**: short texts we write only from listed words, with answers checked against the text; needs review        |
| Translation French to English                      | **(d) Judgement**-light: several right answers; accept lists plus AI wording check against meaning                   |
| Dictation                                          | **(b)**: the text is known exactly; audio from a pre-recorded voice (gap 7)                                          |
| Speaking, writing, English to French translation   | **(d) Judgement**                                                                                                    |

### 3.7 GCSE Film Studies (WJEC Eduqas only)

**What the exams use.** Eduqas C670QS (version 8), PDF page 4: "Component 1: Key Developments in US
Film Written examination: 1 hour 30 minutes 35% of qualification", with Section B "one multi-part
question on developments in film and film technology"; Component 3 is "Production Non-exam
assessment 30% of qualification". Set films with director, country and year are printed on PDF page
5 (for example "Rocks (Gavron, UK, 2019), 12A").

| Question type (app)                      | Method and tier                                                                        |
| ---------------------------------------- | -------------------------------------------------------------------------------------- |
| Set film facts (director, country, year) | **(b) Source-quoted** from the specification's own set film list (official, batchable) |
| Film language terminology                | **(c) Fact**                                                                           |
| Developments in film technology          | **(c) Fact**; mostly other authoritative sources                                       |
| Analysis essays                          | **(d) Judgement** (gap 2)                                                              |

### 3.8 A-Level Maths and Further Maths (Pearson Edexcel most used)

**Confirmed: the template approach extends.** 9MA0 (Issue 4, February 2020): three papers, each
"2-hour written examination", "100 marks" (PDF pages 9 and 10), "Calculators can be used in the
assessment.", and "The booklet Mathematical Formulae and Statistical Tables will be provided for use
in the assessments." (PDF page 33). 9FM0 (Issue 4, June 2023): papers of "1 hour and 30 minutes",
"75 marks" (PDF page 8), with the same booklet (PDF page 23).

- **Computed:** differentiation, integration, series, trigonometric identities, vectors, matrices,
  complex numbers, differential equations, numerical methods. SymPy does all of these; the existing
  `worked_maths` checks (`solve`, `expression`, line-by-line working) apply.
- **Statistics:** distributions and hypothesis tests computed with exact arithmetic; tables must
  match the board's statistical tables (cited).
- **Mechanics:** kinematics and forces as templates with units, as for physics.
- **Formula booklet:** a cited data source, like the physics equation sheet.
- **Judgement:** proof questions are worked by the student; the engine can check each line only when
  the proof is algebraic.

### 3.9 A-Level Physics (AQA most used; OCR runner-up)

**What the exams use.** AQA 7407/7408 (version 1.3), PDF page 9: Paper 1 is "60 marks of short and
long answer questions and 25 multiple choice questions on content"; Paper 2 the same (PDF page 10);
Paper 3 has "45 marks of short and long answer questions on practical experiments and data analysis".
AQA publishes "A-level Physics data and formulae For use in exams from the June 2017 Series onwards".

- **Computed:** most calculations, with pint; uncertainties and percentage uncertainty; graph
  gradients and intercepts from generated data.
- **Multiple choice:** computed misconceptions for numerical options; facts for the rest.
- **Data:** the data and formulae booklet is AQA material (AI clause) or OCR's for H556 (not read).

### 3.10 A-Level Computer Science (OCR most used)

**What the exams use.** OCR H446 (version 3.0, April 2026): two papers, "2 hours and 30 minutes",
"140 marks", "written paper (no calculators allowed)" (PDF page 10). Forms of assessment (PDF page 22,
two-column layout): "There will be a mix of questions" including short answer, longer answer and
"some higher tariff questions that will test the quality of extended responses". Section 5d (PDF
page 38): "The following guide shows the format pseudocode will appear in the examined components."
OCR also publishes a separate Pseudocode Guide (August 2015).

| Question type (app)                                               | Method and tier                                                      |
| ----------------------------------------------------------------- | -------------------------------------------------------------------- |
| Number bases, binary arithmetic, two's complement, floating point | **(a) Computed**                                                     |
| Boolean algebra, truth tables, Karnaugh maps, logic circuits      | **(a) Computed** (`sympy.logic`); circuit drawn by code              |
| Trace tables and program output in OCR pseudocode                 | **(a) Computed** by our own interpreter built from section 5d        |
| Algorithm steps (sorts, searches, Dijkstra, A\*, tree traversals) | **(a) Computed** by reference implementations; state after each step |
| SQL results                                                       | **(a) Computed** by running the query on a generated table (sqlite3) |
| Stacks, queues, hashing, linked lists                             | **(a) Computed**                                                     |
| Theory (legislation, ethics, hardware, networks)                  | **(c) Fact** from the specification                                  |
| Higher tariff extended responses                                  | **(d) Judgement**                                                    |

## 4. Licensing: what we may use

The detailed board-by-board terms are in `docs/research/competitors-2026-11.md` section 3.1 (read
directly 2026-11-25) and the AI terms in `docs/research/board-shares-2026-11.md` section 3. Quotes
below were re-read on 2026-11-26 unless marked.

| Material                                         | What the board says                                                                                                                                                                                                                                                                                                                                                   | What it means for a product with a paid tier (decision 0004)                                                                                                      |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pearson** papers, mark schemes, specifications | "may not be copied or made available electronically in whole or in part without permission from Pearson. This includes specifications, schemes of work, past question papers and mark schemes" (copyright policy page)                                                                                                                                                | No copying of questions or mark schemes. Short cited quotes in our private audit trail are the current practice; a permission request is already planned (Wave B) |
| **OCR**                                          | Centres may reproduce papers if "You don't charge students or anyone else"; "you must not publish any Cambridge OCR materials on your public website"; publishers "please email our Publisher Relationship Manager" (copyright page)                                                                                                                                  | The centre exemption is for schools only. Reuse in our app needs OCR's permission                                                                                 |
| **WJEC Eduqas**                                  | 6.3: "personal, non-commercial and class room use only"; 6.5: no "database of copyrighted content by downloading and storing large quantities of content" (terms, last updated October 2015)                                                                                                                                                                          | A paid tier is not "non-commercial". Keep only short citations, never a stored corpus                                                                             |
| **AQA**                                          | Policy page returned 403 this session. Read on 2026-11-25 (board-shares research): no AQA material in a third-party work "generated or produced using Artificial Intelligence". Specification back cover (A-level Physics, read today): "schools and colleges registered with AQA are permitted to copy material from this specification for their own internal use." | Nothing from AQA papers, mark schemes or reports in AI-assisted items until AQA answers                                                                           |
| **Third-party extracts in papers**               | Pearson: some papers "may not be made available ... because those copyright owners have not given permission for use beyond the original examination"; OCR: "these papers will have the third party content removed"                                                                                                                                                  | Even a board licence would not cover source texts inside English and History papers                                                                               |
| **Examiner reports**                             | Same copyright terms as papers for each board                                                                                                                                                                                                                                                                                                                         | Useful as references for common mistakes (distractor ideas) cited in the audit trail, not copied                                                                  |
| **Textbooks**                                    | Commercial copyright; not allowed as sources in `docs/VERIFICATION.md` section 2                                                                                                                                                                                                                                                                                      | Never used                                                                                                                                                        |
| **DfE subject content** (gov.uk)                 | Open Government Licence v3.0 (gov.uk page footer; checked for the science and French pages)                                                                                                                                                                                                                                                                           | Free to reuse with attribution, including commercially: the safest base for board-neutral items                                                                   |
| **Public-domain set texts**                      | UK copyright lasts "70 years after the author's death" (gov.uk, tools survey)                                                                                                                                                                                                                                                                                         | Quote freely; avoid copying a modern edition's layout                                                                                                             |

**UK copyright exceptions** (Intellectual Property Office guidance, https://www.gov.uk/guidance/exceptions-to-copyright,
read 2026-11-26): the teaching exception covers copying "solely to illustrate a point, it is not
done for commercial purposes", so it does **not** cover a paid tier; "Fair dealing for criticism,
review or quotation is allowed for any type of copyright work", with "a sufficient acknowledgement".
Whether short quotes from modern set texts in quiz items count as quotation is a legal question
(section 9, item 9).

**What we may do, in short:** link to board papers (the exam practice plan already does this,
`docs/EXAM_PRACTICE.md`); write our own questions in the board's style; cite short quotes from
specifications in the private audit trail; build freely from DfE content and public-domain texts.
We may not copy past paper questions, mark schemes or examiner reports into the app without the
board's written permission.

## 5. Gaps: no trustworthy method yet

Stated plainly, these have **no trustworthy way to make volume** today:

1. **Modern set texts and anthology poems** (English Literature: An Inspector Calls, Blood Brothers,
   most AQA poems; Drama: most set plays). Still in copyright, so we cannot import the text to quote
   from, and the teaching exception does not cover a paid product (section 4). Only short quotes
   for criticism or review may be possible, which needs a legal check. Items about them can only be
   facts or judgement.
2. **Set films** (Film Studies). Same problem, plus facts about films (director, year, scenes) are
   rarely in any official document, so they need "other authoritative" sources and individual
   approval.
3. **Full French vocabulary.** The DfE list covers 266 required headwords. The rest of the 1,200 to
   1,700 words is each board's own list; AQA's would hit AQA's AI clause.
4. **History facts beyond the specification.** Dates, people and events that the specification only
   names need other authoritative sources (The National Archives, Parliament: text under open
   licences, section 4 of the tools survey), so each needs individual approval.
5. **Biology diagrams of cells and organs.** No code method draws them from data; each would be a
   hand-made SVG with individual approval.
6. **English Language reading and writing.** The exam is almost all reading responses to unseen
   texts and extended writing. We can make terminology items and use public-domain extracts, but the
   bulk of the exam is judgement.
7. **Speaking and listening (French).** Listening needs audio we can trust (pre-recorded from
   verified text with an on-device or self-hosted voice; the voice's accuracy is not something
   code can check). Speaking marking is judgement and involves the child's voice (privacy review).
8. **Required practicals and "working scientifically".** Questions on methods, variables and errors
   are facts at best; nothing computes them, apart from data-handling parts (means, uncertainty,
   graphs from generated data).
9. **Golden sets for essay marking.** `docs/AI.md` sets 90% within one level on 50 essays per
   subject. No subject has a golden set yet, and making one needs marked essays we may use.

## 6. Rough yield per subject

Order-of-magnitude **estimates** for planning a bank of about 800 items per subject, using the
review times in section 2.3. "Individual" means items needing one-by-one approval under the current
rules. Judgement prompts are counted separately (target 20 to 40 per subject).

| Subject                  | Computed | Source-quoted | Fact (batch / individual) | Judgement prompts | Owner hours (estimate)   | Reaches 600+ verified items?           |
| ------------------------ | -------- | ------------- | ------------------------- | ----------------- | ------------------------ | -------------------------------------- |
| A-Level Maths            | 700      | 0             | 80 / 20                   | 0                 | 2                        | Yes                                    |
| A-Level Further Maths    | 700      | 0             | 80 / 20                   | 0                 | 2                        | Yes                                    |
| A-Level Computer Science | 500      | 0             | 250 / 50                  | 20                | 6                        | Yes                                    |
| GCSE Physics             | 350      | 0             | 400 / 50                  | 20                | 6 to 7                   | Yes                                    |
| A-Level Physics          | 400      | 0             | 350 / 50                  | 20                | 6 to 7                   | Yes                                    |
| GCSE Chemistry           | 300      | 0             | 450 / 50                  | 20                | 6 to 7                   | Yes                                    |
| GCSE French              | 150      | 600           | 50 / 0                    | 20                | 4                        | Yes, but vocabulary incomplete (gap 3) |
| GCSE Biology             | 100      | 0             | 550 / 150                 | 20                | 9 to 10                  | Yes                                    |
| GCSE English Literature  | 50       | 400           | 100 / 200                 | 40                | 13                       | Only for public-domain texts           |
| GCSE History             | 150      | 0             | 200 / 250                 | 40                | 19 (plus the date table) | Slowly                                 |
| GCSE English Language    | 0        | 100           | 100 / 200                 | 40                | 13                       | No (about 400)                         |
| GCSE Drama               | 0        | 100           | 200 / 150                 | 30                | 10                       | No (about 450)                         |
| GCSE Film Studies        | 0        | 50            | 150 / 200                 | 30                | 11                       | No (about 400)                         |
| GCSE Combined Science    | Reused   | Reused        | Reused                    | Reused            | Mapping check only       | Yes, from the three sciences           |

Batching in 300s (section 2.3) is assumed. Without it, small batches roughly triple the sampled
share for computed and source-quoted items.

## 7. What each method needs to be built

| Build                                                                                                                            | For                                                                      | Kind                      | Size (S, M, L) | Notes                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **More maths template modules**                                                                                                  | A-Level Maths, Further Maths                                             | Engine module             | M each topic   | SymPy already does calculus, series, matrices, complex numbers; templates as in `docs/TEMPLATES.md`                                                       |
| **Science template support** (`QuantityParam`, pint, ChemPy)                                                                     | Physics, Chemistry, Combined Science                                     | Engine module             | M              | Designed in `docs/TEMPLATES.md`; the proof of concept shows the engine needs no change for values                                                         |
| **DfE physics equations as a verified equation sheet**, with a `tier` per equation                                               | GCSE Physics, Combined Science                                           | Data import + check       | S              | 28 lines on pages 46 and 47; tier from underlining, read from the rendered page                                                                           |
| **Board data sheets** (relative atomic masses, A-Level data and formulae booklet)                                                | Chemistry, A-Level Physics                                               | Data import               | S each         | Board material: board choice and AI terms decide which (section 4)                                                                                        |
| **Spreadsheet location in the quote checker** ("sheet, row, cell")                                                               | French                                                                   | Checker                   | S              | Today it reads PDFs and web pages only                                                                                                                    |
| **French vocabulary generator** (cell import, meaning splitter keeping person markers, display clean-up, same-group distractors) | French                                                                   | Generator                 | S–M            | From the proof of concept                                                                                                                                 |
| **French grammar drills** (regular conjugation by the DfE grammar rules, irregular forms from Annex E)                           | French                                                                   | Engine module             | M              | Our own rule-based conjugator; ML conjugators (mlconjug3, verbecc: their PyPI summaries say "Machine Learning") only as a third opinion, never the source |
| **Set-text import** (public-domain play and novel text, structured by act, scene, speaker, chapter)                              | English Literature, Drama (Romeo and Juliet)                             | Data import + checker     | M              | Needs an edition decision and a new source type (section 9)                                                                                               |
| **Line and speaker uniqueness checker**                                                                                          | English Literature                                                       | Checker                   | S              | "Who says this?" only when the line occurs once                                                                                                           |
| **Number representation and logic engine** (bases, two's complement, floating point, truth tables with `sympy.logic`)            | Computer Science                                                         | Engine module             | M              | All answers computed                                                                                                                                      |
| **Exam pseudocode interpreter** (OCR Exam Reference Language; AQA pseudo-code)                                                   | Computer Science (GCSE ERL is in OCR J277; the H446 guide not confirmed) | Engine module             | M–L            | Traces, outputs and trace tables                                                                                                                          |
| **Algorithm tracers** (sorts, searches, graph algorithms with networkx, stacks and queues, SQL with Python's built-in sqlite3)   | Computer Science                                                         | Engine module             | M              | Each state after each step computed                                                                                                                       |
| **Fact-table pipeline** (verify rows once, generate ordering, matching and odd-one-out items from rows)                          | History, Biology, Chemistry, Drama                                       | Generator + review screen | M              | Rows go through the full pipeline; so does every item                                                                                                     |
| **Diagram builders** (schemdraw, matplotlib, RDKit, networkx at build time)                                                      | Physics, Chemistry, Maths, CS                                            | Build step                | M              | SVG from the item data; alt text from the same data                                                                                                       |
| **Review screen: table view and evidence panel**                                                                                 | All, mainly French and computed items                                    | Web feature               | S–M            | Cuts owner minutes (section 2.3)                                                                                                                          |
| **Golden sets for essay marking**                                                                                                | Judgement subjects                                                       | Evaluation data           | L              | Needs marked essays we may use                                                                                                                            |

## 8. Ranked plan

Ranked by **verified volume per unit of effort**, then by legal risk. A recommendation, not a
decision. Board choice follows `docs/research/board-shares-2026-11.md` (most-used board first,
AQA subjects on hold until AQA answers).

| Rank | Subject and method                                                                                 | Why this order                                                                          | Needs                                                                                                               |
| ---- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 1    | **A-Level Maths and Further Maths: templates** (Pearson Edexcel)                                   | Engine and template system exist; 80 to 90% computable; owner review smallest           | Template modules; the formula booklet as a cited source; Pearson's answer on AI terms (Wave B)                      |
| 2    | **A-Level Computer Science: code engines** (OCR)                                                   | 60 to 70% computable; OCR has no AI clause found (Wave A)                               | Number and logic engine, pseudocode interpreter, algorithm tracers                                                  |
| 3    | **GCSE Physics and Combined Science physics: templates from the DfE equations**                    | Board-neutral DfE source sidesteps AQA's clause for the answers; proof of concept works | `QuantityParam`, pint, the DfE equation sheet with tiers; topic mapping to the board's tree is still board material |
| 4    | **GCSE French: DfE vocabulary and grammar drills**                                                 | Official list under an open licence; cheap to build; small review cost                  | Spreadsheet cell check, vocabulary generator, conjugator                                                            |
| 5    | **GCSE Chemistry: calculation and balancing templates**                                            | Good computed share; needs a relative atomic mass table                                 | Data sheet source decision; ChemPy                                                                                  |
| 6    | **A-Level Physics: templates**                                                                     | Same engine as GCSE; board data booklet needed                                          | Board choice (AQA 55.2%, OCR 32.6%)                                                                                 |
| 7    | **GCSE English Literature: public-domain set texts, source-quoted**                                | Large, exact, mechanically checkable bank for 14 texts                                  | Text import, edition decision, new source type (section 9)                                                          |
| 8    | **GCSE Biology and History: fact tables**                                                          | Mostly facts; tables multiply each verified row into several items                      | Fact-table pipeline; many rows need individual approval                                                             |
| 9    | **Judgement subjects: English Language, Drama, Film Studies, and the essay parts of all subjects** | Smallest verified volume per hour; essay marking needs golden sets                      | Prompts with level descriptors, exemplars, golden sets                                                              |

## 9. Needs owner decision

None of these is changed by this document. Each would change or add to a rule.

1. **Lower sample rate for computed items.** For example 3% (at least 10) instead of 10% (at least 30) for template items whose cross-check passed. Saves about two thirds of review on computed
   items. Risk: a wrong template idea (section 1a) is found later.
2. **Template-level approval.** The owner approves a template's preview once; its instances then
   need only the automated steps and the sample. Today every instance is sampled like any item.
3. **A new source type for primary texts.** Public-domain set texts are the most authoritative
   source for their own words but are not "official" in `docs/VERIFICATION.md` section 2, so items
   citing only them would need individual approval. Options: a `set_text` source type that counts
   as official for quotations only, with the board's set-text list cited for scope.
4. **Which edition of a set text.** Shakespeare and novel editions differ. Pick one plain-text
   source per text (and record its hash), or accept any edition's wording only when several agree.
5. **Rows of a verified fact table.** Whether items generated from individually approved rows may
   then be batch-sampled, rather than each needing individual approval when the row's source is
   "other authoritative".
6. **Board-neutral science items now.** Build physics and chemistry calculations from the DfE
   subject content while AQA's answer is awaited, accepting that the topic map still follows the
   board's specification.
7. **Rounding of intermediate values** ("answers which round to"). Already provisional in
   `docs/TEMPLATES.md`; the science templates need it settled.
8. **Spreadsheet citations.** A "sheet, row, cell" location in `docs/VERIFICATION.md` section 9, for
   the DfE French list.
9. **Legal checks** (owner and solicitor): short quotes from in-copyright set texts and films under
   the quotation exception; AQA and Pearson written answers on AI terms (already open in
   `project_memory/operations/contradictions.md`).

## 10. Proofs of concept

Both were run in this session on 2026-11-26. The items are shown here only; nothing was added
to `content/`. The scripts are kept next to this document for anyone who wants to repeat them
(`docs/research/question-generation-poc/`); they are research code, not product code.

### 10.1 Physics numeric items (computed, through the existing maths engine)

**Source.** DfE, _Biology, Chemistry and Physics GCSE subject content_ (June 2015, updated May
2019), Appendix 1 "Equations in physics", list (a) "students should be able correctly to recall,
and apply the following relationships, using standard S.I.Units". Board-neutral and under the Open
Government Licence (gov.uk page footer), so AQA's AI clause does not arise.

- URL: https://assets.publishing.service.gov.uk/media/5cd2b951ed915d50c208b4d5/GCSE_single_science_updated_May_2019.pdf
- SHA-256: `511abad44dc6752a4d92bd8176e6a56e5eae3bd2f3159f10e18638c65039ad62`
- Location: Appendix 1, (a), page 46 (PDF page 46). All five quotes below were found on that page
  by exact text search, and checked against a rendered image of the page.

**Method.** `poc_physics.py`, with SymPy 1.13.3 (as pinned) and pint 0.24.4:

1. **Write.** Draw whole-number givens in display units (cm, mA, minutes, kΩ, g), convert them to
   SI with pint (`UnitRegistry(non_int_type=Fraction)`, exact fractions), multiply, round half up to
   2 significant figures.
2. **Engine.** The existing maths engine check (`app.content_check`, kind `value` with
   `significant_figures`, the code `pnpm content:validate` runs) confirms the rounded answer from the
   SI expression. No engine change was needed.
3. **Recheck.** Independent of the template's formula and of pint: read the numbers and units back
   from the question text, convert with a hand-written prefix table, and multiply the quantities
   **named in the cited equation text** ("momentum = mass x velocity"). Also checks that the answer
   unit has the right dimension (pint dimensionality).
4. **Distractors.** Two computed misconceptions per item. If either equals the answer (or the other)
   at 2 significant figures, the draw is thrown away.
5. **Self-test.** A deliberately broken template (answer doubled) is refused by the engine check.

**Items** (seed 1 of each template):

| #   | Question                                                                                                                                                                   | Answer     | Computed wrong options (misconception)                                   | Quote cited (supports question)                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------ | ---------------------------------------------- |
| P1  | A water wave has a frequency of 3 Hz and a wavelength of 90 cm. Calculate the wave speed in m/s. Give your answer to 2 significant figures.                                | 2.7 m/s    | 270 (wavelength left in cm); 3.3 (divided instead of multiplied)         | "wave speed = frequency x wavelength"          |
| P2  | A current of 350 mA flows through a lamp for 4 minutes. Calculate the charge that flows, in coulombs. Give your answer to 2 significant figures.                           | 84 C       | 1.4 (time left in minutes); 84000 (current left in mA)                   | "charge flow = current x time"                 |
| P3  | A current of 8 mA flows through a resistor of resistance 3 kΩ. Calculate the potential difference across the resistor in volts. Give your answer to 2 significant figures. | 24 V       | 0.024 (only the mA converted); 0.0000027 (divided instead of multiplied) | "potential difference = current x resistance"  |
| P4  | A ball of mass 300 g moves at a velocity of 24 m/s. Calculate its momentum in kg m/s. Give your answer to 2 significant figures.                                           | 7.2 kg m/s | 7200 (mass left in grams); 0.013 (divided instead of multiplied)         | "momentum = mass x velocity" (**Higher only**) |
| P5  | A trolley of mass 1300 g accelerates at 16 m/s². Calculate the resultant force on the trolley in newtons. Give your answer to 2 significant figures.                       | 21 N       | 21000 (mass left in grams); 0.081 (divided instead of multiplied)        | "force = mass x acceleration"                  |

**Checks recorded per item:** maths engine pass; recheck pass; unit dimension pass
(`exact.quantity` such as `[mass]*[length]/[time]`); quote found on the stated page. Not run:
blind answer, adversarial review and owner review (they cost money or need the owner, and these
items are not going into content).

**What the proof of concept found:**

- **Tier is shown only by underlining.** The page says "Equations required for higher tier only are
  underlined". Text extraction loses underlining. The rendered page shows "momentum = mass x
  velocity" underlined, so P4 is Higher tier only. A science equation sheet in `content/` needs a
  `tier` per equation, checked against the rendered page, and templates must copy it.
- **The engine needs no change for science numbers.** Units are handled before the engine (pint and
  the existing `units` exact check).
- **Plausibility needs a rule.** "Divided instead of multiplied" gave 0.0000027 V for P3: wrong for
  sure, but no student would pick it. A distractor rule such as "within a factor of 1,000 of the
  answer" would drop it. That is a quality heuristic, not a correctness rule.
- **Contexts need a reviewed list.** The template allows a 1,800 g trolley; that is fine, but the
  same numbers on a "car" would not be. Contexts must be tied to sensible ranges (already in the
  science design in `docs/TEMPLATES.md`).

### 10.2 French vocabulary items (source-quoted, from the DfE list)

**Source.** DfE, _French, German and Spanish GCSE subject content: annex E_ (September 2025),
"Required and optional vocabulary which the grammar annexes require for each of French, German,
and Spanish". Spreadsheet; gov.uk page under the Open Government Licence v3.0.

- URL: https://assets.publishing.service.gov.uk/media/68c2aa12eeb238b20672a9be/French__German_and_Spanish_GCSE_subject_content_annex_E_September_2025.xlsx
- SHA-256: `02104b69dfe1c301c6bccb2430bef328bd382b25a26b136c95c656e2b7bd1a5c`
- Only rows tagged **Y** were used. The Overview sheet says rows tagged "Y †" need a space on the
  list "but the choice of exemplar word is at the discretion of the list creator", so a Y† word may
  not be on a board's list.

**Method.** `poc_french.py` (pandas and openpyxl):

1. **Cell check.** Each citation quotes one cell (headword in column B, English in column C) with
   its sheet and row. Code re-reads that cell from the file with the recorded SHA-256 and requires an
   exact match.
2. **Same-group distractors.** Wrong options come from the same "Grammar feature" group as the
   answer (other indefinite adjectives, other irregular comparatives, other modal verbs), so they are
   plausible.
3. **Provably wrong.** Code splits each English cell into meanings (the Overview explains `|`, `;`
   and `,`) and refuses any wrong option that shares a meaning with the answer. Self-test: offering
   "tous" as a wrong option for "tout(e)(s)" is refused (both mean "all, the whole").
4. **Uniqueness.** Code lists every other headword in all four French sheets that shares a meaning
   with the answer, so a reviewer sees any ambiguity.

**Items** (all from sheet `French_required_words_(F)`):

| #   | Type            | Question / front                 | Answer / back      | Wrong options (row)                                                              | Cells cited                  |
| --- | --------------- | -------------------------------- | ------------------ | -------------------------------------------------------------------------------- | ---------------------------- |
| F1  | Flashcard       | pire(s)                          | worse              | None                                                                             | B261, C261                   |
| F2  | Flashcard       | ne...jamais                      | never, not ever    | None                                                                             | B88, C88                     |
| F3  | Multiple choice | What does "chaque" mean?         | each, every        | several, many (61); same (62); other (63)                                        | B60, C60, C61, C62, C63      |
| F4  | Multiple choice | Which French word means "worse"? | pire(s)            | meilleur(e)(s) (259); bon (257); mal (260)                                       | C261, B261, B259, B257, B260 |
| F5  | Multiple choice | What does "devons" mean?         | (we) have to, must | (we) are able to, can (208); (we) know (how to), can (214); (we) want (to) (220) | B202, C202, C208, C214, C220 |

Questions and options are shown after the display clean-up described below; the script's raw output
keeps each cell's exact text (for example "Which French word means 'worse (m, f) (pl)'?" and "mal\*").

Every citation: `source_type` `dfe_subject_content`, publisher DfE, the URL and SHA-256 above,
`retrieved_at` 2026-11-26, location such as "sheet French*required_words*(F), row 261, cell C261
(grammar feature: Irregular comparative (adj))", quote the exact cell text (for example
`worse (m, f) (pl)`), and `supports` `front`/`back`, `question`/`answer` or `distractor:N`.

**Checks recorded per item:** cell check pass for every citation (5 of 5 items); distractor overlap
check pass; uniqueness report empty for F1 to F4.

**What the proof of concept found:**

- **Person markers matter.** For F5 the uniqueness report listed "must" as a meaning of every form
  of devoir (dois, doit, devez, doivent) in both tiers. The meaning cell is "(we) have to, must": the
  "(we)" applies to both meanings, but a naive split loses it. French to English is still fair (the
  options all say "(we)"), but an English to French question built from "must" alone would have
  several right answers. Rule for the generator: keep the person marker with every meaning.
- **Display needs a clean-up step.** Cells carry list markers (`mal*` is the first of two entries
  for "mal") and notes such as "(m, f) (pl)". The app must show "mal" and "worse", while the
  citation keeps the exact cell. The clean-up must be a fixed, tested function so it cannot change
  meaning.
- **Long cells make poor flashcards.** Verb forms such as "boit" list several meanings separated by
  `|`. The blind answer for flashcards compares words, so these suit multiple choice better.
- **The quote checker needs a spreadsheet location.** `pnpm content:quote-check` reads PDFs and web
  pages with page or code locations. A "sheet, row, cell" location for `.xlsx` and `.ods` files is
  a small addition (section 7).
- **Volume is capped.** The French sheets have 198 Foundation and 247 Higher required (Y) entries,
  266 different headwords in all, mostly grammar words and verb forms. That is about 600 to 800
  items at most (recognition, production and multiple choice per word), not the full 1,200 to 1,700
  words a student needs. The full lists are the boards' own (section 3.6).

## 11. Sources, not confirmed, and hosts needed

**Read directly on 2026-11-26** (SHA-256 of the file read):

| Document                                                                           | URL                                                                                                                                                               | SHA-256                                                            |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| DfE Biology, Chemistry and Physics GCSE subject content (updated May 2019)         | https://assets.publishing.service.gov.uk/media/5cd2b951ed915d50c208b4d5/GCSE_single_science_updated_May_2019.pdf                                                  | `511abad44dc6752a4d92bd8176e6a56e5eae3bd2f3159f10e18638c65039ad62` |
| DfE French, German and Spanish GCSE subject content (2025)                         | https://assets.publishing.service.gov.uk/media/68da4b56dadf7616351e4b48/French_German_and_Spanish_GCSE_subject_content_2025.pdf                                   | `805c9b4075117eefa34a71f5f517a16a91e129a9f5b14606470d2112eeae9a09` |
| DfE annex E (September 2025, spreadsheet)                                          | https://assets.publishing.service.gov.uk/media/68c2aa12eeb238b20672a9be/French__German_and_Spanish_GCSE_subject_content_annex_E_September_2025.xlsx               | `02104b69dfe1c301c6bccb2430bef328bd382b25a26b136c95c656e2b7bd1a5c` |
| AQA GCSE Biology 8461 specification (version 1.0)                                  | https://filestore.aqa.org.uk/resources/biology/specifications/AQA-8461-SP-2016.PDF                                                                                | `effa4236b6250dd1309f6640bb6b1fb5b1acee870c2b4c689b7d7ac2a1af3f48` |
| AQA GCSE Chemistry 8462 specification (version 1.1)                                | https://filestore.aqa.org.uk/resources/chemistry/specifications/AQA-8462-SP-2016.PDF                                                                              | `ecd869d1874091a0a52abaeb8fce238a9c1cc207698713dfb66788eb0d448d43` |
| AQA GCSE Physics 8463 specification (version 1.1)                                  | https://filestore.aqa.org.uk/resources/physics/specifications/AQA-8463-SP-2016.PDF                                                                                | `b0ece1dba5a0f5d5aa1d72dda48ec8846773fee4e00f8cebde98fbc554e36bb1` |
| AQA GCSE Combined Science: Trilogy 8464 specification (version 1.1)                | https://filestore.aqa.org.uk/resources/science/specifications/AQA-8464-SP-2016.PDF                                                                                | `d9de6e1889d675861a814c21eb5509fe1b7941452dc0c4794dfc9927e9b6c894` |
| AQA GCSE English Language 8700 specification (version 1.5)                         | https://filestore.aqa.org.uk/resources/english/specifications/AQA-8700-SP-2015.PDF                                                                                | `261d2dbe7dc5335e1d89aafd9164c824e428d0f34742f652e71e182b068635e5` |
| AQA GCSE English Literature 8702 specification (version 1.3)                       | https://filestore.aqa.org.uk/resources/english/specifications/AQA-8702-SP-2015.PDF                                                                                | `3b7d3b63998b6fd8b1bfbc169fcde53cf7b9d395da778f45e9b9c9e23c03aebe` |
| AQA GCSE Drama 8261 specification (version 1.7)                                    | https://filestore.aqa.org.uk/resources/drama/specifications/AQA-8261-SP-2016.PDF                                                                                  | `43aea3ce41b7f403b2941b70be226099f6a4a6241d62dd756e223f9319b2d1da` |
| AQA AS and A-level Physics 7407/7408 specification (version 1.3)                   | https://filestore.aqa.org.uk/resources/physics/specifications/AQA-7407-7408-SP-2015.PDF                                                                           | `32a556da85fa0928c3600f8178d1a18fe5156b2ea36d76b541df866451721e20` |
| AQA A-level Physics data and formulae (version 1.5)                                | https://filestore.aqa.org.uk/resources/physics/AQA-7408-SDB.PDF                                                                                                   | `65dfc4921a7c7a5e412cab458d7acc884ac64cf9c0c04c3634c7e31febbedac3` |
| AQA GCSE French 8652 scheme of assessment (web page)                               | https://www.aqa.org.uk/subjects/french/gcse/french-8652/specification/scheme-of-assessment                                                                        | Web page; changes per fetch                                        |
| AQA news: GCSE French, German and Spanish updates summer 2026                      | https://www.aqa.org.uk/news/gcse-french-german-and-spanish-updates-summer-2026                                                                                    | Web page; changes per fetch                                        |
| Pearson Edexcel GCSE History 1HI0 specification (Issue 6)                          | https://qualifications.pearson.com/content/dam/pdf/GCSE/History/2016/specification-and-sample-assessments/gcse-9-1-history-specification.pdf                      | `a5d760fd3856bf16cc724ca33794d7b57b0e1c5d41c9d792a3001629c0fe9c09` |
| Pearson Edexcel A level Mathematics 9MA0 specification (Issue 4)                   | https://qualifications.pearson.com/content/dam/pdf/A%20Level/Mathematics/2017/specification-and-sample-assesment/a-level-l3-mathematics-specification-issue4.pdf  | `b008c50064090bab5c3e26e1f3c97778d21b492d5b839219f73eca11828ecef8` |
| Pearson Edexcel A level Further Mathematics 9FM0 specification (Issue 4)           | https://qualifications.pearson.com/content/dam/pdf/A%20Level/Mathematics/2017/specification-and-sample-assesment/a-level-l3-further-mathematics-specification.pdf | `2cf7b23180c528e6c6a93ce805148d287d780b22ae13fb5c96840ee4786108ba` |
| OCR A Level Computer Science H446 specification (version 3.0)                      | https://www.ocr.org.uk/Images/170844-specification-accredited-a-level-gce-computer-science-h446.pdf                                                               | `8551bc2636fa4d8718d97901b462b0642b4bb6148e06407f662c507750764a44` |
| OCR H046/H446 Pseudocode Guide (August 2015)                                       | https://www.ocr.org.uk/Images/260952-pseudocode-guide.pdf                                                                                                         | `dcf469a28808b7d16d812c12317edbad664960de1de021189f30ddc2870a72da` |
| WJEC Eduqas GCSE Film Studies specification (version 8)                            | https://www.eduqas.co.uk/media/sjyhrqeu/eduqas-gcse-film-studies-spec-from-2017-e-16-08-23-1.pdf                                                                  | `261f0840f99365d022e216e469dd173aabc991a53f017c1b375d7cdfce23e016` |
| WJEC Eduqas GCSE Drama specification (version 10)                                  | https://www.eduqas.co.uk/media/hydhvd02/eduqas-gcse-drama-spec-from-2016-e-270824.pdf                                                                             | `f1c490d28fab6435023e131e341966caa960cf2c75632309abff0afe02b2be54` |
| Board copyright pages (Pearson, OCR copyright and past paper policy, Eduqas terms) | As linked in section 4                                                                                                                                            | Web pages                                                          |
| IPO guidance: Exceptions to copyright                                              | https://www.gov.uk/guidance/exceptions-to-copyright                                                                                                               | Web page                                                           |
| Package licences (PyPI JSON API)                                                   | pint, sympy, chempy, rdkit, schemdraw, matplotlib, networkx, graphviz, mlconjug3, verbecc, openpyxl, lark                                                         | Registry data                                                      |

**Not confirmed:**

- AQA's copyright policy page (403 this session; quoted from the 2026-11-25 research instead).
- AQA GCSE French 8652 specification PDF and vocabulary list page (403; the PDF link is on
  `cdn.sanity.io`, which is not allowed).
- Sample assessment materials for every subject (the question types above come from specifications
  only).
- Whether AQA prescribes editions for English Literature set texts.
- OCR A Level Physics H556 specification and data booklet.
- The Graphviz program's licence.
- The owner-review timings in sections 2.3 and 6 are estimates, not measurements.

**Hosts needed to check the rest:** `cdn.sanity.io` (AQA documents), `www.cambridge.org` (OCR's
parent company terms), `www.gutenberg.org` and `standardebooks.org` (set-text sources),
`pearson.com` and `loginstatic.pearson.com` (Pearson's wider terms), and the AQA copyright pages on
`www.aqa.org.uk` (returned 403 rather than being blocked, so a retry may work).
