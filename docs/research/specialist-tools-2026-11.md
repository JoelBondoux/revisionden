# Specialist tools per subject (November 2026)

> Research document, checked 2026-11-25. Lists engines, libraries, data sources and services, other
> than AI chat models, that could make RevisionDen's content more accurate or richer, for each
> subject in `docs/CONTENT_PLAN.md` plus Combined Science. No personal data. Nothing was signed up
> for. This is research, not a decision.

## How to read this

**How each kind of source was checked.**

- **Read directly in this session:**
  - Licences of open-source packages, from the PyPI, npm and Maven Central registries (the
    licence the maintainer declares).
  - gov.uk pages, including DfE subject content and the UK copyright term.
  - ocr.org.uk and AQA specification pages and PDFs.
  - Hugging Face model cards.
- **Not checked directly (blocked):** most product sites are blocked by this session's network.
  Claims about them come from search results limited to the provider's own website, marked
  **[extract]**. Re-check prices and terms on the live page before relying on them.
- **"Not confirmed"** means we could not see the figure or term.

**Rules that decide what fits.**

- **Paid use matters.** Decision `0004-pricing-plan` plans a paid Premium tier for a public
  release. So we treat "allowed in a paid product" as required. Non-commercial licences only work
  while the app stays a free family app.
- **No third parties in the web app** (`docs/PRIVACY.md`, principle 6). Widgets loaded from
  another company's servers (GeoGebra, Desmos, PhET, CircuitVerse iframes) break this rule. Only
  self-hosted copies fit.
- **Diagrams are SVG drawn by code from verified data** (`docs/VERIFICATION.md`, section 4).
  Third-party diagram images can be references, not our teaching images.
- **Student data.** Any service that would receive a child's answers, voice or photos needs a
  privacy review and probably parental consent. Prefer on-device or self-hosted.

**Columns in the tables:**

- **Runs:** **W** = Cloudflare Workers, **B** = browser, **P** = our Python service (Cloud Run),
  **H** = hosted by the provider only.
- **Effort:** S, M or L.

---

## 1. Per-subject tables

### Maths (GCSE, A-Level Maths and Further Maths)

