import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PASS_BARS,
  createModelMarker,
  markingPrompt,
  runEssayEval,
  scoreEssayResults,
  scoreItemCorrectness,
  scoreShortAnswers,
} from './marking.mjs';
import { run } from './run.mjs';

const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/essays.json', import.meta.url), 'utf8'),
);
const LABEL = "Marked by AI. This is a guide to help you improve, not your teacher's mark.";

const atLevel = (level, confidence = 'high') => {
  const marks = { 1: 2, 2: 5, 3: 8, 4: 11 }[level];
  return {
    level,
    marks,
    confidence,
    awards: [{ criterion: `L${level}`, marks, evidence: 'Fixture.' }],
  };
};
// A fake marker that gives each case the level from a table (default: the known level).
const fakeMarker = (id, levels = {}, confidence = 'high') => ({
  id,
  async mark({ answer }) {
    const c = fixture.cases.find((x) => x.answer === answer);
    return atLevel(levels[c.id] ?? c.knownLevel, confidence);
  },
});

test('the pass bars are the ones in docs/AI.md', () => {
  assert.deepEqual(PASS_BARS, {
    essay: { withinOneLevel: 0.9, unlabelled: 0, guessed: 0 },
    shortAnswer: { agreement: 0.95 },
    handwriting: { wordAccuracy: 0.98 },
    itemCorrectness: { correct: 1 },
  });
});

test('markers that match the known levels pass the essay bar', async () => {
  const report = await runEssayEval(fixture, [fakeMarker('a'), fakeMarker('b')]);
  assert.equal(report.score.total, 4);
  assert.equal(report.score.withinOneLevel, 1);
  assert.equal(report.score.unlabelled, 0);
  assert.equal(report.score.guessed, 0);
  assert.equal(report.passed, true);
});

test('a flagged disagreement is never a guessed mark, but counts against accuracy', async () => {
  const report = await runEssayEval(fixture, [
    fakeMarker('a'),
    fakeMarker('b', { 'fixture-essay-1': 1 }),
  ]);
  assert.equal(report.results[0].outcome, 'check_with_teacher');
  assert.equal(report.score.flagged, 1);
  assert.equal(report.score.guessed, 0);
  assert.equal(report.score.withinOneLevel, 0.75);
  assert.equal(report.passed, false);
});

test('a mark more than one level from the known level is a miss', async () => {
  const report = await runEssayEval(fixture, [
    fakeMarker('a', { 'fixture-essay-3': 2 }),
    fakeMarker('b', { 'fixture-essay-3': 2 }),
  ]);
  assert.equal(report.score.withinOneLevel, 0.75);
  assert.deepEqual(report.misses, ['fixture-essay-3']);
});

test('a result without the AI label, or a guessed disagreement, fails the bar', () => {
  const marked = (level, markings) => ({
    outcome: 'marked',
    level,
    marks: 0,
    label: LABEL,
    markings,
  });
  const results = [
    { ...marked(3, [atLevel(3), atLevel(3)]), label: '' },
    marked(2, [atLevel(2), atLevel(4)]),
  ];
  const cases = [{ knownLevel: 3 }, { knownLevel: 2 }];
  const score = scoreEssayResults(cases, results);
  assert.equal(score.unlabelled, 1);
  assert.equal(score.guessed, 1);
});

test('short-answer agreement and item correctness are scored against their bars', () => {
  assert.deepEqual(scoreShortAnswers([true, true, false, true]), {
    total: 4,
    agreement: 0.75,
    passed: false,
  });
  const allRight = Array.from({ length: 20 }, () => true);
  assert.equal(scoreShortAnswers(allRight).passed, true);
  assert.deepEqual(scoreItemCorrectness([true, true]), { total: 2, correct: 1, passed: true });
  assert.equal(scoreItemCorrectness([true, false]).passed, false);
});

test('the marking prompt sends only the question, answer and mark scheme', () => {
  const { prompt, system } = markingPrompt({
    question: 'Fixture Q?',
    answer: 'Fixture A.',
    scheme: fixture.scheme,
  });
  assert.match(prompt, /Fixture Q\?/);
  assert.match(prompt, /Fixture A\./);
  assert.match(prompt, /L3: 7 to 9 marks/);
  assert.match(system, /cite the criterion/);
  assert.match(system, /never rewrite/i);
});

test('a model marker asks its provider for a structured marking', async () => {
  const requests = [];
  const provider = {
    provider: 'openai',
    model: 'fixture-model',
    async complete(req) {
      requests.push(req);
      return { output: atLevel(3), modelVersion: 'fixture-model-001' };
    },
  };
  const marker = createModelMarker(provider);
  assert.equal(marker.id, 'openai:fixture-model');
  const marking = await marker.mark({ question: 'Q?', answer: 'A.', scheme: fixture.scheme });
  assert.equal(marking.level, 3);
  assert.equal(requests[0].schemaName, 'marking');
  assert.ok(requests[0].schema.required.includes('awards'));
});

const io = () => {
  const lines = [];
  return { lines, out: (s) => lines.push(s), err: (s) => lines.push(s) };
};

test('the eval command refuses to call real models without --live', async () => {
  const out = io();
  assert.equal(await run(['essay', '--golden', 'x.json'], { ...out, env: {} }), 2);
  assert.match(out.lines.join('\n'), /costs money: add --live/);
});

test('the eval command never runs in CI unless forced', async () => {
  const out = io();
  assert.equal(
    await run(['essay', '--golden', 'x.json', '--live'], { ...out, env: { CI: 'true' } }),
    2,
  );
  assert.match(out.lines.join('\n'), /not run in CI/);
});

test('the eval command runs the essay set and exits 0 only when the bar is met', async () => {
  const golden = new URL('./fixtures/essays.json', import.meta.url).pathname;
  const markers = { a: fakeMarker('a'), b: fakeMarker('b') };
  const out = io();
  const code = await run(['essay', '--golden', golden, '--live', '--markers', 'a,b'], {
    ...out,
    env: {},
    markerFor: (name) => markers[name],
  });
  assert.equal(code, 0);
  assert.match(out.lines.join('\n'), /within one level: 100.0% \(bar 90%\)/);
  assert.match(out.lines.join('\n'), /PASS/);
});
