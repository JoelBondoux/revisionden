import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkItemEquation,
  checkSheet,
  dimensionsOf,
  evaluate,
  parseExpression,
} from './equation-sheet.mjs';

// A synthetic sheet for tests. Real sheets come from the sourcing session, with citations.
const sheet = {
  id: 'fixture-equation-sheet',
  title: 'Fixture equation sheet',
  citations: [{ fixture: true }],
  verification: { status: 'verified', version: 1, checks: [] },
  equations: [
    {
      id: 'fixture-kinetic',
      equation: 'E_k = 1/2 m v^2',
      symbols: { E_k: 'J', m: 'kg', v: 'm/s' },
    },
    { id: 'fixture-force', equation: 'F = m a', symbols: { F: 'N', m: 'kg', a: 'm/s^2' } },
    {
      id: 'fixture-suvat',
      equation: 'v^2 - u^2 = 2 a s',
      symbols: { v: 'm/s', u: 'm/s', a: 'm/s^2', s: 'm' },
    },
    {
      id: 'fixture-period',
      equation: 'T = 2 \u03c0 sqrt(l / g)',
      symbols: { T: 's', l: 'm', g: 'm/s^2' },
    },
    {
      id: 'fixture-heat',
      equation: '\u0394E = m c \u0394\u03b8',
      symbols: { '\u0394E': 'J', m: 'kg', c: 'J/(kg K)', '\u0394\u03b8': 'K' },
    },
  ],
};

test('parses an equation and evaluates it', () => {
  const ast = parseExpression('1/2 m v^2');
  assert.equal(evaluate(ast, { m: 2, v: 3 }), 9);
  assert.equal(evaluate(parseExpression('2(a + b)'), { a: 1, b: 2 }), 6);
  assert.equal(evaluate(parseExpression('sqrt(16) * x'), { x: 2 }), 8);
  assert.ok(Math.abs(evaluate(parseExpression('2\u03c0'), {}) - 2 * Math.PI) < 1e-12);
  assert.equal(evaluate(parseExpression('-x^2'), { x: 3 }), -9);
});

test('works out the dimension of an expression from the units of its symbols', () => {
  const dims = dimensionsOf(parseExpression('1/2 m v^2'), { m: 'kg', v: 'm/s' });
  assert.deepEqual(dims, [2, 1, -2, 0, 0, 0, 0, 0]);
});

test('a dimensionally consistent sheet passes', () => {
  assert.deepEqual(checkSheet(sheet), []);
});

test('an equation whose sides have different dimensions fails', () => {
  const bad = {
    ...sheet,
    equations: [{ id: 'bad', equation: 'E_k = m v', symbols: { E_k: 'J', m: 'kg', v: 'm/s' } }],
  };
  const [problem] = checkSheet(bad);
  assert.equal(problem.equation, 'bad');
  assert.match(problem.error, /the two sides have different units/);
});

test('adding quantities with different dimensions fails', () => {
  const bad = {
    ...sheet,
    equations: [{ id: 'bad', equation: 's = u + a', symbols: { s: 'm', u: 'm', a: 'm/s^2' } }],
  };
  assert.match(checkSheet(bad)[0].error, /cannot add or subtract/);
});

test('a symbol with no unit fails', () => {
  const bad = {
    ...sheet,
    equations: [{ id: 'bad', equation: 'F = m a', symbols: { F: 'N', m: 'kg' } }],
  };
  assert.match(checkSheet(bad)[0].error, /symbol a has no unit/);
});

test('an equation that cannot be parsed fails', () => {
  const bad = { ...sheet, equations: [{ id: 'bad', equation: 'F = = m', symbols: {} }] };
  assert.match(checkSheet(bad)[0].error, /cannot read/);
});

test('an item that names a sheet equation passes when the equation exists', () => {
  const item = {
    id: 'i',
    exact: { equation_sheet: { sheet: 'fixture-equation-sheet', equation: 'fixture-force' } },
  };
  assert.deepEqual(checkItemEquation(item, [sheet]), { ok: true });
});

test('the equation as the item writes it must match the sheet, in any equivalent form', () => {
  const ref = (as_written) => ({
    id: 'i',
    exact: {
      equation_sheet: { sheet: 'fixture-equation-sheet', equation: 'fixture-kinetic', as_written },
    },
  });
  assert.deepEqual(checkItemEquation(ref('E_k = 0.5 * m * v^2'), [sheet]), { ok: true });
  assert.deepEqual(checkItemEquation(ref('E_k = 1/2 v^2 m'), [sheet]), { ok: true });
  const wrong = checkItemEquation(ref('E_k = m v^2'), [sheet]);
  assert.equal(wrong.ok, false);
  assert.match(wrong.error, /does not match fixture-kinetic on the sheet/);
});

test('an item that names a missing sheet or equation fails', () => {
  const missingSheet = { id: 'i', exact: { equation_sheet: { sheet: 'nope', equation: 'x' } } };
  assert.match(
    checkItemEquation(missingSheet, [sheet]).error,
    /equation sheet nope does not exist/,
  );
  const missingEq = {
    id: 'i',
    exact: { equation_sheet: { sheet: 'fixture-equation-sheet', equation: 'nope' } },
  };
  assert.match(
    checkItemEquation(missingEq, [sheet]).error,
    /no equation nope on fixture-equation-sheet/,
  );
});

test('an item cannot rely on a sheet that is not verified yet', () => {
  const draft = { ...sheet, verification: { status: 'draft', version: 1, checks: [] } };
  const item = {
    id: 'i',
    exact: { equation_sheet: { sheet: 'fixture-equation-sheet', equation: 'fixture-force' } },
  };
  assert.match(
    checkItemEquation(item, [draft]).error,
    /fixture-equation-sheet is not verified yet/,
  );
});
