# Competitor analysis: UK GCSE and A-Level revision products (November 2026)

> Research document, checked 2026-11-25. Answers the product owner's three questions: what we are
> missing, how others handle past papers and mark schemes, and what each competitor costs. No
> personal data. Nothing was signed up for and no details were entered anywhere.

## How to read this (important)

- **How we checked.** This research session could not open most product websites directly: its
  network rules blocked them. Everything about competitors comes from **web search results**. These
  quote the products' own pages, help centres and app-store listings as the search index last saw
  them. The exam boards' copyright pages (AQA, Pearson, OCR, WJEC) **were** opened and read directly.
- **Labels.**
  - **[official]**: the product's or board's own page.
  - **[3P]**: third-party only (a review or price-comparison site). Treat these figures as leads,
    not confirmed prices.
  - **not confirmed**: we could not find it.
- **Before quoting a price outside the family, open the URL and check it again.** Several vendors'
  own pages disagree with each other. Where they do, both figures are given.
- Every source below was checked on **2026-11-25**.

---

## 1. One-page summary for the product owner

**The market in one breath.**

- Families mostly mix free sites with one paid subscription:
  - Free: BBC Bitesize, Physics & Maths Tutor, Corbettmaths, Oak, Isaac, Dr Frost.
  - Paid: Save My Exams, Seneca Premium, Tassomai, Up Learn, CENTURY, Medly.
- Schools also hand out school-only tools: Sparx, GCSEPod, Exampro, Seneca for schools.
- The paid products now compete on one thing: **AI marking of exam answers against the board's
  mark scheme**. Save My Exams calls theirs "Smart Mark". Seneca, Medly and Maths Genie Pro do it
  too.
- Hosting past-paper PDFs is no longer special, because free sites already do it.

**What it costs.**

- Paid revision runs from about **£4–£25 a month per child**. Tassomai charges **£44.99 a month**
  for Years 9–11. Up Learn's A-Level courses are about **£320–£430** until the 2027 exams.
- **Almost no one offers a real family plan.**
  - Seneca says you need one Premium subscription per child.
  - CENTURY charges per learner.
  - Up Learn's parent accounts don't cover several children.
  - Quizlet's family plan only shares billing.
  - Khanmigo's family plan is US-only.
- RevisionDen being free for a whole family, with a parent view across all children, is a real
  difference.

**Past papers and the law, in short.**

- Exam boards own their papers and mark schemes. All four main boards say no one may put them on a
  public website or sell them without written permission.
- Schools may copy them for use inside the school. A private app is not a school.
- AQA says in writing that **linking** to its own public PDFs is fine. The others don't mention
  linking.
- Recent papers are locked to teachers for about a year.
- Papers contain third-party extracts (texts, images) that boards often can't license onward.
- Some competitors host the PDFs anyway: Physics & Maths Tutor, Save My Exams, Seneca. We could not
  confirm they have licences. Dr Frost says it holds a licence from the boards.
- Our current plan already matches the safe route: our own board-style questions, plus links to the
  board's own PDFs (`docs/EXAM_PRACTICE.md`). It still needs a legal check.

**One new risk to know about.**

- AQA's policy bans using AQA material in connection with training AI, and in any third-party work
  that is partly produced with AI.
- Our content is written in AI working sessions from official source excerpts. This needs a legal
  answer before we build AQA content. It is logged in
  `project_memory/operations/contradictions.md`.

**What we are missing, most important first** (detail in section 5):

1. Enough verified content across every subject the children take.
2. AI marking of written answers against the mark scheme.
3. A linked index of official past papers, with each question tagged by topic.
4. Worked solutions for every question.
5. "Learn it first" notes or links per topic.

After those come:

- a daily mixed "5-a-day" set;
- hints and concept pages;
- read-aloud and a dyslexia-friendly font earlier;
- unlimited maths question variants checked by our maths engine;
- quick "recall checks".

**What we already do better.**

- Free for the whole family, with one parent view for every child.
- Privacy by design.
- Every item cited and verified.
- No "lives", no mystery boxes, no streak guilt.
- A planner tied to real exam dates.

---

## 2. Feature matrix

Key:

- **Y** yes
- **P** partial
- **N** no
- **?** not confirmed
- **PL** planned for RevisionDen (stage in brackets)

Columns:

