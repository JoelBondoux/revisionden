import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContent, mathsChecks, validateContent } from './validate.mjs';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

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
  topics: [
    {
      id: 'gcse-maths-h-algebra',
      title: 'Algebra',
      children: [{ id: 'gcse-maths-h-a17', title: 'Linear equations', spec_ref: ['A17'] }],
    },
  ],
};

const solveItem = {
  id: 'gcse-maths-h-a17-0001',
  topic: 'gcse-maths-h-a17',
  type: 'worked_maths',
  difficulty: 2,
  prompt: 'Solve 2x + 3 = 7',
  answer: { solutions: ['2'] },
  verify: { method: 'solve', equation: '2x + 3 = 7' },
  steps: ['2x + 3 = 7', '2x = 4', 'x = 2'],
  marks: 2,
  source_ref: 'Pearson Edexcel 1MA1 A17',
  checked_by: ['maths-engine'],
};

const numericItem = {
  id: 'gcse-maths-h-a17-0002',
  topic: 'gcse-maths-h-a17',
  type: 'numeric',
  difficulty: 1,
  prompt: 'Work out 3/4 of 120.',
  answer: { value: '90' },
  verify: { expression: '3/4 * 120' },
  marks: 1,
  source_ref: 'Pearson Edexcel 1MA1 N12',
  checked_by: ['maths-engine'],
};

const at = (file, data) => ({ file, data });

function content(overrides = {}) {
  return {
    subjects: [at('subjects/gcse-maths.json', subject)],
    topicTrees: [at('topic-trees/tree.json', tree)],
    markSchemes: [],
    items: [at('items/a.json', solveItem), at('items/a.json', numericItem)],
    ...overrides,
  };
}

// A fake maths engine: answers "ok" unless the check's answer is in the wrong list.
const fakeEngine =
  (wrong = []) =>
  async (checks) =>
    checks.map((c) =>
      wrong.includes(c.id) ? { id: c.id, ok: false, error: 'wrong' } : { id: c.id, ok: true },
    );

const messages = (errors) => errors.map((e) => e.message).join('\n');

test('valid content has no errors', async () => {
  const errors = await validateContent(content(), { checkMaths: fakeEngine() });
  assert.deepEqual(errors, []);
});

test('a schema error is reported with its file and id', async () => {
  const bad = { ...numericItem };
  delete bad.source_ref;
  const errors = await validateContent(content({ items: [at('items/b.json', bad)] }), {
    checkMaths: fakeEngine(),
  });
  assert.equal(errors[0].file, 'items/b.json');
  assert.equal(errors[0].id, numericItem.id);
  assert.match(errors[0].message, /source_ref/);
});

test('a duplicate id fails', async () => {
  const errors = await validateContent(
    content({ items: [at('items/a.json', numericItem), at('items/b.json', numericItem)] }),
    { checkMaths: fakeEngine() },
  );
  assert.match(messages(errors), /duplicate id gcse-maths-h-a17-0002/);
});

test('a duplicate id across a topic and an item fails', async () => {
  const clash = { ...numericItem, id: 'gcse-maths-h-a17' };
  const errors = await validateContent(content({ items: [at('items/a.json', clash)] }), {
    checkMaths: fakeEngine(),
  });
  assert.match(messages(errors), /duplicate id gcse-maths-h-a17/);
});

test('an item whose topic does not exist (orphan) fails', async () => {
  const orphan = { ...numericItem, topic: 'gcse-maths-h-nowhere' };
  const errors = await validateContent(content({ items: [at('items/a.json', orphan)] }), {
    checkMaths: fakeEngine(),
  });
  assert.match(messages(errors), /topic gcse-maths-h-nowhere does not exist/);
});

test('an item linked to a branch topic instead of a leaf fails', async () => {
  const branch = { ...numericItem, topic: 'gcse-maths-h-algebra' };
  const errors = await validateContent(content({ items: [at('items/a.json', branch)] }), {
    checkMaths: fakeEngine(),
  });
  assert.match(messages(errors), /must be a leaf topic/);
});

test('a topic tree for a subject that does not exist fails', async () => {
  const errors = await validateContent(content({ subjects: [] }), { checkMaths: fakeEngine() });
  assert.match(messages(errors), /subject gcse-maths does not exist/);
});

test('a missing mark scheme reference fails', async () => {
  const essay = {
    id: 'gcse-maths-h-a17-0003',
    topic: 'gcse-maths-h-a17',
    type: 'extended_answer',
    difficulty: 4,
    prompt: 'Show that ...',
    marks: 3,
    mark_scheme_ref: 'ms-missing',
    source_ref: 'A6',
    checked_by: ['human'],
  };
  const errors = await validateContent(content({ items: [at('items/a.json', essay)] }), {
    checkMaths: fakeEngine(),
  });
  assert.match(messages(errors), /mark scheme ms-missing does not exist/);
});

