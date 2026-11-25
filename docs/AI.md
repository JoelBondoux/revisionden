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

## Gateway client (`apps/api/src/ai`, workstream H)

- Claude through the official `@anthropic-ai/sdk`, pointed at `<AI_GATEWAY_URL>/anthropic`;
  OpenAI (second checker) through `<AI_GATEWAY_URL>/openai`. Jobs and models:
  `short_answer_marking` → `claude-haiku-5-5` (effort low), `long_answer_marking` →
  `claude-opus-5-5` (route ready, not used yet), `second_check` → `AI_CHECKER_MODEL`.
- Every reply uses structured outputs (a JSON schema) and is validated with Zod before use.
- Up to 3 attempts with exponential backoff (250 ms, 500 ms, plus jitter) for timeouts, rate
  limits, overload, server errors, network errors and replies that fail validation. Refusals
  and bad requests are not retried.
- Per-child monthly cap (default US$2.50, `AI_MONTHLY_CAP_USD`), checked before every call;
  families only ever see it as an allowance, never money (K9). When it is used up the student
  sees "You've used this month's AI marking allowance. It resets on 1 <month>. Questions marked
  by the app still work." Every billed attempt is recorded in `ai_usage` (tokens and cost only).
- A request containing the student's profile fields or other personal data is refused before
  it is sent. Parents see this month's allowance used (a percentage and the reset date, no money) at
  `GET /v1/students/:id/ai-usage`; the raw cost stays in operator routes.

## Short-answer marking (`POST /v1/ai/mark-short-answer`)

1. Blank answer: 0, no AI. An accepted answer, or the official wording of a mark point, found in
   the answer earns the mark by rule (not when the answer has a negation such as "not").
2. Only the points left go to Claude Haiku 5.5, with the question, topic, answer and those mark
   points. For each point it must say met or not and quote the student's words as evidence.
3. If the AI is unsure, leaves a point out, cites a point that is not in the mark scheme, or
   quotes words that are not in the answer, the result is "Not sure about this one. Check with
   your teacher." with only the rule-awarded marks. No guesses.
4. Items with no official mark points (a multi-mark item without a mark scheme) are never
   AI-marked. Any result the AI touched carries the AI label.

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
