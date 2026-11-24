import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EXACT_TOOL, run, runExactChecks, sheetErrors } from './exact-check.mjs';
import { draftItem } from '../test-content.mjs';

const AT = () => new Date('2026-11-24T12:00:00Z');
const sheet = {
  id: 'fixture-sheet',
  title: 'Fixture equation sheet',
  citations: [{ fixture: true }],
  verification: { status: 'verified', version: 1, checks: [] },
  equations: [
    { id: 'fixture-force', equation: 'F = m a', symbols: { F: 'N', m: 'kg', a: 'm/s^2' } },
  ],
};
const numeric = (exact, unit = 'cm^2') =>
  draftItem('fixture-num', undefined, {
    type: 'numeric',
    answer: { value: '4', unit },
    verify: { expression: '4' },
    exact,
  });

test('runs one check for each fact in the exact block, recording the tool', () => {
  const item = numeric({
    quantity: 'area',
    chemical_equation: '2H2 + O2 -> 2H2O',
    equation_sheet: { sheet: 'fixture-sheet', equation: 'fixture-force' },
  });
  const checks = runExactChecks(item, { sheets: [sheet], now: AT });
  assert.deepEqual(
    checks.map((c) => [c.name, c.result]),
    [
      ['units', 'pass'],
      ['chemical-equation', 'pass'],
      ['equation-sheet', 'pass'],
    ],
  );
  assert.deepEqual(checks[0], {
    name: 'units',
    result: 'pass',
    tool: EXACT_TOOL.name,
    tool_version: EXACT_TOOL.version,
    at: '2026-11-24T12:00:00Z',
    notes: 'cm^2 is a unit of area',
  });
});

test('a wrong unit, an unbalanced equation or a missing sheet equation fails', () => {
  const item = numeric(
    {
      quantity: 'area',
      chemical_equation: 'H2 + O2 -> H2O',
      equation_sheet: { sheet: 'fixture-sheet', equation: 'missing' },
    },
    'cm',
  );
  const checks = runExactChecks(item, { sheets: [sheet], now: AT });
  assert.deepEqual(
    checks.map((c) => c.result),
    ['fail', 'fail', 'fail'],
  );
  assert.match(checks[0].notes, /cm is a length unit, not area/);
  assert.match(checks[1].notes, /not balanced/);
  assert.match(checks[2].notes, /no equation missing/);
});

test('a quantity without an answer unit fails', () => {
  const item = numeric({ quantity: 'area' }, undefined);
  delete item.answer.unit;
  const [check] = runExactChecks(item, { sheets: [], now: AT });
  assert.equal(check.result, 'fail');
  assert.match(check.notes, /has exact.quantity but no answer.unit/);
});

test('an item with no exact block has no exact checks', () => {
  assert.deepEqual(runExactChecks(draftItem('x'), { sheets: [], now: AT }), []);
});

test('equation sheets must have an id, citations, a record and equations', () => {
  assert.deepEqual(sheetErrors(sheet), []);
  const errors = sheetErrors({ id: 'bad', equations: [] });
  assert.match(errors.join('\n'), /citations/);
  assert.match(errors.join('\n'), /verification/);
});

async function contentDir(items, sheets = []) {
  const root = await mkdtemp(join(tmpdir(), 'rd-exact-'));
  await mkdir(join(root, 'items'), { recursive: true });
  await mkdir(join(root, 'equation-sheets'), { recursive: true });
  await writeFile(join(root, 'items/f.json'), JSON.stringify(items));
  for (const s of sheets)
    await writeFile(join(root, `equation-sheets/${s.id}.json`), JSON.stringify(s));
  return root;
}
const io = () => {
  const lines = [];
  return { lines, out: (s) => lines.push(s), err: (s) => lines.push(s) };
};

test('the command checks sheets and items, and exits 1 on any failure', async () => {
  const badSheet = {
    ...sheet,
    id: 'fixture-bad-sheet',
    equations: [{ id: 'bad', equation: 'F = m', symbols: { F: 'N', m: 'kg' } }],
  };
  const root = await contentDir([numeric({ quantity: 'area' })], [sheet, badSheet]);
  const out = io();
  assert.equal(await run(['--content', root], { ...out, now: AT }), 1);
  const text = out.lines.join('\n');
  assert.match(text, /pass {2}fixture-num {2}units/);
  assert.match(
    text,
    /FAIL {2}sheet fixture-bad-sheet {2}bad: F = m: the two sides have different units/,
  );
});

test('the command exits 0 when everything passes and --write records the checks', async () => {
  const root = await contentDir([numeric({ quantity: 'area' })], [sheet]);
  assert.equal(await run(['--content', root, '--write'], { ...io(), now: AT }), 0);
  const [saved] = JSON.parse(await readFile(join(root, 'items/f.json'), 'utf8'));
  assert.deepEqual(
    saved.verification.checks.map((c) => c.name),
    ['units'],
  );
});

test('an unknown option is a usage error', async () => {
  assert.equal(await run(['--nope'], io()), 2);
});
