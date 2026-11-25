// Fact-check judge evaluation (docs/VERIFICATION.md step 4b, decision 0009). Runs the pipeline's
// judge prompt on pairs of fact statements with a known answer: the same fact in other words, or
// a different fact. Real models are called only by run.mjs with --live; tests use fake judges.
import { JUDGE_SCHEMA, factJudgePrompt } from '../scripts/verify/fact-check.mjs';

/** Every different fact must be refused; at least 90% of same facts must be accepted. */
export const FACT_JUDGE_BARS = { different: 1, same: 0.9 };

const share = (hits, total) => (total ? hits / total : 1);

/** { score: { same, different }, misses, passed } for a set of { id, a, b, same } cases. */
export async function runFactJudgeEval(golden, judge) {
  const misses = [];
  let sameHits = 0;
  let differentHits = 0;
  for (const c of golden.cases) {
    const { output } = await judge.complete({
      ...factJudgePrompt(c.a, c.b),
      schema: JUDGE_SCHEMA,
      schemaName: 'fact_judgement',
    });
    // As in the pipeline, only a confident "same" counts as the same.
    const judgedSame = output.same && output.confidence === 'high';
    if (judgedSame === c.same) {
      if (c.same) sameHits += 1;
      else differentHits += 1;
    } else misses.push(c.id);
  }
  const sameTotal = golden.cases.filter((c) => c.same).length;
  const score = {
    same: share(sameHits, sameTotal),
    different: share(differentHits, golden.cases.length - sameTotal),
  };
  const passed = score.same >= FACT_JUDGE_BARS.same && score.different >= FACT_JUDGE_BARS.different;
  return { score, misses, passed };
}
