import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runBlindMarking, toMarkingScheme } from './blind-marking.mjs';
import { draftItem } from './test-content.mjs';

const AT = () => new Date('2026-11-24T12:00:00Z');

// Synthetic fixtures, not educational content.
const levelScheme = {
  id: 'fixture-ms-levels',
  type: 'levels',
  levels: [
    { level: 1, marks: [1, 2], descriptor: 'Fixture low descriptor' },
    { level: 2, marks: [3, 4], descriptor: 'Fixture middle descriptor' },
    { level: 3, marks: [5, 6], descriptor: 'Fixture top descriptor' },
  ],
};
const exemplars = [
  { band: 'top', level: 3, answer: 'Fixture top answer.' },
  { band: 'middle', level: 2, answer: 'Fixture middle answer.' },
  { band: 'low', level: 1, answer: 'Fixture low answer.' },
];
const essay = draftItem('fixture-essay', undefined, {
  type: 'extended_answer',
  prompt: 'Fixture essay question?',
  marks: 6,
  mark_scheme_ref: 'fixture-ms-levels',
  exemplars,
  answer: undefined,
});

const marksFor = { 1: 2, 2: 3, 3: 6 };
const marking = (level, confidence = 'high') => ({
  marks: marksFor[level],
  level,
  confidence,
  awards: [{ criterion: `L${level}`, marks: marksFor[level], evidence: 'Fixture evidence.' }],
  feedback: 'Fixture feedback.',
});

/** A fake provider that marks each exemplar at the level in `levels` (by answer text). */
function fakeProvider(levels, { provider = 'openai', confidence = 'high' } = {}) {
  const prompts = [];
  return {
    provider,
    model: `${provider}-fixture-model`,
    prompts,
    async complete({ prompt }) {
      prompts.push(prompt);
      const band = exemplars.find((e) => prompt.includes(e.answer)).band;
      return { output: marking(levels[band], confidence), modelVersion: `${provider}-fixture-001` };
    },
  };
}
const asIntended = { top: 3, middle: 2, low: 1 };

test('passes when the second provider marks all three exemplars at their intended levels', async () => {
  const r = await runBlindMarking(essay, levelScheme, fakeProvider(asIntended), { now: AT });
  assert.equal(r.result, 'pass');
  assert.deepEqual(r.check, {
    name: 'blind-marking',
    result: 'pass',
    tool: 'openai:openai-fixture-model',
    tool_version: 'openai-fixture-001',
    at: '2026-11-24T12:00:00Z',
    notes:
      'top: intended L3, marked L3; middle: intended L2, marked L2; low: intended L1, marked L1',
  });
});

test('the marker never sees the intended levels', async () => {
  const provider = fakeProvider(asIntended);
  await runBlindMarking(essay, levelScheme, provider, { now: AT });
  assert.equal(provider.prompts.length, 3);
  for (const p of provider.prompts) {
    assert.doesNotMatch(p, /intended|top band|middle band|low band|"band"/i);
  }
});

test('fails when any exemplar is marked at another level, even by one', async () => {
  const r = await runBlindMarking(essay, levelScheme, fakeProvider({ ...asIntended, middle: 3 }), {
    now: AT,
  });
  assert.equal(r.result, 'fail');
  assert.match(r.check.notes, /middle: intended L2, marked L3/);
});

test('fails when the marker is unsure', async () => {
  const r = await runBlindMarking(
    essay,
    levelScheme,
    fakeProvider(asIntended, { confidence: 'medium' }),
    { now: AT },
  );
  assert.equal(r.result, 'fail');
  assert.match(r.check.notes, /confidence medium/);
});

test('fails when a marking does not cite the mark scheme properly', async () => {
  const provider = {
    provider: 'gemini',
    model: 'm',
    async complete() {
      return { output: { ...marking(3), awards: [] }, modelVersion: 'v' };
    },
  };
  const r = await runBlindMarking(essay, levelScheme, provider, { now: AT });
  assert.equal(r.result, 'fail');
  assert.match(r.check.notes, /every mark must cite a criterion/);
});

test('fails without asking a model when the three exemplars are not all there', async () => {
  const provider = fakeProvider(asIntended);
  const r = await runBlindMarking(
    { ...essay, exemplars: exemplars.slice(0, 2) },
    levelScheme,
    provider,
    { now: AT },
  );
  assert.equal(r.result, 'fail');
  assert.match(r.check.notes, /needs a top, middle and low exemplar/);
  assert.equal(provider.prompts.length, 0);
});

test('the marker must come from a different provider from the writer', async () => {
  await assert.rejects(
    runBlindMarking(essay, levelScheme, fakeProvider(asIntended, { provider: 'anthropic' }), {
      now: AT,
    }),
    /different provider than the writer \(anthropic\)/,
  );
});

test('a mark-point scheme compares total marks with the intended marks', async () => {
  const points = {
    id: 'fixture-ms-points',
    type: 'points',
    points: [
      { code: 'B1', description: 'Fixture point one' },
      { code: 'M1', description: 'Fixture point two' },
      { code: 'A1', description: 'Fixture point three' },
    ],
  };
  const proof = {
    ...essay,
    mark_scheme_ref: 'fixture-ms-points',
    exemplars: [
      { band: 'top', level: 3, answer: 'Fixture top answer.' },
      { band: 'middle', level: 2, answer: 'Fixture middle answer.' },
      { band: 'low', level: 1, answer: 'Fixture low answer.' },
    ],
  };
  const codes = ['B1', 'M1', 'A1'];
  const provider = {
    provider: 'openai',
    model: 'm',
    async complete({ prompt }) {
      const n = proof.exemplars.find((e) => prompt.includes(e.answer)).level;
      const awards = codes.slice(0, n).map((c) => ({ criterion: c, marks: 1, evidence: 'x' }));
      return {
        output: { marks: n, level: 0, confidence: 'high', awards, feedback: '' },
        modelVersion: 'v',
      };
    },
  };
  const r = await runBlindMarking(proof, points, provider, { now: AT });
  assert.equal(r.result, 'pass', r.check.notes);
  assert.match(r.check.notes, /top: intended 3 marks, marked 3 marks/);
});

test('content mark schemes convert to the marking rules format', () => {
  assert.deepEqual(toMarkingScheme(levelScheme).levels[0], {
    level: 1,
    marks: [1, 2],
    descriptor: 'Fixture low descriptor',
  });
  assert.equal(
    toMarkingScheme({ type: 'points', points: [{ code: 'B1', description: 'd' }] }).type,
    'points',
  );
});
