import { test } from 'node:test';
import assert from 'node:assert/strict';
import { judgeHealth } from './check-deploy.mjs';

const ok = { httpStatus: 200, body: { status: 'ok', version: '00.01.002' } };
const misconfigured = { httpStatus: 503, body: { status: 'misconfigured', version: '00.01.002' } };

test('a healthy API on the expected version passes', () => {
  assert.deepEqual(judgeHealth(ok, { version: '00.01.002', environment: 'production' }), {
    pass: true,
    message: 'API is healthy on 00.01.002',
  });
});

test('an API still on an older version fails', () => {
  const result = judgeHealth(ok, { version: '00.01.003', environment: 'dev' });
  assert.equal(result.pass, false);
  assert.match(result.message, /00\.01\.002.*expected 00\.01\.003/);
});

test('dev and staging pass while sign-in secrets are still to be added', () => {
  for (const environment of ['dev', 'staging']) {
    const result = judgeHealth(misconfigured, { version: '00.01.002', environment });
    assert.equal(result.pass, true);
    assert.match(result.message, /secrets still missing/);
  }
});

test('production fails while any secret is missing', () => {
  const result = judgeHealth(misconfigured, { version: '00.01.002', environment: 'production' });
  assert.equal(result.pass, false);
  assert.match(result.message, /missing secrets/);
});

test('an answer that is not the health shape fails', () => {
  const result = judgeHealth(
    { httpStatus: 404, body: undefined },
    { version: '1', environment: 'dev' },
  );
  assert.equal(result.pass, false);
});
