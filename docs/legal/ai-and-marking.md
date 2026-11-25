# AI and marking

Version: 1.1
Effective date: {{EFFECTIVE_DATE}}

## In plain English

- Most questions are marked by fixed rules or by our maths checker, with **no AI**.
- AI helps mark some short written answers that the rules can't mark.
- The AI is never told who you are. We check every request and stop it if it has your nickname,
  your school year, an email or a phone number in it.
- Every AI mark says: **"Marked by AI. This is a guide to help you improve, not your teacher's
  mark."**
- If the AI isn't sure, you see "Check with your teacher" instead of a guess.
- The AI never rewrites your work.
- Each student has a monthly AI limit, so costs stay low.
- If the summary and the full text seem to differ, the full text is the one that counts.

## Full text

### 1. How answers are marked

1.1 **Fixed rules.** Multiple-choice, numeric and flashcard answers, and short answers that match
an accepted answer or the official wording of a mark point, are marked by rules written in our
code. A blank answer scores zero without any AI.

1.2 **Maths engine.** Worked maths answers are checked by our maths engine, which uses a computer
algebra library (no AI) to find the first line of working that does not follow and whether the
final answer is right.

1.3 **AI.** Only the mark points that the rules could not decide are sent to an AI model, currently
Claude Haiku (made by Anthropic), through Cloudflare AI Gateway. For each mark point the AI must
say whether it is met and quote the student's own words as evidence.

1.4 **When the AI is unsure.** If the AI says it is unsure, leaves a point out, cites a point that
is not in the mark scheme, or quotes words that are not in the answer, the student sees "Not sure
about this one. Check with your teacher." and only the marks the rules gave. The app never
guesses.

1.5 Questions with no official mark points are never marked by AI.

### 2. The "Marked by AI" label

2.1 Every result the AI contributed to carries exactly this label:

> Marked by AI. This is a guide to help you improve, not your teacher's mark.

2.2 AI marks are not exam grades, are not sent to schools or exam boards, and do not decide
anything outside the app.

### 3. What the AI receives

3.1 Only the question, the topic, the student's answer and the relevant mark points.

3.2 Before anything is sent, {{OPERATOR_NAME}}'s server checks the exact request and refuses it if
it contains the student's nickname, internal identifiers, avatar code, school year (such as
"Year 10"), an email address or a UK mobile phone number. The student is asked to leave out
personal details.

3.3 We use paid API accounts. AI Gateway logs keep only token counts, cost and status, not the
request or reply. In our own database we store only the number of tokens and the cost of each AI
call, never the question, the answer or the reply. Where the AI provider processes the request,
and what it keeps, is set out in [services we use](processors.md).

### 4. Limits

4.1 Each child has a monthly AI marking allowance. When it is used up the student sees "You've
used this month's AI marking allowance. It resets on 1 <month>." (with the month named).
Parents can see how much of this month's allowance each child has used, and when it resets.

4.2 AI can make mistakes. It may misread an answer or apply a mark point wrongly. That is why the
label is always shown, why the AI must quote the student's words, and why uncertain results are
not shown as marks.

### 5. Features that are not available yet

5.1 **Long answers and essays.** Marking long answers is prepared but not switched on. When it is,
each answer will be marked twice independently against the mark scheme; if the two markings are
more than one level apart (or one mark for mark-point schemes), or either is unsure or does not
cite the scheme, the student will see "check with your teacher". When they agree, the lower mark
is given. AI will never rewrite the student's work.

5.2 **Reading photos of homework or school reports.** Not available yet. When it is:

- **students should cover their name, and their school's name, before taking a photo;**
- the photo will be read, the user will check and correct what was read, and the photo will then
  be deleted at once (and always within 24 hours);
- only the checked text or grades will be kept.

### 6. How we check AI quality

6.1 We test AI marking against sets of made-up or anonymised answers with known marks before we
change a model or a prompt, and we only release changes that meet our quality targets. These tests
never use real students' answers.

### 7. AI in writing questions

7.1 Questions may be drafted with AI help, but no question reaches students until it has passed
our verification process, including official citations and human approval. See
[content accuracy](content-accuracy.md).

## Changes

- 1.1: AI use is described as a monthly AI marking allowance for each child, with no money figures, and the message a student sees when it is used up has new wording.
- 1.0 ({{EFFECTIVE_DATE}}): First version (draft, not yet reviewed by a solicitor).
