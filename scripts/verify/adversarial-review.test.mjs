import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewPrompt, runAdversarialReview, PROBLEM_KINDS } from './adversarial-review.mjs';
import { draftItem, quoted } from './test-content.mjs';

const AT = () => new Date('2026-11-24T12:00:00Z');
const fake = (output) => ({
  provider: 'gemini',
  model: 'gemini-fixture-model',
  async complete() {
    return { output, modelVersion: 'gemini-fixture-model-001' };
  },
});

const item = draftItem(
  'fixture-mc',
  [quoted({ quote: 'fixture quoted words', location: 'page 2', supports: ['answer'] })],
  {
    type: 'multiple_choice',
    prompt: 'Fixture question?',
    options: ['first', 'second'],
    answer: { option: 0 },
    explanation: 'Fixture explanation.',
  },
);

test('the reviewer sees the full item, the answer and the quoted sources', () => {
  const { prompt } = reviewPrompt(item);
  assert.match(prompt, /Fixture question\?/);
  assert.match(prompt, /"option": 0/);
  assert.match(prompt, /Fixture explanation\./);
  assert.match(prompt, /fixture quoted words/);
  assert.match(prompt, /page 2/);
});

test('the reviewer is asked about every kind of problem the protocol names', () => {
  assert.deepEqual(PROBLEM_KINDS, [
    'factual_error',
    'wrong_answer',
    'ambiguity',
    'second_correct_option',
    'outside_specification',
    'unsupported_claim',
    'wording',
  ]);
  const { system } = reviewPrompt(item);
  for (const kind of PROBLEM_KINDS) assert.match(system, new RegExp(kind));
});

test('passes when the reviewer finds no problems and is confident', async () => {
  const r = await runAdversarialReview(item, fake({ problems: [], confidence: 'high' }), {
    now: AT,
  });
  assert.equal(r.result, 'pass');
  assert.deepEqual(r.check, {
    name: 'adversarial-review',
    result: 'pass',
    tool: 'gemini:gemini-fixture-model',
    tool_version: 'gemini-fixture-model-001',
    at: '2026-11-24T12:00:00Z',
    notes: 'no problems found',
  });
});

test('fails and lists every problem the reviewer finds', async () => {
  const problems = [
    { kind: 'second_correct_option', part: 'option 1', description: 'Option 1 is also right.' },
    { kind: 'ambiguity', part: 'question', description: 'Unclear wording.' },
  ];
  const r = await runAdversarialReview(item, fake({ problems, confidence: 'high' }), { now: AT });
  assert.equal(r.result, 'fail');
  assert.equal(
    r.check.notes,
    'second_correct_option (option 1): Option 1 is also right.; ambiguity (question): Unclear wording.',
  );
  assert.deepEqual(r.problems, problems);
});

test('an unsure reviewer fails the item even with no problems listed', async () => {
  const r = await runAdversarialReview(item, fake({ problems: [], confidence: 'low' }), {
    now: AT,
  });
  assert.equal(r.result, 'fail');
  assert.equal(r.check.notes, 'no problems found; confidence low');
});
