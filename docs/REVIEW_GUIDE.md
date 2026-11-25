# Review guide (for the owner)

> Live document. How to approve or reject questions in the review queue on
> **dev.revisionden.com**. One page, no jargon. The rules behind it are in `VERIFICATION.md`.

## What you are doing

Every question has already been checked by computer: its source quote is found in the exam
board's document, the maths is checked by the maths engine, and two AI models from different
companies have answered it blind and hunted for mistakes. You are the last check. You are asking
one question of each item: **would I be happy for my child to see this exactly as it is?**

## Before your first review (one-off)

1. Go to **dev.revisionden.com** and sign in with Google as a parent.
2. Ask the lead session to give your account a reviewer role (`content-lead`). This is one row
   in the dev database's `reviewer_roles` table; there is no button for it yet. Until it is
   done, the review page says "This page is for reviewers only."
3. Your decisions are stored with your role, never your name.

## Reviewing a batch

1. Open **dev.revisionden.com/review**. You see "Reported problems" and a list of batches.
2. Click a batch title. Small batches (under 30 items) show every item; bigger ones show a random
   10% (at least 30), plus every item that always needs a person (proofs and essays).
3. For each item, check:
   - **The question** reads clearly and has only one correct answer.
   - **The answer** is right. Work it out yourself; don't just trust it.
   - **Wrong options** (multiple choice) really are wrong.
   - **Steps or explanation** are correct and easy to follow.
   - **Sources**: the quote is about the same topic as the question.
4. Click **Approve** if it is right. Click **Confirm error** if anything is wrong, type what is
   wrong in "What is wrong?", then **Yes, confirm the error**. Be specific ("option C is also
   prime", "step 2 drops a minus sign").

**One confirmed error sends the whole batch back** to be re-checked, so only confirm a real
error. For a style niggle (wording you'd like improved), approve it and tell the lead.

Each item also shows its hint, mark scheme, example answers (for proofs and essays: a top,
middle and low answer with the marks each should get) and the automatic checks it passed. Every
check should say "pass". If one says "FAIL", confirm an error and tell the lead.

## Near-match quotes

Every item cites a short quote from the exam board's document. A computer reads the PDF and looks
for the quote. Sometimes the PDF's formatting (bold, italics, small maths letters) makes the
words come out slightly differently, so the computer finds a **near match**: the same letters,
but not character for character. It never passes these on its own; a person must look.

**To confirm one:** open the PDF link, go to the page given, and check the quote is word for
word what is printed (ignore bold, italics and line breaks). Then tell the lead "confirmed" or
"not the same, because …". Near matches are confirmed with the lead, not in the review queue.

**Open now (pilot topic list, spec page 15, PDF page 27 of the
[1MA1 specification](https://qualifications.pearson.com/content/dam/pdf/GCSE/mathematics/2015/specification-and-sample-assesment/gcse-maths-2015-specification.pdf)):**

| Topic | Quote to compare                                                                                                                                                                  | Why it was flagged                   |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| A22   | "solve linear inequalities in one or two variable(s), and quadratic inequalities in one variable; represent the solution set on a number line, using set notation and on a graph" | Mixed bold and plain text, "**(s)**" |
| A25   | "deduce expressions to calculate the nth term of linear and quadratic sequences"                                                                                                  | The "n" in "nth" is in italics       |

## If you are unsure

Don't approve. Leave the item open and ask the lead. An item no one approves never reaches a
student.