| Code   | Feature                         |
| ------ | ------------------------------- |
| QB     | Question bank                   |
| PP     | Past papers                     |
| MS     | Mark schemes                    |
| WS     | Worked solutions                |
| FC     | Flashcards                      |
| SR     | Spaced repetition               |
| AI     | AI marking or AI tutor          |
| Plan   | Study planner                   |
| Parent | Parent view                     |
| Game   | Gamification                    |
| Video  | Video lessons                   |
| Time   | Exam timing or pacing           |
| Off    | Offline use                     |
| A11y   | Accessibility (e.g. read-aloud) |

How each product does past papers is in section 3. Prices are in section 4.

| Product                 | QB  | PP          | MS  | WS  | FC  | SR  | AI      | Plan  | Parent | Game | Video | Time    | Off | A11y | Price (headline)                                 |
| ----------------------- | --- | ----------- | --- | --- | --- | --- | ------- | ----- | ------ | ---- | ----- | ------- | --- | ---- | ------------------------------------------------ |
| **RevisionDen (us)**    | Y   | PL(3) links | PL  | P   | Y   | Y   | PL(3)   | PL(2) | Y      | Y    | N     | PL(3)   | P   | P    | Free to the family; about £10/month running cost |
| Save My Exams           | Y   | Y hosts     | Y   | Y   | Y   | ?   | Y       | Y     | P      | ?    | ?     | P mocks | P   | ?    | £12–£25/mo [3P]; USD on site                     |
| Seneca                  | Y   | Y hosts     | Y   | ?   | ?   | P   | Y       | ?     | Y free | P    | P     | ?       | ?   | Y    | Core free; Premium £6.99–£39.99/mo [3P]          |
| Physics & Maths Tutor   | Y   | Y hosts     | Y   | P   | Y   | N   | N       | ?     | N      | N    | P     | N       | P   | ?    | Free                                             |
| Cognito                 | Y   | Y ?how      | ?   | ?   | Y   | ?   | ?       | ?     | ?      | ?    | Y     | ?       | ?   | ?    | Free (weekly caps); Pro £9.99/mo [3P]            |
| Up Learn                | Y   | P own       | ?   | Y   | ?   | ?   | P       | ?     | P      | P    | Y     | ?       | ?   | ?    | £49.99–£99.99/mo                                 |
| Quizlet                 | P   | N           | N   | P   | Y   | P   | Y       | ?     | N      | Y    | N     | P       | Y   | ?    | Plus UK price ?; USD $35.99/yr                   |
| Brainscape              | N   | N           | N   | N   | Y   | Y   | P       | N     | N      | ?    | N     | N       | ?   | ?    | Free; Pro USD $7.99/mo yearly                    |
| Anki                    | N   | N           | N   | N   | Y   | Y   | N       | N     | N      | ?    | N     | N       | Y   | ?    | Free; iOS app £24.99 once                        |
| Tassomai                | Y   | N           | P   | P   | ?   | Y   | Y       | N     | Y      | Y    | ?     | ?       | ?   | ?    | £44.99/mo (Years 9–11)                           |
| Access GCSEPod          | Y   | ?           | ?   | Y   | ?   | ?   | P       | ?     | P      | ?    | Y     | ?       | Y   | ?    | Schools only                                     |
| BBC Bitesize            | Y   | N           | N   | P   | Y   | ?   | ?       | ?     | N      | ?    | Y     | ?       | ?   | ?    | Free                                             |
| Oak National Academy    | P   | N           | N   | Y   | ?   | ?   | P       | ?     | ?      | ?    | Y     | ?       | P   | ?    | Free                                             |
| Corbettmaths            | Y   | P own       | Y   | Y   | P   | P   | N       | N     | N      | N    | Y     | ?       | Y   | ?    | Free (print books £8.99)                         |
| Dr Frost Maths          | Y   | Y licensed  | P   | Y   | ?   | P   | ?       | N     | P      | P    | P     | ?       | ?   | ?    | Free to students                                 |
| Isaac Science / Ada CS  | Y   | N own       | P   | P   | ?   | ?   | ?       | N     | ?      | P    | P     | ?       | ?   | ?    | Free                                             |
| Sparx (Maths/Science)   | Y   | ?           | ?   | Y   | Y   | Y   | Y       | N     | Y      | Y    | Y     | ?       | ?   | ?    | Schools only                                     |
| MyTutor                 | N   | N           | N   | N   | N   | N   | ?       | P     | Y      | N    | live  | ?       | ?   | ?    | From £26/hour                                    |
| Khan Academy / Khanmigo | Y   | N           | N   | P   | ?   | ?   | Y (US)  | ?     | Y      | P    | Y     | ?       | P   | ?    | Free; Khanmigo US-only                           |
| CENTURY                 | Y   | ?           | ?   | P   | ?   | ?   | P       | P     | Y      | P    | Y     | P       | ?   | ?    | £8.33–£12.49/mo per learner                      |
| Gizmo                   | P   | P user-made | N   | ?   | Y   | Y   | Y       | ?     | ?      | Y    | ?     | ?       | ?   | ?    | Free tier; paid options £4.99–£154.99 (period ?) |
| Medly AI                | ?   | P upload    | ?   | ?   | ?   | ?   | Y       | ?     | ?      | ?    | ?     | ?       | ?   | ?    | £24.99/mo                                        |
| Maths Genie             | Y   | Y hosts     | Y   | Y   | ?   | ?   | Y (Pro) | ?     | ?      | ?    | Y     | Y timer | ?   | ?    | Pro "under £13/mo" on a yearly plan              |