test('a multiple choice answer must point at one of the options', async () => {
  const mc = {
    id: 'gcse-maths-h-a17-0004',
    topic: 'gcse-maths-h-a17',
    type: 'multiple_choice',
    difficulty: 1,
    prompt: 'Pick one',
    options: ['a', 'b'],
    answer: { option: 2 },
    marks: 1,
    source_ref: 'A17',
    checked_by: ['human'],
  };
  const errors = await validateContent(content({ items: [at('items/a.json', mc)] }), {
    checkMaths: fakeEngine(),
  });
  assert.match(messages(errors), /answer option 2 is not one of the 2 options/);
});

test('a maths item must list maths-engine in checked_by', async () => {
  const unchecked = { ...numericItem, checked_by: ['human'] };
  const errors = await validateContent(content({ items: [at('items/a.json', unchecked)] }), {
    checkMaths: fakeEngine(),
  });
  assert.match(messages(errors), /must include maths-engine/);
});

test('a solve check needs solutions, and an expression check needs an expression', async () => {
  const mismatch = { ...solveItem, answer: { expression: '2' } };
  delete mismatch.steps;
  const errors = await validateContent(content({ items: [at('items/a.json', mismatch)] }), {
    checkMaths: fakeEngine(),
  });
  assert.match(messages(errors), /verify method solve needs answer.solutions/);
});

test('a wrong maths answer fails', async () => {
  const errors = await validateContent(content(), {
    checkMaths: fakeEngine(['gcse-maths-h-a17-0002']),
  });
  assert.equal(errors.length, 1);
  assert.equal(errors[0].id, 'gcse-maths-h-a17-0002');
  assert.match(errors[0].message, /maths engine: wrong/);
});

test('a wrong model solution fails on its own', async () => {
  const errors = await validateContent(content(), {
    checkMaths: fakeEngine(['gcse-maths-h-a17-0001#steps']),
  });
  assert.equal(errors[0].id, 'gcse-maths-h-a17-0001');
  assert.match(errors[0].message, /model solution/);
});

test('maths checks are skipped when no engine is given', async () => {
  const errors = await validateContent(content(), { checkMaths: null });
  assert.deepEqual(errors, []);
});

test('maths checks are not sent when the structure is already broken', async () => {
  let called = false;
  const engine = async (checks) => {
    called = true;
    return fakeEngine()(checks);
  };
  await validateContent(content({ subjects: [] }), { checkMaths: engine });
  assert.equal(called, false);
});

test('maths checks are built for numeric, solve, expression and model solutions', () => {
  const expr = {
    ...solveItem,
    id: 'gcse-maths-h-a17-0005',
    answer: { expression: '(x + 2)(x + 3)' },
    verify: { method: 'expression', expression: 'x^2 + 5x + 6', form: 'factorised' },
    steps: ['x^2 + 5x + 6', '(x + 2)(x + 3)'],
  };
  const rounded = { ...numericItem, answer: { value: '28.27', tolerance: 0.005 } };
  const checks = mathsChecks([solveItem, rounded, expr, { type: 'flashcard' }]);
  assert.deepEqual(checks, [
    { id: solveItem.id, kind: 'solve', equation: '2x + 3 = 7', variable: 'x', solutions: ['2'] },
    {
      id: `${solveItem.id}#steps`,
      kind: 'working',
      lines: solveItem.steps,
      expected: { solutions: ['2'] },
    },
    {
      id: numericItem.id,
      kind: 'value',
      expression: '3/4 * 120',
      answer: '28.27',
      tolerance: 0.005,
    },
    {
      id: expr.id,
      kind: 'expression',
      expression: 'x^2 + 5x + 6',
      answer: '(x + 2)(x + 3)',
      form: 'factorised',
    },
    {
      id: `${expr.id}#steps`,
      kind: 'working',
      lines: expr.steps,
      expected: { expression: 'x^2 + 5x + 6', form: 'factorised' },
    },
  ]);
});

test('content is loaded from its folders, with items read from arrays', async () => {
  const loaded = await loadContent(join(FIXTURES, 'valid'));
  assert.equal(loaded.subjects.length, 1);
  assert.equal(loaded.topicTrees.length, 1);
  assert.equal(loaded.markSchemes.length, 1);
  assert.equal(loaded.items.length, 2);
  assert.match(loaded.items[0].file, /items\/sample\.json$/);
});

test('an items file that is not an array is reported', async () => {
  const loaded = await loadContent(join(FIXTURES, 'not-array'));
  const errors = await validateContent(loaded, { checkMaths: null });
  assert.match(messages(errors), /must contain a JSON array of items/);
});

test('invalid JSON is reported with its file', async () => {
  const root = mkdtempSync(join(tmpdir(), 'content-'));
  mkdirSync(join(root, 'items'));
  writeFileSync(join(root, 'items', 'broken.json'), '{ "id": ');
  const loaded = await loadContent(root);
  const errors = await validateContent(loaded, { checkMaths: null });
  assert.match(errors[0].file, /broken\.json$/);
  assert.match(errors[0].message, /invalid JSON/);
});

test('the fixture content passes in full', async () => {
  const loaded = await loadContent(join(FIXTURES, 'valid'));
  assert.deepEqual(await validateContent(loaded, { checkMaths: fakeEngine() }), []);
});
