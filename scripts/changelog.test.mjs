import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseFragment, assembleChangelog, needsFragment, fragmentPathsIn } from './changelog.mjs';

const BASE = `# Changelog

Intro line.

## [Unreleased]

### What's new

- An older family line.

### Fixed

- An older fix.

### Added

- An older addition.

## [00.01.002] - 2026-11-24

## [00.01.001] - 2026-11-24

### Added

- First release.
`;

// The same rules as apps/web/src/features/about/whatsNew.ts, so the About page keeps working.
function whatsNewOf(markdown, version = 'Unreleased') {
  let current = null;
  let inWhatsNew = false;
  const lines = [];
  for (const line of markdown.split('\n')) {
    const v = line.match(/^## \[([^\]]+)\]/);
    if (v) {
      current = v[1];
      inWhatsNew = false;
      continue;
    }
    if (/^#{1,3} /.test(line)) {
      inWhatsNew = /^### What['’]s new\s*$/i.test(line);
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (inWhatsNew && current === version && bullet) lines.push(bullet[1]);
  }
  return lines;
}

test('a fragment is read into its sections, keeping indented continuation lines', () => {
  const fragment = parseFragment(
    "### What's new\n\n- A new thing for families.\n\n### Fixed\n\n- A fix that\n  wraps onto two lines.\n",
    'G13-example.md',
  );
  assert.deepEqual(fragment, {
    name: 'G13-example.md',
    sections: {
      "What's new": ['- A new thing for families.'],
      Fixed: ['- A fix that\n  wraps onto two lines.'],
    },
  });
});

test('a fragment with an unknown heading, text outside a heading or no lines is refused', () => {
  assert.throws(() => parseFragment('### Removed\n\n- x\n', 'a.md'), /a\.md.*Removed/);
  assert.throws(() => parseFragment('- loose line\n', 'b.md'), /b\.md/);
  assert.throws(() => parseFragment('### Fixed\n\nNot a bullet.\n', 'c.md'), /c\.md/);
  assert.throws(() => parseFragment('### Fixed\n\n', 'd.md'), /d\.md.*no lines/);
});

test('assembling with no fragments leaves the changelog exactly as it was', () => {
  assert.equal(assembleChangelog(BASE, []), BASE);
});

test('fragment lines go to the top of their section under Unreleased, in file name order', () => {
  const out = assembleChangelog(BASE, [
    parseFragment("### What's new\n\n- Second family line.\n", 'b.md'),
    parseFragment("### What's new\n\n- First family line.\n\n### Fixed\n\n- New fix.\n", 'a.md'),
  ]);
  assert.deepEqual(whatsNewOf(out), [
    'First family line.',
    'Second family line.',
    'An older family line.',
  ]);
  assert.match(out, /### Fixed\n\n- New fix\.\n- An older fix\.\n/);
  // Released versions are untouched.
  assert.equal(
    out.slice(out.indexOf('## [00.01.002]')),
    BASE.slice(BASE.indexOf('## [00.01.002]')),
  );
});

test('a section the changelog lacks is added in the usual order, with What’s new first', () => {
  const bare = '# Changelog\n\n## [Unreleased]\n\n## [00.01.001] - 2026-11-24\n';
  const out = assembleChangelog(bare, [
    parseFragment("### Changed\n\n- c\n\n### What's new\n\n- w\n", 'x.md'),
  ]);
  assert.equal(
    out,
    "# Changelog\n\n## [Unreleased]\n\n### What's new\n\n- w\n\n### Changed\n\n- c\n\n## [00.01.001] - 2026-11-24\n",
  );
});

test('the real changelog keeps its format and its What’s new lines after assembling', () => {
  const real = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
  const before = whatsNewOf(real);
  const out = assembleChangelog(real, [
    parseFragment(
      "### What's new\n\n- A made-up family line.\n\n### Added\n\n- A made-up addition.\n",
      'z.md',
    ),
  ]);
  assert.deepEqual(whatsNewOf(out), ['A made-up family line.', ...before]);
  assert.equal(out.split('\n').length, real.split('\n').length + 2);
  assert.equal(out.match(/^## \[Unreleased\]$/gm).length, 1);
});

test('only Markdown fragments in changes/unreleased count', () => {
  assert.deepEqual(
    fragmentPathsIn([
      'changes/unreleased/G13-changelog-fragments.md',
      'changes/README.md',
      'changes/unreleased/notes.txt',
      'apps/web/src/App.tsx',
    ]),
    ['changes/unreleased/G13-changelog-fragments.md'],
  );
});

test('a pull request needs a fragment unless it is labelled no-changelog or only touches tests or CI', () => {
  const code = ['apps/web/src/App.tsx'];
  assert.equal(needsFragment(code, []).ok, false);
  assert.match(needsFragment(code, []).reason, /changes\/unreleased/);
  assert.equal(needsFragment([...code, 'changes/unreleased/F20-thing.md'], []).ok, true);
  assert.equal(needsFragment(code, ['no-changelog']).ok, true);
  assert.equal(
    needsFragment(
      [
        '.github/workflows/ci.yml',
        'scripts/changelog.test.mjs',
        'apps/web/src/App.test.tsx',
        'e2e/tests/pages.spec.ts',
      ],
      [],
    ).ok,
    true,
  );
  assert.equal(needsFragment([], []).ok, true);
});

test('the assemble command folds fragments into CHANGELOG.md and deletes them, or keeps them with --keep', async () => {
  const { mkdtempSync, mkdirSync, writeFileSync, existsSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { execFileSync } = await import('node:child_process');
  const script = new URL('./changelog.mjs', import.meta.url).pathname;
  for (const keep of [false, true]) {
    const dir = mkdtempSync(join(tmpdir(), 'changelog-'));
    mkdirSync(join(dir, 'changes/unreleased'), { recursive: true });
    writeFileSync(join(dir, 'CHANGELOG.md'), BASE);
    writeFileSync(join(dir, 'changes/unreleased/a.md'), '### Fixed\n\n- New fix.\n');
    execFileSync('node', [script, 'assemble', ...(keep ? ['--keep'] : [])], { cwd: dir });
    assert.match(readFileSync(join(dir, 'CHANGELOG.md'), 'utf8'), /### Fixed\n\n- New fix\.\n/);
    assert.equal(existsSync(join(dir, 'changes/unreleased/a.md')), keep);
  }
});

const workflow = (name) =>
  readFileSync(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8');

test('pull requests into dev run the fragment check, again when labels change', () => {
  const wf = workflow('changelog.yml');
  assert.match(
    wf,
    /pull_request:\n\s+branches: \[dev\]\n\s+types: \[opened, synchronize, reopened, labeled, unlabeled\]/,
  );
  assert.match(wf, /fetch-depth: 0/);
  assert.match(
    wf,
    /node scripts\/changelog\.mjs check-pr --base "origin\/\$\{\{ github\.base_ref \}\}"/,
  );
  // Labels go through an environment variable, never pasted into the shell line.
  assert.match(wf, /LABELS: \$\{\{ toJson\(github\.event\.pull_request\.labels\.\*\.name\) \}\}/);
  assert.match(wf, /--labels "\$LABELS"/);
});

test('the release on main folds the fragments in before it dates the Unreleased section', () => {
  const wf = workflow('release.yml');
  const fold = wf.indexOf('pnpm changelog:assemble');
  assert.notEqual(fold, -1);
  assert.ok(fold < wf.indexOf('Update changelog heading'));
  assert.match(wf, /git add -A/);
});

test('deploys fold fragments in (without committing) before building, so the About page shows them', () => {
  const wf = workflow('deploy.yml');
  const fold = wf.indexOf('node scripts/changelog.mjs assemble --keep');
  assert.notEqual(fold, -1);
  assert.ok(fold < wf.indexOf('- name: Build the web app'));
});

test('local merges keep both sides of the changelog and the workstreams table', () => {
  const attrs = readFileSync(new URL('../.gitattributes', import.meta.url), 'utf8');
  assert.match(attrs, /^CHANGELOG\.md merge=union$/m);
  assert.match(attrs, /^docs\/WORKSTREAMS\.md merge=union$/m);
});
