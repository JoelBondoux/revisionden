import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  auditReport,
  immutabilityErrors,
  loadContent,
  mathsChecks,
  validateContent,
} from './validate.mjs';
import { citation, draft, quotedCitation, verified } from './test-helpers.mjs';

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
  verification: draft(),
  topics: [
    {
      id: 'gcse-maths-h-algebra',
      title: 'Algebra',
      children: [
        {
          id: 'gcse-maths-h-a17',
          title: 'Linear equations',
          spec_ref: ['A17'],
          citations: [citation({ supports: ['topic'] })],
        },
      ],
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
  citations: [citation()],
  verification: draft(),
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
  citations: [citation()],
  verification: draft(),
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

test('a number answer may give the reason it has no subject (S4, Codex on #452)', async () => {
  const withReason = (no_subject) => ({
    ...numericItem,
    answer: { value: '90', no_subject },
  });
  const ok = await validateContent(
    content({ items: [at('items/b.json', withReason('x names the line, not the answer.'))] }),
    { checkMaths: fakeEngine() },
  );
  assert.deepEqual(ok, []);
  const short = await validateContent(content({ items: [at('items/b.json', withReason('no'))] }), {
    checkMaths: fakeEngine(),
  });
  assert.match(messages(short), /no_subject/);
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
    citations: [citation()],
    verification: draft(),
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
    citations: [citation()],
    verification: draft(),
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

const mc = {
  id: 'gcse-maths-h-a17-0009',
  topic: 'gcse-maths-h-a17',
  type: 'multiple_choice',
  difficulty: 1,
  prompt: 'Pick the solution of 2x = 4',
  options: ['1', '2', '4'],
  answer: { option: 1 },
  marks: 1,
  source_ref: 'A17',
  checked_by: ['human'],
  citations: [citation()],
  verification: draft(),
};

const check = (items, extra = {}) =>
  validateContent(content({ items: items.map((i) => at('items/a.json', i)), ...extra }), {
    checkMaths: fakeEngine(),
  });

test('a quote longer than 50 words fails', async () => {
  const quote = Array.from({ length: 51 }, () => 'word').join(' ');
  const errors = await check([{ ...numericItem, citations: [quotedCitation({ quote })] }]);
  assert.match(messages(errors), /quote is 51 words; keep it to 50 or fewer/);
});

test('an item cited only by other authoritative sources needs human approval', async () => {
  const other = { ...numericItem, citations: [citation({ source_type: 'other_authoritative' })] };
  assert.match(messages(await check([other])), /needs_human_approval: true/);
  assert.deepEqual(await check([{ ...other, needs_human_approval: true }]), []);
});

test('a distractor citation must point at a wrong option', async () => {
  const ok = { ...mc, citations: [citation({ supports: ['question', 'distractor:0'] })] };
  assert.deepEqual(await check([ok]), []);
  const correct = { ...mc, citations: [citation({ supports: ['distractor:1'] })] };
  assert.match(messages(await check([correct])), /distractor:1 is the correct option/);
  const missing = { ...mc, citations: [citation({ supports: ['distractor:7'] })] };
  assert.match(messages(await check([missing])), /distractor:7 is not one of the 3 options/);
});

test('a distractor citation on an item without options fails', async () => {
  const bad = { ...numericItem, citations: [citation({ supports: ['distractor:0'] })] };
  assert.match(messages(await check([bad])), /only multiple choice items have distractors/);
});

test('a fully checked verified item passes', async () => {
  const item = {
    ...numericItem,
    citations: [quotedCitation()],
    verification: verified({ maths: true }),
  };
  assert.deepEqual(await check([item]), []);
});

test('a verified item whose citations have no quote fails', async () => {
  const item = { ...numericItem, verification: verified({ maths: true }) };
  assert.match(messages(await check([item])), /verified content needs a quote in every citation/);
});

test('a verified item missing a required check fails', async () => {
  const noEngine = {
    ...numericItem,
    citations: [quotedCitation()],
    verification: verified({ maths: false }),
  };
  assert.match(
    messages(await check([noEngine])),
    /verified content needs a passing maths-engine check/,
  );
  const v = verified({ maths: true });
  v.checks = v.checks.filter((c) => c.name !== 'blind-answer');
  const noModel = { ...numericItem, citations: [quotedCitation()], verification: v };
  assert.match(messages(await check([noModel])), /needs a passing blind-answer check/);
});

test('a verified item with a failed check fails', async () => {
  const v = verified({ maths: true });
  v.checks.push({ ...v.checks[0], result: 'fail' });
  const item = { ...numericItem, citations: [quotedCitation()], verification: v };
  assert.match(
    messages(await check([item])),
    /verified content has a failed grounded-writing check/,
  );
});

test('a verified item without a reviewer role fails', async () => {
  const v = verified({ maths: true });
  delete v.reviewed_by;
  const item = { ...numericItem, citations: [quotedCitation()], verification: v };
  assert.match(messages(await check([item])), /verified content needs reviewed_by/);
});

test('a verified topic tree needs quotes on every leaf', async () => {
  const t = structuredClone(tree);
  t.verification = { ...verified(), checks: verified().checks };
  const errors = await validateContent(content({ topicTrees: [at('topic-trees/t.json', t)] }), {
    checkMaths: null,
  });
  assert.match(messages(errors), /verified content needs a quote in every citation/);
  t.topics[0].children[0].citations = [quotedCitation({ supports: ['topic'] })];
  const ok = await validateContent(content({ topicTrees: [at('topic-trees/t.json', t)] }), {
    checkMaths: null,
  });
  assert.deepEqual(ok, []);
});

const diagram = {
  id: 'diagram-line',
  generated_by: 'code',
  format: 'svg',
  svg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
  alt: 'A line',
  citations: [citation({ supports: ['diagram'] })],
  verification: draft(),
};

test('an item pointing at a missing diagram fails; an existing one passes', async () => {
  const item = { ...numericItem, diagram_ref: 'diagram-line' };
  assert.match(messages(await check([item])), /diagram diagram-line does not exist/);
  assert.deepEqual(await check([item], { diagrams: [at('diagrams/line.json', diagram)] }), []);
});

test('diagram ids must be unique too', async () => {
  const errors = await check([numericItem], {
    diagrams: [at('diagrams/a.json', diagram), at('diagrams/b.json', diagram)],
  });
  assert.match(messages(errors), /duplicate id diagram-line/);
});

test('changing verified content without a new version fails', () => {
  const v1 = {
    ...numericItem,
    citations: [quotedCitation()],
    verification: verified({ maths: true }),
  };
  const before = content({ items: [at('items/a.json', v1)] });
  const edited = { ...v1, prompt: 'Work out 3/4 of 160.' };
  const sameVersion = content({ items: [at('items/a.json', edited)] });
  assert.match(
    messages(immutabilityErrors(before, sameVersion)),
    /verified version 1 was changed; edits need version 2/,
  );
  const bumped = { ...edited, verification: { ...draft(), version: 2 } };
  assert.deepEqual(
    immutabilityErrors(before, content({ items: [at('items/a.json', bumped)] })),
    [],
  );
  assert.deepEqual(immutabilityErrors(before, before), []);
});

test('a version number can never go down', () => {
  const v2 = { ...numericItem, verification: { ...draft(), version: 2 } };
  const v1 = { ...numericItem, verification: draft() };
  const errors = immutabilityErrors(
    content({ items: [at('items/a.json', v2)] }),
    content({ items: [at('items/a.json', v1)] }),
  );
  assert.match(messages(errors), /version went down from 2 to 1/);
});

test('the audit report lists every piece of content with its sources and status', () => {
  const report = auditReport(content());
  const row = report.find((r) => r.id === numericItem.id);
  assert.deepEqual(row, {
    id: numericItem.id,
    kind: 'item',
    file: 'items/a.json',
    status: 'draft',
    version: 1,
    citations: 1,
    quoted: 0,
    needs_sourcing: true,
    needs_human_approval: false,
    sources: ['Pearson Edexcel 1MA1 Content reference A17'],
  });
  assert.ok(report.some((r) => r.kind === 'topic' && r.id === 'gcse-maths-h-a17'));
  assert.ok(report.some((r) => r.kind === 'topic-tree'));
});

test('copies of documents and raster images in the content folder are refused', async () => {
  const root = mkdtempSync(join(tmpdir(), 'content-'));
  mkdirSync(join(root, 'items'));
  writeFileSync(join(root, 'items', 'spec.pdf'), '%PDF-1.7');
  writeFileSync(join(root, 'items', 'triangle.png'), 'png');
  const errors = await validateContent(await loadContent(root), { checkMaths: null });
  assert.equal(errors.length, 2);
  assert.match(messages(errors), /do not commit copies of documents or raster images/);
});

test('a verified item needs human approval or a passed batch sample to be released', async () => {
  const sampled = {
    ...numericItem,
    citations: [quotedCitation()],
    verification: verified({ maths: true, release: 'batch-sample' }),
  };
  assert.deepEqual(await check([sampled]), []);
  const v = verified({ maths: true });
  v.checks = v.checks.filter((c) => c.name !== 'human-approval');
  const neither = { ...numericItem, citations: [quotedCitation()], verification: v };
  assert.match(
    messages(await check([neither])),
    /needs a passing human-approval or batch-sample check/,
  );
});

const factItem = (checks, extra = {}) => {
  const v = verified({ maths: true, release: 'batch-sample' });
  v.checks.push(...checks.map((c) => ({ ...v.checks[0], ...c })));
  return {
    ...numericItem,
    citations: [quotedCitation()],
    facts: [{ statement: 'Fixture fact.', ask: 'Fixture question about the fact?' }],
    verification: v,
    ...extra,
  };
};

test('a verified item with facts needs a fact-check (decision 0009)', async () => {
  assert.match(messages(await check([factItem([])])), /needs a fact-check check/);
  assert.deepEqual(await check([factItem([{ name: 'fact-check', result: 'pass' }])]), []);
});

test('a failed fact-check is only released by individual human approval', async () => {
  const failed = [{ name: 'fact-check', result: 'fail' }];
  assert.match(
    messages(await check([factItem(failed)])),
    /failed fact-check needs needs_human_approval and a passing human-approval check/,
  );
  const v = verified({ maths: true });
  v.checks.push({ ...v.checks[0], name: 'fact-check', result: 'fail' });
  const approved = { ...factItem(failed), needs_human_approval: true, verification: v };
  assert.deepEqual(await check([approved]), []);
});

test('an item that needs human approval cannot be released by batch sampling', async () => {
  const item = {
    ...numericItem,
    needs_human_approval: true,
    citations: [quotedCitation({ source_type: 'other_authoritative' })],
    verification: verified({ maths: true, release: 'batch-sample' }),
  };
  assert.match(
    messages(await check([item])),
    /needs_human_approval items need a passing human-approval check/,
  );
});

test('verified topic trees, mark schemes and diagrams need quote, schema and human checks', async () => {
  const t = structuredClone(tree);
  t.topics[0].children[0].citations = [quotedCitation({ supports: ['topic'] })];
  t.verification = { ...verified(), checks: verified().checks.filter((c) => c.name === 'schema') };
  const errors = await validateContent(content({ topicTrees: [at('topic-trees/t.json', t)] }), {
    checkMaths: null,
  });
  assert.match(messages(errors), /needs a passing quote-check check/);
  assert.match(messages(errors), /needs a passing human-approval or batch-sample check/);
});

test('the audit report for one id includes every citation and check', () => {
  const item = {
    ...numericItem,
    citations: [quotedCitation()],
    verification: verified({ maths: true }),
  };
  const report = auditReport(content({ items: [at('items/a.json', item)] }), {
    detail: true,
    filter: numericItem.id,
  });
  assert.equal(report.length, 1);
  assert.equal(report[0].detail.citations[0].quote, quotedCitation().quote);
  assert.equal(report[0].detail.checks.length, 7);
  assert.equal(report[0].detail.reviewed_by, 'subject-specialist');
});

test('the audit report can be filtered to a topic or a whole subject', () => {
  const byTopic = auditReport(content(), { filter: 'gcse-maths-h-a17' });
  assert.deepEqual(
    byTopic.map((r) => r.id).sort(),
    ['gcse-maths-h-a17', 'gcse-maths-h-a17-0001', 'gcse-maths-h-a17-0002'].sort(),
  );
  const byBranch = auditReport(content(), { filter: 'gcse-maths-h-algebra' });
  assert.ok(byBranch.some((r) => r.id === 'gcse-maths-h-a17-0002'));
  const bySubject = auditReport(content(), { filter: 'gcse-maths' });
  assert.equal(bySubject.length, auditReport(content()).length);
  assert.deepEqual(auditReport(content(), { filter: 'nothing-here' }), []);
});

test('an item may name facts for the exact checkers, and verified ones need those checks', async () => {
  const item = {
    ...numericItem,
    answer: { value: '90', unit: 'cm^2' },
    exact: { quantity: 'area' },
    citations: [quotedCitation()],
    verification: verified({ maths: true }),
  };
  assert.match(messages(await check([item])), /verified content needs a passing units check/);
  const withUnits = verified({ maths: true });
  withUnits.checks.push({ ...withUnits.checks[0], name: 'units', tool: 'revisionden-exact' });
  assert.deepEqual(await check([{ ...item, verification: withUnits }]), []);
});

test('chemical equation and equation sheet facts need their exact checks when verified', async () => {
  const item = {
    ...numericItem,
    exact: {
      chemical_equation: '2H2 + O2 -> 2H2O',
      equation_sheet: { sheet: 'fixture-sheet', equation: 'fixture-eq' },
    },
    citations: [quotedCitation()],
    verification: verified({ maths: true }),
  };
  const errors = messages(await check([item]));
  assert.match(errors, /needs a passing chemical-equation check/);
  assert.match(errors, /needs a passing equation-sheet check/);
});

test('an unknown exact fact is a schema error', async () => {
  const item = { ...numericItem, exact: { colour: 'blue' } };
  assert.match(messages(await check([item])), /must NOT have additional properties colour/);
});

// Extended answers (docs/VERIFICATION.md section 3): blind marking of three exemplars replaces
// the blind answer, and every one needs individual human approval.
const levelScheme = {
  id: 'ms-fixture-levels',
  type: 'levels',
  source_ref: 'Fixture',
  levels: [
    { level: 1, marks: [1, 2], descriptor: 'Fixture low descriptor' },
    { level: 2, marks: [3, 4], descriptor: 'Fixture middle descriptor' },
    { level: 3, marks: [5, 6], descriptor: 'Fixture top descriptor' },
  ],
  citations: [quotedCitation({ supports: ['mark_scheme'] })],
  verification: draft(),
};
const exemplars = [
  { band: 'top', level: 3, answer: 'Fixture top answer.' },
  { band: 'middle', level: 2, answer: 'Fixture middle answer.' },
  { band: 'low', level: 1, answer: 'Fixture low answer.' },
];
function verifiedEssay(checksFilter = () => true, extra = {}) {
  const v = verified();
  v.checks = v.checks.filter((c) => c.name !== 'blind-answer').filter(checksFilter);
  v.checks.push({ ...v.checks[0], name: 'blind-marking', tool: 'openai:fixture' });
  return {
    id: 'gcse-maths-h-a17-0009',
    topic: 'gcse-maths-h-a17',
    type: 'extended_answer',
    difficulty: 4,
    prompt: 'Fixture essay question',
    marks: 6,
    mark_scheme_ref: 'ms-fixture-levels',
    exemplars,
    source_ref: 'Fixture',
    checked_by: ['model-b', 'human'],
    citations: [quotedCitation()],
    verification: v,
    ...extra,
  };
}
const withScheme = { markSchemes: [at('mark-schemes/ms.json', levelScheme)] };

test('a verified extended answer needs blind marking, not a blind answer', async () => {
  assert.deepEqual(await check([verifiedEssay()], withScheme), []);
  const noMarking = verifiedEssay((c) => c.name !== 'blind-marking');
  noMarking.verification.checks = noMarking.verification.checks.filter(
    (c) => c.name !== 'blind-marking',
  );
  assert.match(
    messages(await check([noMarking], withScheme)),
    /verified content needs a passing blind-marking check/,
  );
});

test('a verified extended answer cannot be released by batch sampling', async () => {
  const essay = verifiedEssay((c) => c.name !== 'human-approval');
  essay.verification.checks.push({ ...essay.verification.checks[0], name: 'batch-sample' });
  assert.match(
    messages(await check([essay], withScheme)),
    /extended answers need a passing human-approval check/,
  );
});

test('a verified extended answer needs a top, middle and low exemplar', async () => {
  const two = verifiedEssay(() => true, { exemplars: exemplars.slice(0, 2) });
  assert.match(
    messages(await check([two], withScheme)),
    /verified extended answers need exemplars for the top, middle and low bands/,
  );
});

test('an exemplar level must be one of the mark scheme levels', async () => {
  const bad = verifiedEssay(() => true, {
    exemplars: [...exemplars.slice(0, 2), { band: 'low', level: 7, answer: 'Fixture.' }],
  });
  assert.match(
    messages(await check([bad], withScheme)),
    /exemplar level 7 is not in ms-fixture-levels/,
  );
});

test('exemplars belong only to extended answers', async () => {
  const mc = { ...numericItem, exemplars };
  assert.match(messages(await check([mc])), /must NOT have unevaluated properties|exemplars/);
});

// Answer format: rounded answers and answers that state their subject (S3-A rulings).
const roundedItem = (answer, prompt = 'Work out 1/3. Give your answer to 2 decimal places.') => ({
  ...numericItem,
  prompt,
  answer,
});
const validateItems = (...list) =>
  validateContent(content({ items: list.map((i) => at('items/a.json', i)) }), {
    checkMaths: fakeEngine(),
  });

test('a numeric answer may ask for decimal places or significant figures, not both', async () => {
  assert.deepEqual(await validateItems(roundedItem({ value: '0.33', decimal_places: 2 })), []);
  const both = roundedItem({ value: '0.33', decimal_places: 2, significant_figures: 2 });
  assert.notDeepEqual(await validateItems(both), []);
});

test('rounding replaces a tolerance, so a rounded answer cannot also have one', async () => {
  const errors = await validateItems(
    roundedItem({ value: '0.33', decimal_places: 2, tolerance: 0.005 }),
  );
  assert.notDeepEqual(errors, []);
});

test('a rounded answer value must itself be written to the asked accuracy', async () => {
  const errors = await validateItems(roundedItem({ value: '0.333', decimal_places: 2 }));
  assert.match(messages(errors), /answer\.value 0\.333 is not written to 2 decimal places/);
  const sf = roundedItem(
    { value: '0.33', significant_figures: 3 },
    'Work out 1/3. Give your answer to 3 significant figures.',
  );
  assert.match(messages(await validateItems(sf)), /is not written to 3 significant figures/);
});

test('a question that asks for rounding must say how in the answer, and the other way round', async () => {
  const unsaid = await validateItems(roundedItem({ value: '0.33', tolerance: 0.005 }));
  assert.match(
    messages(unsaid),
    /asks for rounding: set answer\.decimal_places or answer\.significant_figures/,
  );
  const silent = roundedItem({ value: '0.33', decimal_places: 2 }, 'Work out 1/3.');
  assert.match(messages(await validateItems(silent)), /does not say what to round to/);
});

test('only a question that asks for the answer to be rounded needs answer rounding', async () => {
  const asks = /asks for rounding: set answer\.decimal_places/;
  for (const prompt of [
    'Round 7.8463 to 2 decimal places.',
    'Work out x. Give the positive solution correct to 2 decimal places.',
    'Work out the area. Write your answer to 3 significant figures.',
    'Work out the mean. Give your answer to the nearest whole number.',
    'Work out the speed. Your answer should be to 1 d.p.',
  ]) {
    assert.match(
      messages(await validateItems(roundedItem({ value: '0.33' }, prompt))),
      asks,
      prompt,
    );
  }
  for (const prompt of [
    'By rounding each number to 1 significant figure, estimate the value of 4.87 × 31.2',
    'A mass is 4.6 kg, correct to 1 decimal place. Write down the lower bound of the mass.',
    'A number is truncated to 1 decimal place. The result is 5.7. Work out the error.',
  ]) {
    assert.deepEqual(await validateItems(roundedItem({ value: '0.33' }, prompt)), [], prompt);
  }
});

test('a question that asks for an answer form needs answer.form, and the other way round', async () => {
  const item = (answer, prompt) => roundedItem(answer, prompt);
  const needs = async (prompt, form, value = '3/8') => {
    assert.match(
      messages(await validateItems(item({ value }, prompt))),
      new RegExp(`set answer\\.form to "${form}"`),
      prompt,
    );
    assert.deepEqual(await validateItems(item({ value, form }, prompt)), [], prompt);
  };
  await needs('Write 0.375 as a fraction in its simplest form.', 'simplest_fraction');
  await needs('Write 6/16 in its lowest terms.', 'simplest_fraction');
  await needs(
    'Write 0.272727... (the digits 27 recur) as a fraction in its simplest form.',
    'simplest_fraction',
    '3/11',
  );
  await needs('Work out 2/3 of 4/5. Give your answer as a fraction.', 'fraction', '8/15');
  await needs('Write 2.45 as an improper fraction.', 'improper_fraction', '49/20');
  await needs(
    'Write 2.45 as an improper fraction in its simplest form.',
    'improper_fraction',
    '49/20',
  );
  await needs(
    'Work out 6 × 10^8 + 4 × 10^7. Give your answer in standard form.',
    'standard_form',
    '6.4*10^8',
  );
  await needs('Write 360 in index form.', 'index_form', '2^3 × 3^2 × 5');
  // Describing the working or the question, not the answer's form.
  for (const prompt of [
    '0.00045 is written in standard form as A × 10^n. Find the value of n.',
    'Work out 3.5 + 1.25.',
  ]) {
    assert.deepEqual(await validateItems(item({ value: '-4' }, prompt)), [], prompt);
  }
  assert.match(
    messages(await validateItems(item({ value: '3/8', form: 'fraction' }, 'Work out 0.375.'))),
    /answer\.form is fraction but the question does not ask for it/,
  );
  assert.match(
    messages(
      await validateItems(
        item(
          { value: '6/16', form: 'simplest_fraction' },
          'Write 0.375 as a fraction in its simplest form.',
        ),
      ),
    ),
    /answer\.value 6\/16 is not written as a simplest_fraction/,
  );
  assert.match(
    messages(
      await validateItems(
        item({ value: '3/8', form: 'fraction' }, 'Write 0.375 as a fraction in its simplest form.'),
      ),
    ),
    /set answer\.form to "simplest_fraction"/,
  );
  assert.match(
    messages(
      await validateItems(
        item({ value: '0.375', form: 'fraction', decimal_places: 3 }, 'Write 0.375 as a fraction.'),
      ),
    ),
    /a fraction answer cannot also set tolerance or rounding/,
  );
});

test('the answer form is sent to the maths engine, and a worked answer is checked against it', async () => {
  const numeric = { ...numericItem, answer: { value: '3/8', form: 'simplest_fraction' } };
  const worked = {
    ...solveItem,
    answer: { expression: '49/12', form: 'improper_fraction' },
    verify: { method: 'expression', expression: '(2 + 1/3) + (1 + 3/4)' },
    steps: ['7/3 + 7/4', '49/12'],
  };
  const solved = { ...solveItem, answer: { solutions: ['5/11'], form: 'simplest_fraction' } };
  const checks = mathsChecks([numeric, worked, solved]);
  assert.equal(checks[0].form, 'simplest_fraction');
  assert.equal(checks[1].form, 'improper_fraction');
  assert.equal(checks[2].expected.form, 'improper_fraction');
  assert.equal(checks[3].form, 'simplest_fraction');
  const both = { ...worked, verify: { ...worked.verify, form: 'expanded' } };
  assert.match(
    messages(await validateItems(both)),
    /set either answer\.form or verify\.form, not both/,
  );
  const unsimplified = { ...worked, answer: { expression: '98/24', form: 'improper_fraction' } };
  assert.match(
    messages(await validateItems(unsimplified)),
    /answer\.expression 98\/24 is not written as a improper_fraction/,
  );
  const badSolution = { ...solved, answer: { solutions: ['10/22'], form: 'simplest_fraction' } };
  assert.match(
    messages(await validateItems(badSolution)),
    /solution 10\/22 is not written as a simplest_fraction/,
  );
});

test('rounding and the declared subject are sent to the maths engine', () => {
  const rounded = { ...numericItem, answer: { value: '28.3', significant_figures: 3 } };
  const rearrange = {
    ...solveItem,
    answer: { expression: '(v - u)/a', subject: 't' },
    verify: { method: 'expression', expression: '(v - u)/a' },
    steps: ['a t = v - u', 't = (v - u)/a'],
  };
  const checks = mathsChecks([rounded, rearrange]);
  assert.equal(checks[0].significant_figures, 3);
  assert.equal(checks[1].subject, 't');
  assert.deepEqual(checks[2].expected, { expression: '(v - u)/a', subject: 't' });
});

test('a standard form answer is sent to the maths engine as a plain number', () => {
  const standard = { ...numericItem, answer: { value: '6.4 × 10⁸', significant_figures: 2 } };
  const [check] = mathsChecks([standard]);
  assert.equal(check.answer, '640000000');
  assert.equal(check.significant_figures, 2);
  // With form standard_form the engine checks the form too, so it gets the engine's notation.
  const asked = { ...numericItem, answer: { value: '6.4 × 10⁸', form: 'standard_form' } };
  assert.equal(mathsChecks([asked])[0].answer, '6.4*10^8');
  const negative = { ...numericItem, answer: { value: '−3.2 × 10^(−4)', form: 'standard_form' } };
  assert.equal(mathsChecks([negative])[0].answer, '-3.2*10^-4');
});

test('a fact proof must name a maths engine check kind the engine knows', async () => {
  const withProof = (kind) => ({
    ...numericItem,
    facts: [
      {
        statement: 'Fixture fact.',
        ask: 'Fixture question about the fact?',
        engine: { kind, graph: 'f(x - a)', image: '(x + a, y)' },
      },
    ],
  });
  const ok = await validateContent(
    content({ items: [at('items/a.json', withProof('transformation'))] }),
    {
      checkMaths: fakeEngine(),
    },
  );
  assert.deepEqual(ok, []);
  const typo = await validateContent(
    content({ items: [at('items/a.json', withProof('transform'))] }),
    {
      checkMaths: fakeEngine(),
    },
  );
  assert.notDeepEqual(typo, []);
});

test('control characters anywhere in content are refused, with where they are (Postgres 22P05)', async () => {
  const withNul = {
    ...numericItem,
    verification: {
      ...numericItem.verification,
      checks: [
        {
          name: 'schema',
          result: 'pass',
          tool: 't',
          tool_version: '1',
          at: '2026-11-25T00:00:00Z',
          notes: 'bad\u0000note',
        },
      ],
    },
  };
  const tab = { ...solveItem, prompt: 'Line one\nline two\twith a tab.' };
  const errors = await validateContent(
    content({ items: [at('items/a.json', withNul), at('items/a.json', tab)] }),
    { checkMaths: fakeEngine() },
  );
  assert.deepEqual(
    errors.map((e) => [e.id, e.message]),
    [[numericItem.id, 'control character U+0000 in verification.checks[0].notes']],
  );
});

test('a vertical tab or carriage return is refused too; only tab and newline are allowed', async () => {
  const vt = { ...numericItem, prompt: 'Work out\u000b 3/4 of 120.\r' };
  const errors = await validateContent(content({ items: [at('items/a.json', vt)] }), {
    checkMaths: fakeEngine(),
  });
  assert.match(messages(errors), /control character U\+000B in prompt/);
  assert.match(messages(errors), /control character U\+000D in prompt/);
});
