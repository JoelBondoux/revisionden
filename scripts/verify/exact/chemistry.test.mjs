import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkEquation, parseFormula, parseEquation } from './chemistry.mjs';

test('counts the atoms in a formula, including brackets and hydrates', () => {
  assert.deepEqual(parseFormula('H2O').atoms, { H: 2, O: 1 });
  assert.deepEqual(parseFormula('Ca(OH)2').atoms, { Ca: 1, O: 2, H: 2 });
  assert.deepEqual(parseFormula('Al2(SO4)3').atoms, { Al: 2, S: 3, O: 12 });
  assert.deepEqual(parseFormula('CuSO4\u00b75H2O').atoms, { Cu: 1, S: 1, O: 9, H: 10 });
  assert.deepEqual(parseFormula('CuSO4.5H2O').atoms, { Cu: 1, S: 1, O: 9, H: 10 });
  assert.deepEqual(parseFormula('[Cu(H2O)6]2+').atoms, { Cu: 1, H: 12, O: 6 });
});

test('reads charges written in the usual ways', () => {
  assert.equal(parseFormula('Fe3+').charge, 3);
  assert.equal(parseFormula('SO4^2-').charge, -2);
  assert.equal(parseFormula('SO4 2-').charge, -2);
  assert.equal(parseFormula('OH-').charge, -1);
  assert.equal(parseFormula('Na+').charge, 1);
  assert.equal(parseFormula('Cu\u00b2\u207a').charge, 2);
  assert.equal(parseFormula('e-').charge, -1);
  assert.deepEqual(parseFormula('e-').atoms, {});
});

test('ignores state symbols', () => {
  assert.deepEqual(parseFormula('NaCl(aq)').atoms, { Na: 1, Cl: 1 });
  assert.deepEqual(parseFormula('H2O(l)').atoms, { H: 2, O: 1 });
  assert.deepEqual(parseFormula('CO2 (g)').atoms, { C: 1, O: 2 });
});

test('rejects symbols that are not elements', () => {
  assert.throws(() => parseFormula('Xy2'), /Xy is not an element/);
  assert.throws(() => parseFormula('H2O)'), /unbalanced brackets/);
  assert.throws(() => parseFormula(''), /empty formula/);
});

test('reads coefficients and every kind of arrow', () => {
  const eq = parseEquation('2H2 + O2 -> 2H2O');
  assert.deepEqual(
    eq.left.map((s) => s.coefficient),
    [2, 1],
  );
  assert.deepEqual(
    eq.right.map((s) => s.coefficient),
    [2],
  );
  for (const arrow of ['->', '\u2192', '\u21cc', '=', '<=>', '\u27f6']) {
    assert.equal(parseEquation(`H2 + Cl2 ${arrow} 2HCl`).right[0].coefficient, 2, arrow);
  }
  assert.throws(() => parseEquation('H2 + O2'), /needs one arrow/);
});

test('a balanced equation passes', () => {
  assert.deepEqual(checkEquation('2H2 + O2 -> 2H2O'), { ok: true });
  assert.deepEqual(checkEquation('CH4 + 2O2 \u2192 CO2 + 2H2O'), { ok: true });
  assert.deepEqual(checkEquation('Ca(OH)2(aq) + 2HCl(aq) -> CaCl2(aq) + 2H2O(l)'), { ok: true });
  assert.deepEqual(checkEquation('N2 + 3H2 \u21cc 2NH3'), { ok: true });
});

test('an equation with atoms out of balance fails and says which', () => {
  const r = checkEquation('H2 + O2 -> H2O');
  assert.equal(r.ok, false);
  assert.match(r.error, /O: 2 on the left, 1 on the right/);
});

test('ionic and half equations must balance charge too', () => {
  assert.deepEqual(checkEquation('Fe3+ + e- -> Fe2+'), { ok: true });
  assert.deepEqual(checkEquation('Cu2+ + 2e- -> Cu'), { ok: true });
  assert.deepEqual(checkEquation('Ag+ + Cl- -> AgCl'), { ok: true });
  const r = checkEquation('Cu2+ + e- -> Cu');
  assert.equal(r.ok, false);
  assert.match(r.error, /charge: 1 on the left, 0 on the right/);
});

test('coefficients must be in their lowest terms', () => {
  const r = checkEquation('4H2 + 2O2 -> 4H2O');
  assert.equal(r.ok, false);
  assert.match(r.error, /not in lowest terms \(divide by 2\)/);
});

test('fractional coefficients are allowed only when asked for', () => {
  assert.equal(checkEquation('H2 + 1/2O2 -> H2O').ok, false);
  assert.deepEqual(checkEquation('H2 + 1/2O2 -> H2O', { allowFractions: true }), { ok: true });
});

test('an equation that does not parse is a failure, not a pass', () => {
  const r = checkEquation('H2 + Qq -> H2Qq');
  assert.equal(r.ok, false);
  assert.match(r.error, /Qq is not an element/);
});

test('a polyatomic ion keeps its last digit (NH4+ is ammonium with charge 1)', () => {
  assert.deepEqual(parseFormula('NH4+'), { atoms: { N: 1, H: 4 }, charge: 1 });
  assert.deepEqual(checkEquation('NH3 + H+ -> NH4+'), { ok: true });
});
