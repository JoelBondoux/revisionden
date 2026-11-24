// AI marking evaluation (docs/AI.md "Quality measurement", docs/VERIFICATION.md section 7).
// Scores double AI marking against a golden set with known levels. Real models are called only
// by run.mjs with --live; tests use fake markers.
import { AI_MARKING_LABEL, markTwice } from '../packages/core/src/double-marking.ts';

// The marking prompt and model marker are shared with the blind-marking check.
export { MARKING_SCHEMA, createModelMarker, markingPrompt } from '../scripts/verify/marking.mjs';

/** Pass bars from docs/AI.md. */
export const PASS_BARS = {
  essay: { withinOneLevel: 0.9, unlabelled: 0, guessed: 0 },
  shortAnswer: { agreement: 0.95 },
  handwriting: { wordAccuracy: 0.98 },
  itemCorrectness: { correct: 1 },
};

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
