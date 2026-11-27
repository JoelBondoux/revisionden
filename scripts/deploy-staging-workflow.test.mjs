import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(
  new URL('../.github/workflows/deploy-staging.yml', import.meta.url),
  'utf8',
);

function job(name) {
  const start = workflow.search(new RegExp(`^  ${name}:$`, 'm'));
  assert.notEqual(start, -1, `deploy-staging.yml has a "${name}" job`);
  const rest = workflow.slice(start + 1);
  const next = rest.search(/^ {2}\S/m);
  return next === -1 ? rest : rest.slice(0, next);
}

test('every staging deploy runs the painted contrast sweep itself, not a past pull request run', () => {
  assert.match(job('contrast'), /uses: \.\/\.github\/workflows\/contrast-painted\.yml/);
});

test('the app deploy waits for the contrast sweep to pass', () => {
  assert.match(job('deploy'), /needs: contrast/);
  assert.match(job('deploy'), /uses: \.\/\.github\/workflows\/deploy\.yml/);
});

test('the public website deploy does not wait for the app contrast sweep', () => {
  assert.doesNotMatch(job('www'), /needs:/);
});
