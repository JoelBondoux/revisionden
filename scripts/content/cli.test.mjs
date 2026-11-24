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
  assert.match(out.lines.join('\n'), /Content valid: 1 subjects, 1 topic trees, 2 items/);
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
