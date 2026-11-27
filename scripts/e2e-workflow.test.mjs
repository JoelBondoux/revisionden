import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/e2e.yml', import.meta.url), 'utf8');

function job(name) {
  const start = workflow.search(new RegExp(`^ {2}${name}:$`, 'm'));
  assert.notEqual(start, -1, `e2e.yml has a "${name}" job`);
  const rest = workflow.slice(start + 1);
  const next = rest.search(/^ {2}[a-z0-9-]+:$/m);
  return next === -1 ? rest : rest.slice(0, next);
}

test('the end-to-end suite runs on pull requests into dev, staging and main', () => {
  assert.match(workflow, /pull_request:\n\s+branches: \[dev, staging, main\]/);
});

test('the web app is built once and shared with every shard as an artifact', () => {
  const build = job('build');
  assert.match(build, /pnpm --filter @revisionden\/web build/);
  assert.match(build, /actions\/upload-artifact@v4/);
  assert.match(build, /name: web-dist/);
  const e2e = job('e2e');
  assert.match(e2e, /needs: build/);
  assert.match(e2e, /actions\/download-artifact@v4/);
  assert.match(e2e, /name: web-dist/);
  assert.doesNotMatch(e2e, /@revisionden\/web build/);
});

test('the suite is sharded across parallel jobs with the same browser setup', () => {
  const e2e = job('e2e');
  assert.match(e2e, /shard: \[1, 2, 3, 4\]/);
  assert.match(e2e, /--shard=\$\{\{ matrix\.shard \}\}\/4/);
  assert.match(e2e, /playwright install --with-deps chromium/);
  assert.match(e2e, /fail-fast: false/);
});

test('one summary check passes only when every shard passed, so it can be required', () => {
  const result = job('e2e-result');
  assert.match(result, /needs: \[build, e2e\]/);
  assert.match(result, /if: always\(\)/);
  assert.match(result, /needs\.e2e\.result/);
});
