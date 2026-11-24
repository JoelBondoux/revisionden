import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from './cli.mjs';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

function capture() {
  const lines = [];
  return { lines, log: (line) => lines.push(line) };
}

const okEngine = async (checks) => checks.map((c) => ({ id: c.id, ok: true }));

test('valid content exits 0 and says how much was checked', async () => {
  const out = capture();
  const code = await run(['--content', join(FIXTURES, 'valid')], {
    out: out.log,
    err: out.log,
    createChecker: () => okEngine,
  });
  assert.equal(code, 0);
  assert.match(
    out.lines.join('\n'),
    /Content valid: 1 subjects, 1 topic trees, 2 items, 1 mark schemes, 0 diagrams/,
  );
});

test('invalid content exits 1 and lists each problem', async () => {
  const out = capture();
  const code = await run(['--content', join(FIXTURES, 'not-array')], {
    out: out.log,
    err: out.log,
    createChecker: () => okEngine,
  });
  assert.equal(code, 1);
  assert.match(out.lines.join('\n'), /items\/single\.json: must contain a JSON array/);
});

test('--no-maths skips the engine and warns', async () => {
  const out = capture();
  let created = false;
  const code = await run(['--content', join(FIXTURES, 'valid'), '--no-maths'], {
    out: out.log,
    err: out.log,
    createChecker: () => {
      created = true;
      return okEngine;
    },
  });
  assert.equal(code, 0);
  assert.equal(created, false);
  assert.match(out.lines.join('\n'), /maths answers were NOT checked/);
});

test('an engine failure exits 2 with the reason', async () => {
  const out = capture();
  const code = await run(['--content', join(FIXTURES, 'valid')], {
    out: out.log,
    err: out.log,
    createChecker: () => async () => {
      throw new Error('could not run the maths engine');
    },
  });
  assert.equal(code, 2);
  assert.match(out.lines.join('\n'), /could not run the maths engine/);
});

test('an unknown option exits 2', async () => {
  const out = capture();
  assert.equal(await run(['--frobnicate'], { out: out.log, err: out.log }), 2);
});

test('a draft without quotes passes but is counted as needing sourcing', async () => {
  const out = capture();
  const code = await run(['--content', join(FIXTURES, 'valid')], {
    out: out.log,
    err: out.log,
    createChecker: () => okEngine,
  });
  assert.equal(code, 0);
  assert.match(out.lines.join('\n'), /6 of 6 entries still need sourcing \(quotes\)/);
  assert.match(
    out.lines.join('\n'),
    /needs sourcing: item fixture-a17-0001 \(items\/sample\.json\)/,
  );
  assert.match(out.lines.join('\n'), /needs sourcing: topic fixture-a6 /);
});

test('--report prints the audit report as JSON', async () => {
  const out = capture();
  const code = await run(['--content', join(FIXTURES, 'valid'), '--report', '--no-maths'], {
    out: out.log,
    err: () => {},
    createChecker: () => okEngine,
  });
  assert.equal(code, 0);
  const report = JSON.parse(out.lines.join('\n'));
  assert.ok(report.some((r) => r.id === 'fixture-a17-0001' && r.kind === 'item'));
});

test('--baseline compares against earlier content and catches edits to verified items', async () => {
  const out = capture();
  const code = await run(
    ['--content', join(FIXTURES, 'verified-edited'), '--baseline', join(FIXTURES, 'verified')],
    { out: out.log, err: out.log, createChecker: () => okEngine },
  );
  assert.equal(code, 1);
  assert.match(out.lines.join('\n'), /verified version 1 was changed/);
});

test('--baseline with an unchanged copy passes', async () => {
  const out = capture();
  const code = await run(
    ['--content', join(FIXTURES, 'verified'), '--baseline', join(FIXTURES, 'verified')],
    { out: out.log, err: out.log, createChecker: () => okEngine },
  );
  assert.equal(code, 0, out.lines.join('\n'));
});

test('--audit prints the detailed report for one id', async () => {
  const out = capture();
  const code = await run(['--content', join(FIXTURES, 'verified'), '--audit', 'fixture-a17-0001'], {
    out: out.log,
    err: () => {},
    createChecker: () => okEngine,
  });
  assert.equal(code, 0);
  const [row] = JSON.parse(out.lines.join('\n'));
  assert.equal(row.id, 'fixture-a17-0001');
  assert.equal(row.detail.verification.status, 'verified');
});

test('--audit for an unknown id exits 1', async () => {
  const out = capture();
  const code = await run(['--content', join(FIXTURES, 'valid'), '--audit', 'nope'], {
    out: out.log,
    err: out.log,
  });
  assert.equal(code, 1);
  assert.match(out.lines.join('\n'), /Nothing found for nope/);
});
