import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkUnit, convert, dimensionOf, parseUnit, QUANTITIES, sameDimension } from './units.mjs';

test('reads base and derived SI units', () => {
  assert.deepEqual(parseUnit('m').dims, dimensionOf('length'));
  assert.deepEqual(parseUnit('N').dims, parseUnit('kg m s^-2').dims);
  assert.deepEqual(parseUnit('J').dims, parseUnit('N m').dims);
  assert.deepEqual(parseUnit('W').dims, parseUnit('J/s').dims);
  assert.deepEqual(parseUnit('Pa').dims, parseUnit('N/m^2').dims);
  assert.deepEqual(parseUnit('V').dims, parseUnit('W/A').dims);
  assert.deepEqual(parseUnit('ohm').dims, parseUnit('V/A').dims);
  assert.deepEqual(parseUnit('\u03a9').dims, parseUnit('V/A').dims);
});

test('reads prefixes, and tells metres from milli', () => {
  assert.equal(parseUnit('km').factor, 1000);
  assert.equal(parseUnit('mm').factor, 0.001);
  assert.equal(parseUnit('m').factor, 1);
  assert.equal(parseUnit('g').factor, 0.001);
  assert.ok(Math.abs(parseUnit('\u00b5s').factor - 1e-6) < 1e-18);
  assert.ok(Math.abs(parseUnit('us').factor - 1e-6) < 1e-18);
  assert.equal(parseUnit('MJ').factor, 1e6);
});

test('reads the ways powers are written', () => {
  for (const u of ['cm^2', 'cm2', 'cm\u00b2'])
    assert.deepEqual(parseUnit(u).dims, dimensionOf('area'));
  for (const u of ['m/s', 'm s^-1', 'm s-1', 'm s\u207b\u00b9', 'm\u00b7s^-1', 'm*s^-1']) {
    assert.deepEqual(parseUnit(u).dims, dimensionOf('speed'), u);
  }
  assert.deepEqual(parseUnit('m/s^2').dims, dimensionOf('acceleration'));
  assert.deepEqual(parseUnit('kg/m^3').dims, dimensionOf('density'));
  assert.ok(Math.abs(parseUnit('cm^3').factor - 1e-6) < 1e-18);
});

test('reads everyday units used in GCSE questions', () => {
  assert.deepEqual(parseUnit('£').dims, dimensionOf('money'));
  assert.deepEqual(parseUnit('p').dims, dimensionOf('money'));
  assert.equal(parseUnit('p').factor, 0.01);
  assert.equal(parseUnit('%').factor, 0.01);
  assert.equal(parseUnit('h').factor, 3600);
  assert.equal(parseUnit('min').factor, 60);
  assert.deepEqual(parseUnit('km/h').dims, dimensionOf('speed'));
  assert.deepEqual(parseUnit('l').dims, dimensionOf('volume'));
  assert.deepEqual(parseUnit('mol/dm^3').dims, dimensionOf('concentration'));
  assert.deepEqual(parseUnit('\u00b0C').dims, dimensionOf('temperature'));
  assert.deepEqual(parseUnit('kWh').dims, dimensionOf('energy'));
});

test('rejects units it does not know instead of guessing', () => {
  assert.throws(() => parseUnit('furlong'), /unknown unit "furlong"/);
  assert.throws(() => parseUnit('m^x'), /unknown unit/);
  assert.throws(() => parseUnit(''), /empty unit/);
});

test('compares dimensions', () => {
  assert.equal(sameDimension('J', 'kg m^2 s^-2'), true);
  assert.equal(sameDimension('J', 'W'), false);
});

test('converts between units of the same dimension', () => {
  assert.equal(convert(2.5, 'km', 'm'), 2500);
  assert.ok(Math.abs(convert(36, 'km/h', 'm/s') - 10) < 1e-12);
  assert.throws(() => convert(1, 'kg', 'm'), /cannot convert kg to m/);
  assert.throws(() => convert(20, '\u00b0C', 'K'), /temperatures with an offset/);
});

test('checks that an answer unit fits the quantity asked for', () => {
  assert.deepEqual(checkUnit('cm^2', 'area'), { ok: true });
  assert.deepEqual(checkUnit('N m', 'energy'), { ok: true });
  const wrong = checkUnit('cm', 'area');
  assert.equal(wrong.ok, false);
  assert.match(wrong.error, /cm is a length unit, not area/);
  assert.match(checkUnit('blob', 'area').error, /unknown unit "blob"/);
  assert.match(checkUnit('m', 'loudness').error, /unknown quantity loudness/);
});

test('every listed quantity has a dimension', () => {
  for (const q of QUANTITIES) assert.ok(Array.isArray(dimensionOf(q)), q);
});

test('reads a bracketed denominator', () => {
  assert.deepEqual(parseUnit('J/(kg K)').dims, parseUnit('J kg^-1 K^-1').dims);
  assert.throws(() => parseUnit('J/(kg K'), /unknown unit/);
});
