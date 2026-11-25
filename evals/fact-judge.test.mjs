import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FACT_JUDGE_BARS, runFactJudgeEval } from './fact-judge.mjs';
import { run } from './run.mjs';

const fixture = new URL('./fixtures/fact-judge.json', import.meta.url).pathname;
const cases = [
  { id: 's', a: 'A1', b: 'B1', same: true },
  { id: 'd', a: 'A2', b: 'B2', same: false },
];

/** A fake judge: answers from a table keyed by statement B. */
const fakeJudge = (answers) => ({
  provider: 'fake',
  model: 'fake-judge',
  requests: [],
  async complete(req) {
    this.requests.push(req);
    const b = req.prompt.split('Statement B:\n')[1].split('\n')[0];
    return { output: answers[b], modelVersion: 'fake-judge-1' };
  },
});
const yes = { same: true, confidence: 'high', reason: '' };
const no = { same: false, confidence: 'high', reason: '' };

test('a judge that gets every case right meets the bars', async () => {
  const report = await runFactJudgeEval({ cases }, fakeJudge({ B1: yes, B2: no }));
  assert.equal(report.passed, true);
  assert.deepEqual(report.misses, []);
});

test('calling a different fact the same fails, however good the rest is', async () => {
  const report = await runFactJudgeEval({ cases }, fakeJudge({ B1: yes, B2: yes }));
  assert.equal(report.passed, false);
  assert.deepEqual(report.misses, ['d']);
  assert.equal(FACT_JUDGE_BARS.different, 1);
});

test('an unsure "same" counts as not the same, as in the pipeline', async () => {
  const unsure = { same: true, confidence: 'medium', reason: '' };
  const report = await runFactJudgeEval({ cases }, fakeJudge({ B1: unsure, B2: no }));
  assert.deepEqual(report.misses, ['s']);
  assert.equal(report.score.same, 0);
});

test('the judge sees the pipeline prompt with our statement as A', async () => {
  const judge = fakeJudge({ B1: yes, B2: no });
  await runFactJudgeEval({ cases }, judge);
  assert.match(judge.requests[0].prompt, /Statement A:\nA1[\s\S]*Statement B:\nB1/);
});

test('the fact-judge command runs the set and exits 0 only when the bars are met', async () => {
  const lines = [];
  const io = { out: (s) => lines.push(s), err: (s) => lines.push(s), env: {} };
  const right = fakeJudge({ 'Fixture fact one, reworded.': yes, 'A different fixture fact.': no });
  const code = await run(['fact-judge', '--golden', fixture, '--judge', 'fake', '--live'], {
    ...io,
    judgeFor: () => right,
  });
  assert.equal(code, 0);
  assert.match(lines.join('\n'), /different facts refused: 100.0% \(bar 100%\)/);
  const wrong = fakeJudge({ 'Fixture fact one, reworded.': yes, 'A different fixture fact.': yes });
  assert.equal(
    await run(['fact-judge', '--golden', fixture, '--judge', 'fake', '--live'], {
      ...io,
      judgeFor: () => wrong,
    }),
    1,
  );
});

test('the fact-judge command also needs --live', async () => {
  const lines = [];
  const code = await run(['fact-judge', '--golden', fixture], {
    out: (s) => lines.push(s),
    err: (s) => lines.push(s),
    env: {},
  });
  assert.equal(code, 2);
});
