# AI plan

> Live document. Which model does what, the guardrails, and how quality is measured.

## Routing

| Job                                       | When                      | Model                                    | Notes                                    |
| ----------------------------------------- | ------------------------- | ---------------------------------------- | ---------------------------------------- |
| Write question banks                      | Offline, once per subject | Claude, in subscription working sessions | Output saved as JSON in `content/`       |
| Second check of items                     | Offline                   | GPT or Gemini (different provider)       | Disagreements flagged                    |
| Hints and short-answer feedback           | Live, many per day        | Claude Haiku 5.5                         | Low effort, short outputs                |
| Long answers, essays, Mark my homework    | Live, a few per day       | Claude Opus 5.5                          | Mark scheme and level descriptors cached |
| Reading photos (homework, school reports) | Live, occasional          | Gemini Flash or Claude Haiku 5.5         | Chosen by the reading evaluation         |
| Maths working                             | Live                      | No AI: maths engine                      | Exact                                    |

All live calls go through Cloudflare AI Gateway (logging without request bodies in production,
spend tracking, per-child monthly cap, provider fallback).

## Guardrails

- Only the question, the student's answer, the topic and the mark scheme are sent. Never names.
- Paid API tiers only.
- Marking prompts require: an estimated level or mark, feedback per assessed skill, what went
  well, up to three next steps. No rewritten answer.
- Every AI-marked result carries the label "Marked by AI. This is a guide to help you improve,
  not your teacher's mark."
- The tutor answers only from course material and says "not sure, check with your teacher" when
  it cannot.
- Structured outputs (JSON schema) for every live call so responses are validated before use.

## Quality measurement (`evals/`)

| Evaluation           | Set                                                 | Pass bar                                                                                  |
| -------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Essay marking        | 50 anonymised or synthetic essays with known levels | 90% within ±1 level; 0 results without the AI label; disagreements flagged, never guessed |
| Short-answer marking | 300 answers with known correctness                  | 95% agreement                                                                             |
| Handwriting reading  | 40 synthetic handwritten pages                      | 98% word accuracy on confirmed text                                                       |
| Item correctness     | Random 200 items per subject                        | 100% correct (any error triggers a batch re-check)                                        |

Teacher marks added in Mark my homework are collected (with no personal data) to compare against
AI marks over time. Evaluations run weekly and whenever a prompt or model changes; never in CI by
default because they cost money.

## Costs

Day-to-day target: £2 to £5 a month for two students, enforced by the gateway cap. Usage is
reviewed monthly in the parent portal.