Notes on the RevisionDen row:

- **Parent view (Y):** the parent home and stats dashboard are built.
- **Planner (PL, stage 2).**
- **AI marking (PL, stage 3).** Maths working is already checked by our maths engine (no AI).
- **Offline (P):** only the app shell works offline. API calls are never cached.
- **Accessibility (P):** WCAG 2.2 AA contrast and reduced motion are built. Read-aloud and a
  dyslexia-friendly font are planned in stage 3.
- **Worked solutions (P):** maths model solutions are supported in the item format.

---

## 3. Past papers, mark schemes and licensing

### 3.1 What the exam boards say

The pages for AQA, Pearson Edexcel, OCR and WJEC/Eduqas were opened and read directly. CCEA and
Cambridge International come from search extracts.

**AQA**

Sources:

- https://www.aqa.org.uk/about-us/who-we-are/our-standards/copyright-and-intellectual-property-policy
- https://www.aqa.org.uk/about-us/who-we-are/our-standards/copyright-and-intellectual-property-policy/copyright-policy-for-centres

Key points:

- **Permission:** "All AQA materials are protected by copyright, and may only be reproduced with
  written permission."
- **Other websites:** "AQA materials must not be reproduced on third party websites – in any
  format."
- **Linking:** "You may link to documents on the AQA public website from your own website."
- **Social media:** no permission for social media or YouTube videos.
- **AI:** AQA "does not permit the use of any AQA material in any manner or for any purposes in
  connection with the training" of AI tools. It also "will not allow the use of any AQA material in
  or on any edition of a third-party work" where any part "is generated or produced using
  Artificial Intelligence".
- **When papers are public:** "Exam papers are available on our website one year after an exam
  series". Papers, mark schemes and reports stay up "for a period of three years". Newer and
  secure papers are only on Centre Services, for registered schools.
- **Schools:** may copy papers "for use in internal examinations or for teaching purposes within
  the centre", free of charge to students. They "may not reproduce AQA material on their public
  websites".
- **Publishers:** AQA grants "a limited number of print and eBook permissions to authors and
  publishers". No commercial fee is published.

**Pearson Edexcel**

Sources:

- https://qualifications.pearson.com/en/support/support-topics/exams/past-papers/pearson-copyright-policy.html
- https://qualifications.pearson.com/en/support/support-topics/exams/past-papers.html

Key points:

- **Online copies:** materials "may not be copied or made available electronically in whole or in
  part without permission from Pearson".
- **Schools:** may print for "practice examinations or revision" without charging anyone.
- **School intranets:** must not be publicly reachable, and papers stay up no longer than 5 years.
- **Recent papers:** locked to teachers. Pearson's own page gives two different periods: "within
  the past 12 months" and "the last nine months".
- **Permissions:** requests go by written application. No fee is published.
- **Linking:** not addressed.

**OCR**

Sources:

- https://www.ocr.org.uk/about/our-policies/copyright/
- https://www.ocr.org.uk/qualifications/past-paper-finder/past-paper-policy/

Key points:

- **Schools:** approved schools may use downloads "for practice examinations, revision or for
  teaching purposes within the centre", free of charge.
- **Websites:** "You must not publish any Cambridge OCR materials on your public website."
- **Reuse:** "If you would like to reproduce our material, please email our Publisher Relationship
  Manager."
- **How long papers stay up:** five years, but "The five year rule does not apply to all Maths and
  Science GCSEs, AS and A Levels."
- **Not addressed:** linking and AI.
- **No general permission found.** We found no blanket "non-commercial educational use" permission.
  The exemption covers approved schools only.

