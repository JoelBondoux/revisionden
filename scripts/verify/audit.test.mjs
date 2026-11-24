import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContent } from '../content/validate.mjs';
import { auditMarkdown, gitHistory, run } from './audit.mjs';

const FIXTURES = fileURLToPath(new URL('./fixtures/audit/', import.meta.url));
const SNAPSHOT = join(FIXTURES, 'expected.snap');
const GENERATED = new Date('2026-11-24T12:00:00Z');

const history = async (file, id) =>
  id === 'fixture-item-verified'
    ? [
        { version: 1, status: 'verified', at: '2026-11-18T10:00:00Z', commit: 'aaaaaaa' },
        { version: 2, status: 'verified', at: '2026-11-21T09:30:00Z', commit: 'bbbbbbb' },
      ]
    : [];

async function fixtureReport(filter) {
  const content = await loadContent(join(FIXTURES, 'content'));
  const reports = JSON.parse(await readFile(join(FIXTURES, 'reports.json'), 'utf8'));
  return auditMarkdown(content, { filter, history, reports, generatedAt: GENERATED });
}

test('the audit report for a subject matches the snapshot', async () => {
  const markdown = await fixtureReport('fixture-subject');
  if (process.env.UPDATE_SNAPSHOTS) await writeFile(SNAPSHOT, markdown);
  assert.equal(markdown, await readFile(SNAPSHOT, 'utf8'));
});

test('the report lists citations with quote, location, url, retrieved date and hash', async () => {
  const md = await fixtureReport('fixture-item-verified');
  assert.match(md, /fixture quoted words/);
  assert.match(md, /page 3, F1/);
  assert.match(md, /https:\/\/example\.org\/spec/);
  assert.match(md, /2026-11-20/);
  assert.match(md, /a{64}/);
});

test('the report lists every check with its tool and version, and the reviewer role', async () => {
  const md = await fixtureReport('fixture-item-verified');
  assert.match(md, /\| blind-answer \| pass \| openai:fixture-model \| fixture-model-001 \|/);
  assert.match(md, /Reviewer role: subject-specialist/);
});

test('the report lists version history and reports with their decisions', async () => {
  const md = await fixtureReport('fixture-item-verified');
  assert.match(md, /\| 1 \| verified \| 2026-11-18T10:00:00Z \| aaaaaaa \|/);
  assert.match(
    md,
    /\| 2026-11-19T08:00:00.000Z \| 1 \| wrong_answer \| confirmed_error \| content-lead \|/,
  );
});

test('a draft item shows what is still missing', async () => {
  const md = await fixtureReport('fixture-item-draft');
  assert.match(md, /\(no quote yet\)/);
  assert.match(md, /No checks recorded yet/);
  assert.match(md, /Reviewer role: none yet/);
});

test('pipes and line breaks in the content cannot break the tables', async () => {
  const content = await loadContent(join(FIXTURES, 'content'));
  content.items[0].data.citations[0].quote = 'a | b\nc';
  const md = await auditMarkdown(content, {
    filter: 'fixture-item-verified',
    generatedAt: GENERATED,
  });
  assert.match(md, /a \\\| b c/);
});

test('the report never includes a reporter or reviewer name, only roles', async () => {
  const md = await fixtureReport('fixture-subject');
  assert.doesNotMatch(md, /@|reporter/i);
});

function git(cwd, args, date) {
  return execFileSync('git', args, {
    cwd,
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: date,
      GIT_COMMITTER_DATE: date,
      GIT_AUTHOR_NAME: 'fixture',
      GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
      GIT_COMMITTER_NAME: 'fixture',
      GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
    },
  }).toString();
}

test('version history is read from git: one row per version of the item', async () => {
  const repo = await mkdtemp(join(tmpdir(), 'rd-audit-git-'));
  await mkdir(join(repo, 'content/items'), { recursive: true });
  git(repo, ['init', '-q']);
  const file = join(repo, 'content/items/a.json');
  const save = async (version, status, date, extra = '') => {
    await writeFile(
      file,
      JSON.stringify([{ id: 'x', extra, verification: { status, version, checks: [] } }]),
    );
    git(repo, ['add', '.'], date);
    git(repo, ['commit', '-qm', `v${version}`], date);
  };
  await save(1, 'draft', '2026-11-01T10:00:00Z');
  await save(1, 'verified', '2026-11-02T10:00:00Z');
  await save(1, 'verified', '2026-11-02T11:00:00Z', 'same version, unrelated change');
  await save(2, 'draft', '2026-11-03T10:00:00Z');
  const rows = await gitHistory({ repoRoot: repo, contentRoot: join(repo, 'content') })(
    'items/a.json',
    'x',
  );
  assert.deepEqual(
    rows.map((r) => [r.version, r.status, r.at]),
    [
      [1, 'draft', '2026-11-01T10:00:00Z'],
      [1, 'verified', '2026-11-02T10:00:00Z'],
      [2, 'draft', '2026-11-03T10:00:00Z'],
    ],
  );
  assert.match(rows[0].commit, /^[0-9a-f]{7}$/);
});

const io = () => {
  const lines = [];
  return { lines, out: (s) => lines.push(s), err: (s) => lines.push(s) };
};

test('the command prints the report for an id, topic or subject', async () => {
  const out = io();
  const code = await run(
    [
      'fixture-leaf',
      '--content',
      join(FIXTURES, 'content'),
      '--reports',
      join(FIXTURES, 'reports.json'),
      '--no-history',
    ],
    { ...out, now: () => GENERATED },
  );
  assert.equal(code, 0);
  assert.match(out.lines.join('\n'), /# Audit report: fixture-leaf/);
  assert.match(out.lines.join('\n'), /fixture-item-draft/);
});

test('the command can write the report to a file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rd-audit-out-'));
  const target = join(dir, 'report.md');
  await run(
    ['fixture-leaf', '--content', join(FIXTURES, 'content'), '--no-history', '--out', target],
    {
      ...io(),
      now: () => GENERATED,
    },
  );
  assert.match(await readFile(target, 'utf8'), /# Audit report: fixture-leaf/);
});

test('the command fails for an unknown id or with no id', async () => {
  const out = io();
  assert.equal(
    await run(['nothing-here', '--content', join(FIXTURES, 'content'), '--no-history'], out),
    1,
  );
  assert.match(out.lines.join('\n'), /Nothing found for nothing-here/);
  assert.equal(await run([], io()), 2);
});
