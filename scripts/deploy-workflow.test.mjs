import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');
const stepNames = [...workflow.matchAll(/^\s+- name: (.+)$/gm)].map((m) => m[1].trim());

function step(name) {
  const start = workflow.indexOf(`- name: ${name}`);
  assert.notEqual(start, -1, `deploy.yml has a "${name}" step`);
  const next = workflow.indexOf('- name:', start + 1);
  return workflow.slice(start, next === -1 ? undefined : next);
}

test('the deploy loads content into the database straight after the migrations', () => {
  const migrate = stepNames.indexOf('Run database migrations');
  const sync = stepNames.indexOf('Load content into the database');
  assert.notEqual(sync, -1, 'deploy.yml has a content sync step');
  assert.equal(sync, migrate + 1);
});

test('the content sync uses the environment database and the api content:sync script', () => {
  const sync = step('Load content into the database');
  assert.match(sync, /DATABASE_URL: \$\{\{ secrets\.DATABASE_URL \}\}/);
  assert.match(sync, /pnpm --filter @revisionden\/api content:sync/);
});

test('the content sync runs on dev and staging but not production', () => {
  const sync = step('Load content into the database');
  assert.match(sync, /if: inputs\.environment != 'production'/);
});
