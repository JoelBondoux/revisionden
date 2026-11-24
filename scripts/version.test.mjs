import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseVersion, formatVersion, bumpVersion, bumpTypeFromMessage } from './version.mjs';

test('parses xx.xx.xxx into numbers', () => {
  assert.deepEqual(parseVersion('00.01.000'), { major: 0, minor: 1, patch: 0 });
  assert.deepEqual(parseVersion('12.34.567\n'), { major: 12, minor: 34, patch: 567 });
});

test('rejects anything not in xx.xx.xxx form', () => {
  for (const bad of ['1.2.3', '00.01.00', '00.1.000', 'v00.01.000', '', 'aa.bb.ccc']) {
    assert.throws(() => parseVersion(bad), /Invalid version/);
  }
});

test('formats with zero padding', () => {
  assert.equal(formatVersion({ major: 0, minor: 1, patch: 7 }), '00.01.007');
  assert.equal(formatVersion({ major: 3, minor: 10, patch: 120 }), '03.10.120');
});

test('patch bump increments the last part', () => {
  assert.equal(bumpVersion('00.01.000', 'patch'), '00.01.001');
  assert.equal(bumpVersion('00.01.009', 'patch'), '00.01.010');
});

test('minor bump resets patch; major bump resets minor and patch', () => {
  assert.equal(bumpVersion('00.01.042', 'minor'), '00.02.000');
  assert.equal(bumpVersion('00.07.042', 'major'), '01.00.000');
});

test('refuses to overflow a part', () => {
  assert.throws(() => bumpVersion('00.01.999', 'patch'), /overflow/);
  assert.throws(() => bumpVersion('00.99.000', 'minor'), /overflow/);
  assert.throws(() => bumpVersion('99.00.000', 'major'), /overflow/);
});

test('reads the bump type from a commit message', () => {
  assert.equal(bumpTypeFromMessage('feat: add streaks'), 'patch');
  assert.equal(bumpTypeFromMessage('release: stage 1 [minor]'), 'minor');
  assert.equal(bumpTypeFromMessage('public launch [major]'), 'major');
});