**WJEC / Eduqas**

Source: the WJEC Publication Policy, effective from September 2025,
https://www.eduqas.co.uk/media/rpaa4cij/wjec-publications-policy-effective-from-september.pdf

Key points:

- **Schools:** are "welcome to use documents for use in the classroom and for students' private
  study".
- **Outside the school:** "they must apply to WJEC for written permission".
- **When papers are public:** papers go public "just over a year after the examination".
- **Examiner reports:** are public on results day for the November and January series, and in
  September for the summer series.
- **Not addressed:** linking.

**CCEA**

- Not confirmed: the past-papers site could not be read.
- A news report says BBC Bitesize added "direct links to CCEA past papers and mark schemes"
  (https://www.derrynow.com/news/local-news/1957644/bbc-bitesize-adds-ccea-past-papers-to-support-ni-gcse-pupils.html).

**Cambridge International**

- From a search extract: teachers may print papers for their students, but they "cannot be used
  for publication or re-sale without our prior approval"
  (https://help.cambridgeinternational.org/hc/en-gb/articles/115004333125-Can-I-reproduce-Cambridge-past-examination-papers-for-use-in-the-classroom-with-my-students).

**Common to all boards**

- **Third-party extracts.** Papers contain third-party texts and images that boards often cannot
  license beyond the exam. Boards remove them or hold the paper back, so even a board licence would
  not cover them.
- **Fees.** No board publishes a fee for commercial reuse of England and Wales papers.
- **Court action.** AQA and Pearson hold High Court injunctions (granted 30 April 2026). These are
  about **leaked papers before the exam**, not about past-paper sites:
  - https://www.aqa.org.uk/about-us/what-we-do/newcomer-injunction
  - https://qualifications.pearson.com/en/about-us/about-pearson/injunction-application.html
- **No court cases against revision sites found.** We found no UK case of a board suing a revision
  site for hosting past papers (not confirmed either way).

### 3.2 How competitors do it

Rows marked "extract" come from search results, not the live page.

| Competitor                    | Approach                                                                                                                | Licence?                                                                                                                                     | Evidence                                                                                                                                                                             |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Save My Exams                 | Hosts board PDFs and mark schemes; writes its own exam questions and mocks ("written by expert teachers and examiners") | Not confirmed; its FAQ says some mark schemes can't be downloaded "due to copyright reasons"                                                 | https://www.savemyexams.com/gcse/past-papers/ ; https://www.savemyexams.com/learning-hub/support/are-save-my-exams-questions-from-past-papers/ (extract)                             |
| Physics & Maths Tutor         | Hosts board PDFs on its own domain (AQA, Edexcel, OCR, CAIE, WJEC), including June 2025                                 | Not confirmed                                                                                                                                | https://www.physicsandmathstutor.com/past-papers/gcse-maths/ (extract)                                                                                                               |
| Seneca                        | Board past papers and mark schemes "for selected courses" in Exam Prep                                                  | Not confirmed                                                                                                                                | https://help.senecalearning.com/en/articles/8489099-how-do-i-find-past-papers (extract)                                                                                              |
| Dr Frost Maths                | Interactive past-paper questions by topic, plus its own generated questions                                             | **Says it holds** "the license to provide interactive digital versions of past public papers" (OCR, AQA, Pearson, WJEC); terms not confirmed | https://www.drfrost.org/about (extract)                                                                                                                                              |
| Maths Genie                   | Past papers by board with mark schemes; topic booklets compiled from past questions                                     | Not confirmed                                                                                                                                | https://mathsgenie.co.uk/features/past-papers (extract)                                                                                                                              |
| Up Learn                      | Own practice papers "written by the official examiners for your exam board"                                             | Not confirmed                                                                                                                                | https://help.uplearn.co.uk/en/articles/3811884-what-is-practice-exam-papers (extract)                                                                                                |
| Corbettmaths                  | Own practice papers with solutions                                                                                      | Not needed (own work)                                                                                                                        | https://corbettmaths.com/2017/09/14/practice-papers-gcse-a-g/                                                                                                                        |
| Isaac Science, Sparx          | Own questions                                                                                                           | Not needed (own work)                                                                                                                        | https://isaacscience.org/physics/a_level/questions ; https://sparxmaths.com/                                                                                                         |
| BBC Bitesize                  | Links to board papers (CCEA, reportedly with permission)                                                                | Permission reported, not confirmed                                                                                                           | derrynow.com link above                                                                                                                                                              |
| Medly AI                      | Student uploads a paper; the AI marks it                                                                                | Not confirmed                                                                                                                                | https://www.medlyai.com/uk (extract)                                                                                                                                                 |
| AQA Exampro                   | The board's own bank of past questions, mark schemes and examiner reports, for teachers at AQA schools                  | Board-owned                                                                                                                                  | https://www.aqa.org.uk/exampro (read directly). Maths is "fully funded for all AQA maths centres"; other subjects are paid per school (e.g. GCSE Business £80 + VAT a year, extract) |
| Pearson Revise, Oxford Revise | Publishers' own exam-style questions                                                                                    | Own work                                                                                                                                     | https://www.pearson.com/uk/web/pearson-revise.html ; https://www.oxfordrevise.com/ (extracts)                                                                                        |

### 3.3 What this means for RevisionDen

This is a factual summary, not legal advice. `docs/LEGAL.md` and `docs/EXAM_PRACTICE.md` already
require a legal review.

- **Linking to the board's own PDF.**
  - This avoids every board's ban on reproducing papers on other websites.
  - AQA allows it in writing. The others are silent.
  - Links only work for papers that are already public (about a year after the exam). Some of those
    papers have third-party extracts removed.
- **Copying a paper or mark scheme into the app needs each board's written permission.** That
  includes caching, re-hosting, or typing questions into our own format. A board's permission
  would still not cover third-party extracts. The schools exemption does not apply to us.
- **Our own board-style questions.**
  - No board policy we read forbids them, and many competitors make them.
  - The risk is copying wording, diagrams or mark-scheme text too closely.
  - Facts such as a paper's duration, its mark total and grade boundaries are what we cite. We
    should keep quotes short, as our 50-word limit already does.
- **AQA and AI (new risk).**
  - Our items are written in AI working sessions from official source excerpts
    (`docs/CONTENT_PLAN.md`).
  - AQA's AI clause could cover using AQA specifications, papers or mark schemes as AI input, or
    publishing AQA quotes inside AI-assisted content.
  - The pilot is Pearson Edexcel, so nothing built so far is affected.
  - **Before any AQA subject is built**, a legal check or written permission from AQA is needed.
    This is recorded in `project_memory/operations/contradictions.md`.

---

## 4. Pricing table

Checked 2026-11-25 from search extracts of these pages; open the page to confirm before relying on
a figure. "Family" means one price covering several children.

| Product                | Free tier                                                    | Monthly                                                                                      | Annual / course                                                              | Family plan                                                  | Schools only?  | Source                                                                                                                                                                        |
| ---------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------ | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Save My Exams          | Yes: a few notes and questions a month; past papers          | Official page in USD: Essential $40, Premium $80. GBP not confirmed; [3P] £12 / £25          | USD $96 / $192. [3P] £48 / £96                                               | Not confirmed                                                | No             | https://www.savemyexams.com/join/ ; [3P] https://useaicademy.com/blog/what-revision-sites-cost                                                                                |
| Seneca                 | Yes: all core courses; free parent account                   | Tier prices not confirmed officially. [3P] £19.99–£39.99. Guarantee add-on +£5.99 [official] | [3P] £6.99–£14.99 a month, billed yearly                                     | **No**: "one Premium subscription for each child" [official] | No             | https://help.senecalearning.com/en/articles/3746290-how-much-is-premium ; https://help.senecalearning.com/en/articles/3559864-what-if-i-have-more-than-one-child-using-seneca |
| Physics & Maths Tutor  | Everything free                                              | n/a                                                                                          | Courses £49–£365; tutors £20–£70+ an hour                                    | n/a                                                          | No             | https://www.pmt.education/courses/ ; https://www.pmt.education/tutor/                                                                                                         |
| Cognito                | Yes: notes and videos; weekly caps on quizzes and flashcards | Pro not confirmed officially; [3P] £9.99                                                     | Not confirmed                                                                | Not confirmed                                                | No             | https://cognitoedu.org/faq.html ; [3P] https://kinescope.com/edtech-map/cognito                                                                                               |
| Up Learn               | Not confirmed                                                | A-Level Core £74.99 or £79.99 (pages differ); Master £99.99; GCSE Combined Science £49.99    | Until 2027 exams: Core £319.99–£329.99; Master £419.99–£429.99; GCSE £249.99 | No (£100 off each extra course)                              | No             | https://uplearn.co.uk/pricing ; https://uplearn.co.uk/gcse-guarantee                                                                                                          |
| Quizlet                | Yes: flashcards, games, limited Learn and Test               | UK price not confirmed (UK App Store shows £9.99, unlabelled)                                | USD $35.99 (UK App Store shows £44.99, unlabelled)                           | Yes, up to 5 accounts, UK included; GBP price not confirmed  | No             | https://quizlet.com/upgrade ; https://quizlet.com/features/family-plan                                                                                                        |
| Brainscape             | Yes: unlimited own cards                                     | USD only; UK app items £17.49 / £52.99 / £83.99 (periods not stated)                         | Lifetime £199.99 (UK App Store)                                              | Not confirmed                                                | No             | https://www.brainscape.com/pricing ; https://apps.apple.com/gb/app/brainscape-smart-flashcards/id442415567                                                                    |
| Anki                   | Desktop, Android and sync free                               | n/a                                                                                          | iOS app £24.99, one-off                                                      | n/a                                                          | No             | https://apps.ankiweb.net/ ; https://apps.apple.com/gb/app/ankimobile-flashcards/id373493387                                                                                   |
| Tassomai               | 7-day trial; free if the school pays                         | Years 3–6 £8.99; Years 7–8 £29.99; Years 9–11 £44.99                                         | Not published                                                                | Per child (one price covers all subjects)                    | No             | https://www.tassomai.com/private-subscribers                                                                                                                                  |
| Access GCSEPod         | Through school only                                          | n/a                                                                                          | Schools: £1.60–£4.00 per pupil + £150 platform fee                           | No                                                           | **Yes**        | https://www.theaccessgroup.com/en-gb/education/software/education-resources/gcsepod-pricing/                                                                                  |
| BBC Bitesize           | Everything free, no in-app purchases                         | n/a                                                                                          | n/a                                                                          | n/a                                                          | No             | https://apps.apple.com/gb/app/bbc-bitesize-exam-revision/id1089215244                                                                                                         |
| Oak National Academy   | Everything free                                              | n/a                                                                                          | n/a                                                                          | n/a                                                          | No             | https://www.thenational.academy/ai                                                                                                                                            |
| Corbettmaths           | Website free                                                 | n/a                                                                                          | Print workbooks £8.99; revision cards £8.99 + £3 P&P                         | n/a                                                          | No             | https://corbettmaths.com/books/ ; https://corbettmaths.com/revision-cards/                                                                                                    |
| Dr Frost Maths         | Free for students; free parent accounts                      | n/a                                                                                          | Schools £650 + VAT a year                                                    | Free parent account                                          | No             | https://www.drfrost.org/pricing                                                                                                                                               |
| Isaac Science / Ada CS | Everything free                                              | n/a                                                                                          | n/a                                                                          | n/a                                                          | No             | https://isaacscience.org/physics ; https://adacomputerscience.org/                                                                                                            |
| Sparx                  | None for families                                            | n/a                                                                                          | School quote, not published                                                  | No                                                           | **Yes**        | https://sparxmaths.com/parents/                                                                                                                                               |
| MyTutor                | Free 15-minute meeting                                       | Pay per lesson: from £26 an hour (other pages show £22; A-Level up to about £80)             | n/a                                                                          | No                                                           | No             | https://www.mytutor.co.uk/pricing                                                                                                                                             |
| Khan Academy           | Everything free                                              | Khanmigo $4 (USD), **US only**                                                               | $44 (USD), US only                                                           | Up to 10 children, US only                                   | No             | https://www.khanmigo.ai/parents ; https://support.khanacademy.org/hc/tr/articles/25921448458893                                                                               |
| CENTURY                | 7-day trial                                                  | £12.49 (another page says £10.99)                                                            | £99.92 (£8.33 a month)                                                       | No: per learner, up to 20 learners per account               | Mainly schools | https://www.century.tech/explore-century/gcse-revision/                                                                                                                       |
| Gizmo                  | Yes ([3P]: 15 lives and 10 AI quizzes a day)                 | Not confirmed (UK app items £4.99–£154.99, periods not stated)                               | Not confirmed                                                                | Not confirmed                                                | No             | https://apps.apple.com/gb/app/gizmo-ai-tutor/id1610516671                                                                                                                     |
| Medly AI               | Yes: 5 marked questions a day                                | £24.99                                                                                       | £180 a year, or a £140 pass to 31 July 2027 (pages differ)                   | Not confirmed                                                | No             | https://www.medlyai.com/uk ; https://www.medlyai.com/uk/exams                                                                                                                 |
| Maths Genie            | Yes                                                          | Not confirmed                                                                                | Pro "under £13 a month on a yearly plan"                                     | Not confirmed                                                | No             | https://mathsgenie.co.uk/for-parents                                                                                                                                          |

**Other things seen:**

- **Grade guarantees.**
  - Up Learn refunds the course if a student who completed it misses an A*/A grade (or 8+ at GCSE)
    (https://uplearn.co.uk/guarantee).
  - Seneca sells a +£5.99 a month guarantee add-on.
- **Scale.** These are each company's own figures:
  - Save My Exams: "over 2.5 million students every month" (https://www.savemyexams.com/about/).
  - Seneca: "used by teachers in over 96% of UK secondary schools"
    (https://senecalearning.com/en-gb/secondary-schools/).
  - Sparx: "over half of UK schools" (https://sparxmaths.com/).
  - Gizmo: 13M+ users worldwide, Series A in April 2026
    (https://techcrunch.com/2026/04/15/ai-learning-app-gizmo-levels-up-with-13m-users-and-a-22m-investment/).
  - Medly: raised about £6M in August 2026
    (https://www.ucl.ac.uk/news/2026/sep/ucl-startup-medly-ai-secures-8-million-ps6-million-investment).

---

## 5. Gaps for RevisionDen, ranked

**How the gaps are ranked.** By how much the gap would help the two students' grades, set against
what we already have or plan.

**Effort:**

- **S**: days.
- **M**: a workstream.
- **L**: several workstreams or ongoing content work.

**"Fits our rules"** checks three things: no personal data, verified content
(`docs/VERIFICATION.md`), and no manipulative design (`docs/GAME_FEEL.md`, `docs/REWARDS.md`).

| #   | Gap                                                                                                                                                                     | Who has it                                                                              | Why it matters                                                                                                                          | Effort                           | Fits our rules?                                                                                                                                                                                   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Content breadth:** verified items for every subject, board and tier the children take (only GCSE Maths Higher pilot exists, still draft)                              | Every paid competitor covers all main subjects                                          | Without it nothing else matters; it is the main reason families pay Save My Exams or Seneca                                             | L                                | Yes. It is exactly what the verification pipeline is for. AQA subjects wait on the AI question (section 3.3)                                                                                      |
| 2   | **AI marking of written answers against the mark scheme**, typed or photographed                                                                                        | Save My Exams Smart Mark, Seneca, Medly, Maths Genie Pro, Sparx Science (short answers) | It is the feature the market now charges for; long answers are where GCSE marks are lost                                                | L                                | Yes, if labelled "Marked by AI. This is a guide…" and double-marked (already in `PRODUCT_RULES.md`). Photos are deleted after reading                                                             |
| 3   | **Official past-paper index:** every public paper and mark scheme per board, series and paper, as links, with each question tagged to our topics and its marks and time | Save My Exams, PMT, Dr Frost and Maths Genie (they host; we would link)                 | Students want the real thing; lets the topic map say "Question 7 of the June 2024 paper is on this topic"; feeds pacing in workstream X | M                                | Yes. Links only, plus our own metadata (paper, question number, marks, topic). Topic tags and timings are facts we cite. Needs the legal review already planned                                   |
| 4   | **Worked solutions for every item:** a step-by-step model answer after each question, not just right or wrong                                                           | Corbettmaths, Dr Frost (2,300+ videos), Save My Exams model answers, Isaac hints        | Learning comes from seeing the method; our maths items already support `steps`                                                          | M                                | Yes. Maths steps are checked by the maths engine; written ones go through the verification pipeline                                                                                               |
| 5   | **"Learn it first" for each topic:** a short explainer, or curated links to free official lessons                                                                       | Oak, BBC Bitesize, Cognito, GCSEPod, Save My Exams notes                                | Weak-topic practice fails if the student never understood the topic                                                                     | S for links, L for our own notes | Partly. Our own notes must be verified (L). Links to Oak or Bitesize are outside our verification, so label them "From Oak/BBC" and check them like any citation                                  |
| 6   | **Daily mixed set ("5-a-day"):** five mixed questions from past topics, every day, at the student's tier                                                                | Corbettmaths 5-a-day, Tassomai Daily Goal                                               | Cheap, proven habit; interleaving old topics stops forgetting; fits our daily goal                                                      | S                                | Yes. Uses verified items; counts towards the daily goal under the existing caps. No guilt if missed                                                                                               |
| 7   | **Hints and concept pages:** one or two hints before the answer, and a concept page linked from each question                                                           | Isaac Science, Tassomai "Mai Explains", Dr Frost                                        | Keeps students going instead of guessing; turns a miss into learning                                                                    | M                                | Yes, if hints are verified content; no AI-made hints unless verified                                                                                                                              |
| 8   | **Read-aloud and a dyslexia-friendly font now**, not in stage 3                                                                                                         | Seneca (text-to-speech, paid), GCSEPod audio                                            | Helps any student with access arrangements; cheap with the browser's built-in speech                                                    | M                                | Yes. The browser's built-in speech can run on the device, though some browsers send text to an online speech service; check which before relying on it. No third-party scripts                    |
| 9   | **Unlimited maths variants:** the same skill with new numbers, each checked by the maths engine                                                                         | Dr Frost "Key Skills", Sparx                                                            | Endless practice on weak skills without writing every item by hand                                                                      | M                                | Yes, if each template is verified once and every variant's answer is checked by the engine. Needs a rule in `VERIFICATION.md`                                                                     |
| 10  | **Recall checks:** now and then, ask again for an answer the student got right earlier in the session                                                                   | Sparx "bookwork checks"                                                                 | Stops guessing and lucky taps; encourages writing working down                                                                          | S                                | Yes. No penalty; if missed, it simply comes back                                                                                                                                                  |
| 11  | **Offline practice:** download today's set and flashcards for a journey                                                                                                 | Anki, Quizlet Plus, GCSEPod                                                             | Revision on the bus or with no signal; our API calls are never cached today                                                             | L                                | Yes, but answers must sync safely and nothing personal should stay on a shared device                                                                                                             |
| 12  | **Better spaced-repetition algorithm (FSRS)** in place of SM-2                                                                                                          | Anki (FSRS since 23.10)                                                                 | Fewer reviews for the same memory; a small change in `packages/core`                                                                    | S                                | Yes                                                                                                                                                                                               |
| 13  | **Examiner-report insights:** "common mistakes" for each topic                                                                                                          | Save My Exams, PMT (hosts reports)                                                      | Examiner reports say where marks are lost                                                                                               | M                                | Partly. Link to the report and write our own short, cited summary. Copying text needs permission; legal check                                                                                     |
| 14  | **Cards from the student's own notes, made by AI**                                                                                                                      | Gizmo, Quizlet                                                                          | Popular with students                                                                                                                   | M                                | Partly. They would be unverified, so keep them labelled "Your cards" and separate from verified content; check them for personal details like own cards today (no AI uploads of photos of people) |
| 15  | **Weekly parent email with a link that needs no sign-in**                                                                                                               | Sparx, Tassomai (Monday email), CENTURY                                                 | Parents read emails more than they open apps                                                                                            | S                                | Not as it stands: the weekly summary is planned, but we send no emails today; a sign-in-free link is a privacy trade-off. A product owner decision                                                |

**Seen elsewhere but against our rules.** We should not copy these:

- **Predicted papers and "mock drops"** (Seneca, Save My Exams, PMT). They are guesses with no
  official source, so they can't pass verification.
- **Lives that run out and lock learning** (Gizmo). Reviewers complain about it, and
  `docs/GAME_FEEL.md` bans it.
- **Coins bought with money** (Gizmo). This is pay-to-win, which `docs/REWARDS.md` bans.
- **Grade guarantees** (Up Learn, Seneca). These only make sense for a paid product.
- **Public leaderboards and open chat.** Our friends league is invite-only with no chat.
- **AI chat that parents cannot see.** ChatGPT for Teens, for example, does not show chats to
  parents (https://help.openai.com/en/articles/12315553-managing-parental-controls-in-chatgpt).
  Any AI tutor we add should keep the parent informed, in line with the Children's Code.

---

## 6. Still to check

- **Not confirmed officially.** These GBP prices only came from third-party sites or unlabelled
  app-store items:
  - Save My Exams, Seneca, Cognito Pro, Quizlet Plus and the Quizlet family plan, Gizmo.
- **Other open points:**
  - Tassomai's annual price.
  - Every competitor's offline and accessibility features.
  - Whether Physics & Maths Tutor, Save My Exams and Seneca hold licences for the papers they host.
  - Dr Frost's licence terms.
  - CCEA's reuse policy.
- **Not researched:** MathsWatch, Educake, Carousel Learning, Knowt, StudyFetch, Revisely, Mr Bruff,
  Primrose Kitten, Duolingo.
- **Why these are open.** Checking them means opening the live pages. That needs the product sites
  allowed in the research session's network settings.
