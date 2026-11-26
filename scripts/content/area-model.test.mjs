// Content checks for interactive area model items (lesson pilot W8, owner 2026-11-26).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mathsChecks, validateContent } from './validate.mjs';
import { citation, draft } from './test-helpers.mjs';

const subject = {
  id: 'gcse-maths',
  name: 'Maths',
  level: 'GCSE',
  boards: [{ board: 'edexcel', spec_code: '1MA1', tiers: ['higher'] }],
};

const tree = {
  id: 'gcse-maths-edexcel-higher',
  subject: 'gcse-maths',
  board: 'edexcel',
  tier: 'higher',
  specification: { code: '1MA1', title: 'GCSE Mathematics', url: 'https://example.org/spec' },
  verification: draft(),
  topics: [
    {
      id: 'gcse-maths-h-algebra',
      title: 'Algebra',
      children: [
        {
          id: 'gcse-maths-h-a4',
          title: 'Simplifying, expanding and factorising',
          spec_ref: ['A4'],
          citations: [citation({ supports: ['topic'] })],
        },
      ],
    },
  ],
};

const areaModel = {
  id: 'gcse-maths-h-a4-area-0001',
  topic: 'gcse-maths-h-a4',
  type: 'area_model',
  mode: 'explore',
  difficulty: 1,
  prompt: 'Make x^2 + 5x + 6 into a rectangle.',
  quadratic: { b: 5, c: 6 },
  answer: { pair: [2, 3] },
  marks: 1,
  source_ref: 'Pearson Edexcel 1MA1 A4',
  checked_by: ['maths-engine'],
  citations: [citation()],
  verification: draft(),
};

const fakeEngine = () => async (checks) => checks.map((c) => ({ id: c.id, ok: true }));
const run = (items) =>
  validateContent(
    {
      subjects: [{ file: 'subjects/gcse-maths.json', data: subject }],
      topicTrees: [{ file: 'topic-trees/tree.json', data: tree }],
      markSchemes: [],
      items: items.map((data) => ({ file: 'items/area.json', data })),
    },
    { checkMaths: fakeEngine() },
  );
const messages = async (items) => (await run(items)).map((e) => e.message).join('\n');

test('a valid area model item passes', async () => {
  assert.deepEqual(await run([areaModel]), []);
});

test('a guided area model item may have a hint', async () => {
  const guided = { ...areaModel, mode: 'guided', hint: 'The two numbers multiply to 6.' };
  assert.deepEqual(await run([guided]), []);
});

test('an area model item needs a quadratic, an answer pair and a known mode', async () => {
  const { quadratic, ...noQuadratic } = areaModel;
  assert.ok(quadratic);
  assert.match(await messages([noQuadratic]), /quadratic/);
  assert.match(await messages([{ ...areaModel, answer: { pair: [2] } }]), /pair/);
  assert.match(await messages([{ ...areaModel, mode: 'free-play' }]), /mode/);
});

test('the pilot only allows positive b and c that factorise and fit on screen (scope A)', async () => {
  const negative = { ...areaModel, quadratic: { b: 1, c: -6 }, answer: { pair: [3, -2] } };
  assert.match(await messages([negative]), /quadratic|pair/);
  const noFactors = { ...areaModel, quadratic: { b: 4, c: 6 }, answer: { pair: [2, 3] } };
  assert.match(await messages([noFactors]), /does not factorise/);
  const tooBig = { ...areaModel, quadratic: { b: 13, c: 40 }, answer: { pair: [5, 8] } };
  assert.match(await messages([tooBig]), /c/);
});

test('the answer pair must be the one that splits the middle term, smaller first', async () => {
  assert.match(
    await messages([{ ...areaModel, answer: { pair: [1, 6] } }]),
    /answer pair 1, 6 does not make x\^2 \+ 5x \+ 6: use 2, 3/,
  );
  assert.match(
    await messages([{ ...areaModel, answer: { pair: [3, 2] } }]),
    /smaller number first/,
  );
});

test('an area model item must be checked by the maths engine', async () => {
  assert.match(
    await messages([{ ...areaModel, checked_by: ['author'] }]),
    /checked_by must include maths-engine/,
  );
});

test('the maths engine checks that the quadratic factorises to the two brackets', () => {
  assert.deepEqual(mathsChecks([areaModel]), [
    {
      id: areaModel.id,
      kind: 'expression',
      expression: 'x^2 + 5x + 6',
      answer: '(x + 2)(x + 3)',
      form: 'factorised',
    },
  ]);
});
