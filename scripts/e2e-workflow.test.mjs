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
  assert.match(result, /needs: \[build, e2e, contrast\]/);
  assert.match(result, /if: always\(\)/);
  assert.match(result, /needs\.e2e\.result/);
  assert.match(result, /needs\.contrast\.result/);
});

test('the contrast sweep (tier 1) runs once on the shared build, not in every shard (W21)', () => {
  const contrast = job('contrast');
  assert.match(contrast, /needs: build/);
  assert.match(contrast, /actions\/download-artifact@v4/);
  assert.match(contrast, /name: web-dist/);
  assert.doesNotMatch(contrast, /@revisionden\/web build/);
  assert.match(contrast, /tests\/contrast-sweep\.spec\.ts/);
  assert.match(contrast, /--grep @contrast /);
  assert.match(job('e2e'), /--grep-invert @contrast/);
});

const painted = readFileSync(
  new URL('../.github/workflows/contrast-painted.yml', import.meta.url),
  'utf8',
);

test('the painted sweep fails a pull request on new or fixed rows again, now the list is made from CI (W21b, decision 0012)', () => {
  // W21c made pull requests report-only while the list came from a developer's machine; the list
  // is now made from CI runs, so every run blocks and there is nothing for a caller to switch.
  assert.doesNotMatch(painted, /continue-on-error/);
  assert.doesNotMatch(painted, /inputs\.blocking/);
  assert.match(painted, /workflow_call:\n/);
  // Every run that found something keeps its report and lists the new and fixed rows.
  assert.match(painted, /id: sweep/);
  // A blocking run that fails still writes its summary and keeps its report: without a status
  // function GitHub adds success(), which would skip both (Codex on train #407).
  assert.equal(
    (painted.match(/if: \$\{\{ !cancelled\(\) && steps\.sweep\.outcome == 'failure' \}\}/g) ?? [])
      .length,
    2,
  );
  assert.match(painted, /GITHUB_STEP_SUMMARY/);
});

test('the nightly painted sweep covers every variant, sharded wider; other runs are standard only (W21b)', () => {
  // Nightly, or a pull request labelled contrast-variants: colour-blind palette and each reading
  // tint, on 12 shards. Style pull requests and the staging gate: standard palette, on 4.
  const full =
    "(github.event_name == 'schedule' || contains(github.event.pull_request.labels.*.name, 'contrast-variants'))";
  assert.match(painted, /schedule:/);
  assert.ok(painted.includes(`CONTRAST_VARIANTS: \${{ ${full} && '1' || '' }}`), 'variants');
  assert.ok(
    painted.includes(
      `fromJSON(${full} && '[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]' || '[1, 2, 3, 4]')`,
    ),
    '12 shards',
  );
  assert.ok(
    painted.includes(`--shard=\${{ matrix.shard }}/\${{ ${full} && 12 || 4 }}`),
    'the shard count matches',
  );
  assert.match(painted, /types: \[opened, synchronize, reopened, labeled\]/);
  assert.match(painted, /workflow_call:/);
  assert.match(painted, /CONTRAST_SWEEP: '1'/);
});

test('the painted sweep prints what CI found, so the known list is made from CI (W21b)', () => {
  assert.match(painted, /CONTRAST_RECORD: '1'/);
  assert.match(painted, /echo "CONTRAST-RESULT \$\(basename "\$f"\)"/);
  assert.match(painted, /echo "CONTRAST-END"/);
  assert.ok(
    painted.includes('e2e/test-results/contrast/diff-tier2-*.json'),
    'only the differences',
  );
  // A change to the sweep itself runs it too.
  for (const path of [
    'e2e/tests/contrast-sweep.spec.ts',
    'e2e/tests/contrast-known.json',
    'e2e/tests/support/painted.ts',
    '.github/workflows/contrast-painted.yml',
  ])
    assert.ok(painted.includes(`- '${path}'`), `runs on changes to ${path}`);
});

test('every Playwright system install in the painted sweep first drops the runner image Microsoft apt source (G12)', () => {
  // ubuntu-26.04 images list packages.microsoft.com, whose apt release file is no longer signed,
  // so `playwright install --with-deps` (apt-get update) can fail on it (shard 11, run 45960273528).
  assert.ok(painted.includes('playwright install --with-deps'));
  const steps = painted.split(/\n(?= {6}- )/);
  steps.forEach((s, i) => {
    if (!s.includes('playwright install --with-deps')) return;
    assert.match(steps[i - 1], /- name: Drop the unsigned Microsoft apt source/);
    assert.match(steps[i - 1], /packages\.microsoft\.com/);
    assert.match(steps[i - 1], /\/etc\/apt\/sources\.list\.d/);
  });
});