| Tool                                   | What it does for us                                          | Accuracy / authority                                       | Licence and paid use                                                                                                                                                   | Cost (source, date)                                                                                                                                       | Student data leaves us?                                                         | Runs                      | Effort          |
| -------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------- | --------------- |
| **SymPy** (current)                    | Checks working line by line; answer equivalence              | Mature computer algebra system; our engine already uses it | BSD (PyPI `sympy` 1.14.0; we pin 1.13.3). Paid use OK                                                                                                                  | £0                                                                                                                                                        | No                                                                              | P                         | In place        |
| **KaTeX**                              | Renders maths notation in questions and answers              | Widely used renderer                                       | MIT (npm `katex` 0.19.1). Paid use OK                                                                                                                                  | £0                                                                                                                                                        | No (self-hosted bundle)                                                         | B, W (server-side render) | S               |
| MathJax                                | Alternative renderer; better screen-reader output            | Long-standing standard                                     | Apache-2.0 (npm `mathjax` 4.1.3)                                                                                                                                       | £0                                                                                                                                                        | No                                                                              | B                         | S               |
| **MathLive**                           | Maths input box for students' typed working                  | Mature                                                     | MIT (npm `mathlive` 0.111.4)                                                                                                                                           | £0                                                                                                                                                        | No                                                                              | B                         | S–M             |
| Compute Engine / math.js / nerdamer    | Quick checks in the browser before the server check          | Less complete than SymPy                                   | MIT / Apache-2.0 / Apache-2.0 (npm)                                                                                                                                    | £0                                                                                                                                                        | No                                                                              | B, W                      | S               |
| JSXGraph / function-plot               | Graphs drawn by code for graph questions (fits our SVG rule) | Mature                                                     | (MIT OR LGPL-3.0) / MIT (npm)                                                                                                                                          | £0                                                                                                                                                        | No                                                                              | B                         | M               |
| Wolfram\|Alpha APIs (incl. Show Steps) | Worked steps and answer checking                             | Very strong computation                                    | Commercial contract, "Computed by Wolfram\|Alpha" credit and dedicated display area [extract, https://products.wolframalpha.com/api/commercial-termsofuse]             | Full Results "$50 per thousand queries", minimum prepayment; Show Steps "contact us" [extract, https://products.wolframalpha.com/api/pricing, 2026-11-25] | **Yes**: every query goes to Wolfram (US)                                       | H                         | M (contract)    |
| Wolfram Engine                         | Self-hosted alternative to SymPy                             | Very strong                                                | Free licence is for development only; "To put your product into production, you must get a production license" [extract, https://www.wolfram.com/engine/free-license/] | Not confirmed (FAQ cites "$5–$100" per copy)                                                                                                              | No if self-hosted                                                               | P                         | L               |
| GeoGebra                               | Geometry and graphing applets                                | Very widely used in schools                                | "any use of GeoGebra for a commercial purpose ... requires a special license" [extract, https://www.geogebra.org/license]                                              | Not confirmed (by agreement)                                                                                                                              | Yes if loaded from GeoGebra                                                     | B                         | S–M             |
| Desmos API                             | Graphing calculator                                          | Very widely used                                           | Commercial use needs a paid plan or Commercial Addendum [extract, https://www.desmos.com/api-terms]                                                                    | Personal free; Starter $100–$300/mo by users a year; Enterprise custom [extract, https://www.desmos.com/my-api, 2026-11-25]                               | Desmos sees IPs (script loads from Desmos); says no personal data collected     | B                         | S               |
| Mathpix                                | Turns photos of handwritten maths into LaTeX                 | Market leader for accuracy                                 | Terms: "YOU REPRESENT THAT YOU ARE AT LEAST 18 YEARS OF AGE" [extract, https://mathpix.com/terms]                                                                      | $0.002 per image (first 1M a month) plus a $19.99 key fee [extract, https://mathpix.com/pricing/api, 2026-11-25]                                          | **Yes**: photos of children's handwriting (kept up to 90 days unless opted out) | H                         | S (but privacy) |
| MyScript iink                          | Handwriting recognition on the device                        | Strong                                                     | Proprietary, per-device licence                                                                                                                                        | Not confirmed [extract, https://developer.myscript.com/pricing/]                                                                                          | Ink stays on the device; licence checks go out                                  | B? (not confirmed)        | M–L             |

### Physics (GCSE, Combined Science, A-Level)

| Tool                               | What it does for us                                                                              | Licence and paid use                                                                                                                                                                                                                                                                                                                         | Cost                                                | Student data      | Runs                        | Effort |
| ---------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ----------------- | --------------------------- | ------ |
| **pint**                           | Units and dimension checking (e.g. answer in kJ vs J; wrong-unit feedback)                       | BSD-3-Clause (PyPI `pint` 0.26.2)                                                                                                                                                                                                                                                                                                            | £0                                                  | No                | P                           | S      |
| **Equation-sheet check** (our own) | Check each physics item against the board's official equation list, cited from the specification | Board specification, quoted under our verification rules                                                                                                                                                                                                                                                                                     | £0                                                  | No                | W/P                         | S      |
| PhET simulations                   | Interactive simulations                                                                          | Sims published **before 29 March 2026**: CC BY 4.0, attribution, no modifications [extract, https://phet.colorado.edu/en/licensing/html]. PhET is moving to CC BY-NC, and "all commercial use ... requires a commercial license from the University of Colorado Boulder" [extract, https://phet.colorado.edu/en/help-center/getting-started] | £0 free use; commercial licence price not confirmed | No if self-hosted | B (self-hosted HTML5 files) | S      |
| Falstad circuit simulator          | Interactive circuits for electricity topics                                                      | GPL-2.0-or-later [extract, https://www.falstad.com/circuit/about.html]                                                                                                                                                                                                                                                                       | £0                                                  | No if self-hosted | B                           | S      |
| schemdraw                          | Circuit diagrams drawn by code (fits our SVG rule)                                               | MIT (PyPI `schemdraw` 0.23)                                                                                                                                                                                                                                                                                                                  | £0                                                  | No                | P (build time)              | S      |

### Chemistry (GCSE, Combined Science)

| Tool                                 | What it does for us                                                 | Licence and paid use                                                                                                                                                                                                                                     | Cost          | Student data             | Runs           | Effort |
| ------------------------------------ | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------ | -------------- | ------ |
| **ChemPy** (`balance_stoichiometry`) | Balances equations and checks students' balanced equations          | BSD-2-Clause (PyPI `chempy` 0.10.2)                                                                                                                                                                                                                      | £0            | No                       | P              | S      |
| **RDKit**                            | Formula, molar mass and structure checks; draws molecules as SVG    | BSD-3-Clause (PyPI `rdkit` 2026.9.2)                                                                                                                                                                                                                     | £0            | No                       | P              | S–M    |
| **SmilesDrawer** / OpenChemLib       | Molecule drawings by code in the browser                            | MIT (npm `smiles-drawer` 2.4.2) / BSD-3-Clause (npm `openchemlib` 9.26.0)                                                                                                                                                                                | £0            | No                       | B              | S      |
| periodictable / mendeleev            | Element data (masses, groups)                                       | Public domain (PyPI `periodictable` 2.1.0) / MIT (PyPI `mendeleev` 1.4.0). The data inside still needs an official citation (e.g. IUPAC) under our verification rules                                                                                    | £0            | No                       | P              | S      |
| PubChem (PUG REST)                   | Authoritative compound data at authoring time, as a citation source | **Not blanket public domain**: terms vary by contributing source, e.g. CAS Common Chemistry CC-BY-NC 4.0 [extract, https://www.ncbi.nlm.nih.gov/home/about/policies/]. Max 5 requests a second [extract, https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest] | £0            | No (compound names only) | P (build time) | S      |
| ChemDoodle                           | Molecule editor                                                     | GPLv3, or a paid licence for proprietary products [extract, https://web.chemdoodle.com/installation/license/]                                                                                                                                            | Not confirmed | No                       | B              | M      |

### Biology (GCSE, Combined Science)

| Tool                                                      | What it does for us           | Licence and paid use                                                                                                                                | Cost                             | Fits our rules?                                     |
| --------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | --------------------------------------------------- |
| **Our own SVG diagrams** drawn by code from verified data | Cells, organs, cycles, graphs | Ours                                                                                                                                                | £0                               | Yes. This is the rule (`VERIFICATION.md` section 4) |
| Servier Medical Art                                       | Reference anatomy art         | CC BY 4.0, may be adapted "for any purpose, including commercial use" with credit [extract, https://smart.servier.com/terms-of-use/]                | £0                               | Reference only; it is not code-drawn art            |
| Wikimedia Commons                                         | Reference images              | Set per file (CC BY / BY-SA / public domain); "no warranty" [extract, https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia] | £0                               | Reference only; check each file                     |
| Openclipart                                               | Simple icons                  | CC0 [extract, https://openclipart.org/share]                                                                                                        | £0                               | Reference only                                      |
| BioRender                                                 | Scientific figures            | Academic licence "does not allow you to use your figures for commercial purposes" [extract, https://www.biorender.com/academic-license]             | Academic US$420 a year [extract] | No                                                  |

### GCSE French

| Tool                                                                 | What it does for us                                                            | Licence and paid use                                                                                                                                                     | Cost                                                                                                                                                                                                         | Student data                                                                                                                                       | Runs            | Effort     |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ---------- |
| **Web Speech API: speech synthesis** (already in `PRODUCT_RULES.md`) | Reads French aloud                                                             | Browser API                                                                                                                                                              | £0                                                                                                                                                                                                           | Only with on-device voices (`localService`). Chromium: "when Google voices are used, the text is sent to remote servers" [extract, Chromium forum] | B               | S          |
| **Piper TTS** with voice fr_FR-mls-medium                            | Pre-records natural French audio for verified content, served from our storage | Engine GPL-3.0-or-later (PyPI `piper-tts` 1.8.0). Voice dataset CC BY 4.0 (Hugging Face card `rhasspy/piper-voices`, read 2026-11-25). Avoid fr_FR-tom (AGPLv3)          | £0 plus compute                                                                                                                                                                                              | No (we record lesson text only)                                                                                                                    | P (build time)  | M          |
| **Web Speech API: speech recognition** with `processLocally`         | Speaking practice: checks what was said                                        | Browser API. Chrome 139 `processLocally` keeps audio on the device [extract, https://developer.chrome.com/release-notes/139]                                             | £0                                                                                                                                                                                                           | No in local mode. Default mode sends audio to "a web service" [extract, MDN]                                                                       | B               | S–M        |
| Vosk French models / Whisper                                         | Speech recognition on the device or our server                                 | Vosk Apache-2.0 (PyPI); models `vosk-model-small-fr-0.22` and `vosk-model-fr-0.22` Apache 2.0 [extract]. Whisper MIT (PyPI `openai-whisper`). transformers.js Apache-2.0 | £0                                                                                                                                                                                                           | No                                                                                                                                                 | B / P           | M          |
| Azure Pronunciation Assessment                                       | Scores pronunciation                                                           | Commercial API                                                                                                                                                           | Rates not confirmed [extract, Azure pricing page]                                                                                                                                                            | **Yes**: the student's voice goes to Microsoft                                                                                                     | H               | M          |
| **LanguageTool** (self-hosted)                                       | Grammar feedback on written French                                             | LGPL 2.1 (Maven Central, release 6.8). Premium rules are not in the free version                                                                                         | £0 self-hosted; API price not confirmed                                                                                                                                                                      | No if self-hosted                                                                                                                                  | P (Java server) | M          |
| **DfE subject content, Annex E**                                     | The official required-words list (foundation and higher)                       | Open Government Licence v3.0 (gov.uk page and PDF, read 2026-11-25)                                                                                                      | £0                                                                                                                                                                                                           | No                                                                                                                                                 | Data            | S          |
| Wiktionary (Wiktextract)                                             | Dictionary data                                                                | CC BY-SA, so ShareAlike applies to derived data [extract, https://kaikki.org/dictionary/]                                                                                | £0                                                                                                                                                                                                           | No                                                                                                                                                 | Data            | M          |
| CNRTL / TLFi                                                         | Dictionary                                                                     | "à l'exclusion de toute exploitation commerciale" [extract, https://www.atilf.fr/ressources/tlfi/]                                                                       | —                                                                                                                                                                                                            | —                                                                                                                                                  | —               | Not usable |
| Cloud voices (Google, Amazon, Azure)                                 | Natural voices                                                                 | Commercial APIs                                                                                                                                                          | Google Standard/WaveNet US$4 per 1M characters, Neural2 US$16 [extract, https://cloud.google.com/text-to-speech/pricing]. Polly Standard US$4, Neural US$16 [extract, https://aws.amazon.com/polly/pricing/] | Lesson text only, never student input. Polly may use inputs for training unless opted out [extract, Polly FAQ]                                     | H               | S          |

**DfE word lists.** The DfE subject content asks for "1,200 lexical items for foundation tier, and
a further 500 lexical items for higher tier". It does **not** publish the full list; each board
publishes its own, under its own copyright. Annex E has only the required and optional words the
grammar annexes need (corrected 2026-11-26, `docs/research/question-generation-2026-11.md`).

Source: https://www.gov.uk/government/publications/gcse-french-german-and-spanish-subject-content
(read 2026-11-25).

### English Language and English Literature

| Tool                                  | What it does for us                                                                 | Licence and paid use                                                                                                                                                                                                                                      | Cost | Effort |
| ------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------ |
| **Public-domain set texts**           | Quote the set texts freely in lessons, quizzes and flashcards (see the table below) | The UK copyright term for written and dramatic works is "70 years after the author's death"; "Layout of published editions" has 25 years (https://www.gov.uk/copyright/how-long-copyright-lasts, read 2026-11-25)                                         | £0   | S      |
| Project Gutenberg / Standard Ebooks   | Plain-text sources of those texts                                                   | Gutenberg: strip "all references to Project Gutenberg", or pay 20% royalty for commercial use under the trademark; makes no claim outside the US [extract, https://www.gutenberg.org/policy/license.html]. Standard Ebooks: its own work is CC0 [extract] | £0   | S      |
| **Readability formulas** (`textstat`) | Checks our own explanations suit a 14 to 16 reading age                             | MIT (PyPI `textstat` 0.7.13); the formulas are plain maths                                                                                                                                                                                                | £0   | S      |
| LanguageTool (English)                | Spelling and grammar feedback on student writing                                    | LGPL 2.1, self-hosted                                                                                                                                                                                                                                     | £0   | M      |
| spaCy                                 | Sentence and word analysis for writing feedback                                     | MIT (PyPI `spacy` 3.8.18)                                                                                                                                                                                                                                 | £0   | M      |

**AQA GCSE English Literature (8702) set texts.** The list is from AQA's specification pages, read
2026-11-25.

- **Out of UK copyright (no permission needed):**
  - Shakespeare: Macbeth, Romeo and Juliet, The Tempest, The Merchant of Venice, Much Ado About
    Nothing and Julius Caesar.
  - The seven 19th-century novels: Jekyll and Hyde, A Christmas Carol, Great Expectations, Jane
    Eyre, Frankenstein, Pride and Prejudice and The Sign of Four.
  - George Orwell's Animal Farm. Orwell died in 1950, so it has been out of UK copyright since
    1 January 2021.
- **Still in copyright:** the other modern texts (An Inspector Calls, Blood Brothers, Lord of the
  Flies, DNA and others) and most of AQA's anthology poems.

**Notes:**

- **Authors' death dates** are standard reference facts. They need an official citation before
  they go into content.
- **Editions:** use plain text, not a modern edition's layout, because of the 25-year layout right.
- **Not affected by AQA's AI clause.** Public-domain texts are not AQA material, so AQA's AI clause
  (`docs/research/board-shares-2026-11.md`) does not apply to quoting them.

### History

| Source                                                         | What it gives us                      | Licence and paid use                                                                                                                                                                                      | Fits?                           |
| -------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| **The National Archives** (text, transcripts, education pages) | Primary-source extracts and context   | Open Government Licence v3.0 "except where otherwise stated". **Images** for websites or commercial use need TNA Image Library permission [extract, https://www.nationalarchives.gov.uk/legal/copyright/] | Text yes; images need a licence |
| **UK Parliament** (Hansard, official publications)             | Speeches, laws and debates as sources | Open Parliament Licence; Parliamentary Archives images are excluded [extract, https://www.parliament.uk/site-information/copyright/]                                                                      | Text yes                        |
| **gov.uk / DfE subject content**                               | What the History GCSE must cover      | Open Government Licence v3.0 (gov.uk footer)                                                                                                                                                              | Yes                             |
| Imperial War Museums                                           | Photos and documents                  | IWM Non-Commercial Licence [extract, https://www.iwm.org.uk/corporate/policies/copyright]                                                                                                                 | Not in a paid product           |
| Europeana / Wikimedia Commons                                  | Source images                         | Per item: free reuse only for Public Domain, CC0, CC BY and CC BY-SA [extract]                                                                                                                            | Check each item                 |

### Computer Science (A-Level, plus GCSE if added)

| Tool                                    | What it does for us                                           | Licence and paid use                                                                                                                                                                                                                                                                                                                                     | Cost               | Student data                         | Runs                                | Effort |
| --------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------ | ----------------------------------- | ------ |
| **Pyodide**                             | Runs students' Python in the browser, offline and private     | MPL-2.0 (npm `pyodide` 314.0.8)                                                                                                                                                                                                                                                                                                                          | £0                 | No                                   | B (self-hosted, a large download)   | M      |
| **Our own OCR ERL interpreter**         | Runs and checks answers in the language OCR uses in its exams | We write it. The rules come from the OCR J277 specification v3.1, section 3c, pages 25 to 31: "All programming code given in examination papers will be presented using the OCR Exam Reference Language" (https://www.ocr.org.uk/images/558027-specification-gcse-computer-science-j277.pdf, read 2026-11-25). OCR publishes no interpreter (none found) | £0                 | No                                   | B, W                                | M      |
| **Our own AQA pseudo-code interpreter** | The same for AQA                                              | We write it. AQA "Notes and guidance: Pseudo-code": "indexing for arrays and strings starts at 0 unless specifically stated otherwise" (https://filestore.aqa.org.uk/resources/computing/AQA-8525-NG-PC.PDF, read 2026-11-25)                                                                                                                            | £0                 | No                                   | B, W                                | M      |
| Judge0                                  | Runs and marks code in many languages                         | GPL-3.0 (self-hosted); hosted Pro €27 a month for 2,000 submissions a day [extract, https://docs.judge0.com/products/judge0/pricing/]                                                                                                                                                                                                                    | See licence column | Yes if hosted                        | P (needs privileged sandboxing) / H | M–L    |
| CircuitVerse                            | Logic-gate simulator for A-Level                              | MIT [extract, GitHub LICENSE]                                                                                                                                                                                                                                                                                                                            | £0                 | Yes in its iframe; no if self-hosted | B                                   | S–M    |

**Not checked:** the OCR A-Level (H446) pseudocode guide.

### Film Studies and Drama

Realistic options are limited. There are no open-licence tools that add much here.

| Source                      | Terms                                                                                                         | What we can do                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| BFI education resources     | "personal and non-commercial use"; no copying or derivative works [extract, https://www.bfi.org.uk/terms-use] | Link out only                                      |
| National Theatre Collection | "free for all UK state schools" through the school's Bloomsbury Drama Online access [extract]                 | Link out only; the student uses their school login |
| Digital Theatre+            | School subscriptions only, price on quote [extract]                                                           | Link out only                                      |

**What does fit:**

- our own verified notes on set films and plays;
- quotes kept short enough for fair dealing (needs a legal check);
- key-scene timestamps as facts, not clips.

---

## 2. Ranked shortlist

### Quick wins: free, self-hosted, no student data leaves us, paid use allowed

1. **KaTeX and MathLive.** Proper maths display and maths typing. All verified maths content needs
   this. S each.
2. **pint.** Units checking in the maths engine for physics and chemistry numeric answers, with
   "right number, wrong unit" feedback. S.
3. **ChemPy and RDKit.** Equation balancing, formula and molar-mass checks in the maths engine,
   plus code-drawn molecule SVGs (RDKit or SmilesDrawer). These fit our diagram rule. S to M.
4. **Public-domain set texts.** 14 of AQA's 25 current English Literature set texts can be quoted
   freely: all 6 Shakespeare plays, all 7 19th-century novels and Animal Farm. That is a big content
   win. S.
5. **The DfE French required-words list.** Official, under the Open Government Licence. Import it
   as the starting vocabulary deck. S.
6. **On-device speech in the browser.** Read-aloud with `localService` voices (already a product
   rule), plus speaking practice with `processLocally` recognition. S to M.
7. **textstat readability checks.** Add a readability step to the content pipeline. S.
8. **Equation-sheet and units cross-checks.** Each physics item's equation must appear on the
   board's official equation list. S.

### Later: worth it, but more work

9. **Pyodide plus our own OCR ERL and AQA pseudo-code interpreters,** for Computer Science. M.
10. **Piper pre-recorded French audio** (CC BY 4.0 voice, with attribution). M.
11. **Self-hosted LanguageTool** for grammar feedback in English and French. M.
12. **Vosk or Whisper on-device speech recognition,** where the browser can't recognise speech
    locally. M.
13. **Self-hosted Falstad and CircuitVerse,** for circuits and logic gates. S to M.
14. **Code-drawn graphs** (JSXGraph or function-plot) for graph-reading and sketching questions. M.
15. **PubChem as an authoring-time citation source.** Check each record's source licence. S.

### Not recommended now

- **Wolfram** (contract and US data flow; SymPy already covers GCSE and A-Level).
- **Mathpix** (adults-only terms; children's photos sent to the US).
- **Judge0** (Pyodide covers Python privately).
- **BioRender, CNRTL, IWM images** (not allowed in a paid product).

---

## 3. Needs the owner's money or legal sign-off

| Item                                                                                  | Why                                                                                                                                                                                    | Decision needed                                                    |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **PhET simulations**                                                                  | Free CC BY 4.0 only for sims published before 29 March 2026; PhET says commercial use needs a CU Boulder licence. Decision 0004 plans a paid tier                                      | Use only in the free tier, ask CU Boulder, or skip                 |
| **GeoGebra / Desmos**                                                                 | Paid product needs a GeoGebra licence or a Desmos paid plan or Commercial Addendum; loading them breaks "no third parties" unless self-hosted (Desmos self-hosting is Enterprise-only) | Budget and privacy decision                                        |
| **GPL / LGPL / AGPL tools** (Piper engine, Judge0, Falstad, LanguageTool, ChemDoodle) | Fine to run unmodified on our servers. Shipping or changing them has obligations                                                                                                       | Legal check before any is bundled into the app                     |
| **Cloud voices or pronunciation scoring** (Google, Amazon, Azure)                     | Lesson text only is low risk. Students' voices would be children's data sent to US providers                                                                                           | Privacy decision; the default is on-device                         |
| **Handwriting recognition** (Mathpix, MyScript)                                       | Children's handwriting photos and adults-only terms (Mathpix)                                                                                                                          | Not recommended; if wanted, MyScript on-device plus a legal review |
| **Archive images** (National Archives, Parliament, IWM)                               | Text is OGL or Open Parliament Licence; images need licences for website or commercial use                                                                                             | Budget if images are wanted; otherwise text only                   |
| **Project Gutenberg texts**                                                           | Must strip all Gutenberg branding (or pay a 20% royalty) and confirm UK status for each text                                                                                           | None if we strip branding and cite death dates                     |
| **Wiktionary data**                                                                   | CC BY-SA ShareAlike would apply to any deck built from it                                                                                                                              | Accept ShareAlike for that deck, or use the DfE list only          |

## 4. Not checked, and hosts to allow

The following were not checked directly; only search extracts were seen:

- Wolfram, GeoGebra, Desmos, Mathpix and MyScript;
- PhET, PubChem and ChemDoodle;
- Judge0, Falstad and CircuitVerse;
- Mozilla and Chrome developer documentation;
- Google, Amazon and Azure pricing pages;
- LanguageTool, Vosk and Kaikki;
- Project Gutenberg and Standard Ebooks;
- The National Archives, Parliament and IWM;
- Wikimedia, Servier and BioRender;
- the BFI, the National Theatre and Digital Theatre+.

To check them directly, allow:

- products.wolframalpha.com, www.wolfram.com
- www.geogebra.org, www.desmos.com
- mathpix.com, docs.mathpix.com, developer.myscript.com
- phet.colorado.edu
- pubchem.ncbi.nlm.nih.gov, www.ncbi.nlm.nih.gov
- web.chemdoodle.com
- docs.judge0.com, www.falstad.com, circuitverse.org
- developer.mozilla.org, developer.chrome.com
- cloud.google.com, aws.amazon.com, azure.microsoft.com
- languagetool.org, alphacephei.com, kaikki.org
- www.gutenberg.org, standardebooks.org
- www.nationalarchives.gov.uk, www.parliament.uk, www.iwm.org.uk
- commons.wikimedia.org, smart.servier.com, www.biorender.com
- www.bfi.org.uk, www.nationaltheatre.org.uk
- GitHub read access for the projects' LICENSE files

**Other open points:**

- Board vocabulary lists for French (AQA, Pearson, Eduqas): their licences.
- The OCR A-Level pseudocode guide.
- The licences of Piper's base voices.
- How Safari runs web speech.
