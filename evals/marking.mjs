// AI marking evaluation (docs/AI.md "Quality measurement", docs/VERIFICATION.md section 7).
// Scores double AI marking against a golden set with known levels. Real models are called only
// by run.mjs with --live; tests use fake markers.
import { AI_MARKING_LABEL, markTwice } from '../packages/core/src/double-marking.ts';

/** Pass bars from docs/AI.md. */
export const PASS_BARS = {
  essay: { withinOneLevel: 0.9, unlabelled: 0, guessed: 0 },
  shortAnswer: { agreement: 0.95 },
  handwriting: { wordAccuracy: 0.98 },
  itemCorrectness: { correct: 1 },
};

export const MARKING_SCHEMA = {
  type: 'object',
  properties: {
    marks: { type: 'integer' },
    level: { type: 'integer', description: 'The level, for level-marked schemes; else 0.' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    awards: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          criterion: { type: 'string', description: 'Mark point code (M1) or level (L3).' },
          marks: { type: 'integer' },
          evidence: { type: 'string', description: 'Words from the answer that meet it.' },
        },
        required: ['criterion', 'marks', 'evidence'],
        additionalProperties: false,
      },
    },
    feedback: { type: 'string', description: 'What went well and up to three next steps.' },
  },
  required: ['marks', 'level', 'confidence', 'awards', 'feedback'],
  additionalProperties: false,
};

const SYSTEM = [
  'You are an experienced GCSE and A-Level examiner marking a student answer against the official',
  'mark scheme given. Mark only against that scheme. For every mark you award, cite the criterion',
  'it meets (a mark point code such as M1, or the level as L3) and quote the evidence from the',
  'answer. Give "low" or "medium" confidence if the answer is hard to place. Never rewrite the',
  "student's answer.",
].join(' ');

function schemeText(scheme) {
  if (scheme.type === 'levels') {
    return scheme.levels
      .map(
        (l) =>
          `L${l.level}: ${l.marks[0]} to ${l.marks[1]} marks${l.descriptor ? `. ${l.descriptor}` : ''}`,
      )
      .join('\n');
  }
  return scheme.points
    .map((p) => `${p.code}${p.description ? `: ${p.description}` : ''}`)
    .join('\n');
}

/** Only the question, the student's answer and the mark scheme are sent (docs/AI.md). */
export function markingPrompt({ question, answer, scheme }) {
  return {
    system: SYSTEM,
    prompt: `Question:\n${question}\n\nMark scheme:\n${schemeText(scheme)}\n\nStudent answer:\n${answer}`,
  };
}

/** A marker (see packages/core double-marking) backed by a model provider (scripts/verify). */
export function createModelMarker(provider) {
  return {
    id: `${provider.provider}:${provider.model}`,
    async mark(request) {
      const { output } = await provider.complete({
        ...markingPrompt(request),
        schema: MARKING_SCHEMA,
        schemaName: 'marking',
      });
      const marking = { ...output };
      delete marking.feedback;
      if (request.scheme.type !== 'levels') delete marking.level;
      return marking;
    },
  };
}

const levelGap = (markings) =>
  markings.length === 2 ? Math.abs(markings[0].level - markings[1].level) : 0;

/** Essay score: share within one level of the known level (flags count as misses). */
export function scoreEssayResults(cases, results) {
  let within = 0;
  let flagged = 0;
  let unlabelled = 0;
  let guessed = 0;
  const misses = [];
  results.forEach((r, i) => {
    if (r.label !== AI_MARKING_LABEL) unlabelled += 1;
    if (r.outcome === 'check_with_teacher') {
      flagged += 1;
      misses.push(cases[i].id);
      return;
    }
    if (levelGap(r.markings) > 1) guessed += 1;
    if (Math.abs(r.level - cases[i].knownLevel) <= 1) within += 1;
    else misses.push(cases[i].id);
  });
  const total = results.length;
  return {
    total,
    withinOneLevel: total ? within / total : 0,
    flagged,
    unlabelled,
    guessed,
    misses,
  };
}

/** Runs double marking on every case of an essay golden set and scores it. */
export async function runEssayEval(golden, markers) {
  const results = [];
  for (const c of golden.cases) {
    results.push(
      await markTwice({ question: c.question, answer: c.answer, scheme: golden.scheme }, markers),
    );
  }
  const { misses, ...score } = scoreEssayResults(golden.cases, results);
  const bar = PASS_BARS.essay;
  const passed =
    score.total > 0 &&
    score.withinOneLevel >= bar.withinOneLevel &&
    score.unlabelled <= bar.unlabelled &&
    score.guessed <= bar.guessed;
  return { results, score, misses, passed };
}

/** Short-answer marking: agreements is one boolean per answer (AI agrees with the known mark). */
export function scoreShortAnswers(agreements) {
  const total = agreements.length;
  const agreement = total ? agreements.filter(Boolean).length / total : 0;
  return { total, agreement, passed: total > 0 && agreement >= PASS_BARS.shortAnswer.agreement };
}

/** Item correctness: every sampled item must be right; one error triggers a batch re-check. */
export function scoreItemCorrectness(correct) {
  const total = correct.length;
  const share = total ? correct.filter(Boolean).length / total : 0;
  return { total, correct: share, passed: total > 0 && share >= PASS_BARS.itemCorrectness.correct };
}
