#!/usr/bin/env node
// pnpm content:audit <item | topic | topic tree | subject id> [--content <dir>] [--reports <file>]
//   [--out <file>] [--no-history]
// Markdown audit report (docs/VERIFICATION.md section 6): each entry's citations (quote,
// location, url, retrieved date, source hash), every check with its tool or model and version,
// the reviewer role, version history (from git) and any reports (exported from the review API).
// Roles only: the report never names a person.
import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs, promisify } from 'node:util';
import { auditReport, loadContent } from '../content/validate.mjs';
import { stamp } from './record.mjs';
import { REPO_ROOT } from './sources.mjs';

const exec = promisify(execFile);

const cell = (value) =>
  value === undefined || value === null || value === ''
    ? '-'
    : String(value)
        .replace(/\|/g, '\\|')
        .replace(/\s*\n\s*/g, ' ');
const row = (cells) => `| ${cells.map(cell).join(' | ')} |`;
const table = (head, rows) => [row(head), row(head.map(() => '---')), ...rows.map(row)];

function citationTable(citations) {
  return table(
    ['#', 'Source', 'Location', 'Quote', 'URL', 'Retrieved', 'SHA-256', 'Supports'],
    citations.map((c, i) => [
      i + 1,
      `${c.publisher}, ${c.title} (${c.document_ref}) [${c.source_type}]`,
      c.location,
      c.quote ?? '(no quote yet)',
      c.url,
      c.retrieved_at,
      c.sha256,
      c.supports.join(', '),
    ]),
  );
}

function checkTable(checks) {
  if (checks.length === 0) return ['No checks recorded yet.'];
  return table(
    ['Check', 'Result', 'Tool or model', 'Version', 'When', 'Notes'],
    checks.map((c) => [c.name, c.result, c.tool, c.tool_version, c.at, c.notes]),
  );
}

function historyTable(rows) {
  if (rows.length === 0) return ['No version history found.'];
  return table(
    ['Version', 'Status', 'Since', 'Commit'],
    rows.map((r) => [r.version, r.status, r.at, r.commit]),
  );
}

function reportTable(reports) {
  if (reports.length === 0) return ['No reports.'];
  return table(
    ['Reported', 'Version', 'Reason', 'Status', 'Decided by (role)', 'Decided'],
    reports.map((r) => [
      r.reportedAt,
      r.itemVersion,
      r.reason,
      r.status,
      r.decidedByRole,
      r.decidedAt,
    ]),
  );
}

/** The markdown audit report for a filter (item, topic, topic tree or subject id). */
export async function auditMarkdown(
  content,
  { filter, history = async () => [], reports = [], generatedAt = new Date() } = {},
) {
  const rows = auditReport(content, { filter, detail: true });
  const verified = rows.filter((r) => r.status === 'verified').length;
  const quoted = rows.filter((r) => !r.needs_sourcing).length;
  const failing = rows.filter((r) => r.detail.checks.some((c) => c.result === 'fail')).length;
  const lines = [
    `# Audit report: ${filter ?? 'all content'}`,
    '',
    `Generated ${stamp(generatedAt)}. Citations are kept for audit and are not shown in the app.`,
    '',
    `- Entries: ${rows.length}`,
    `- Verified: ${verified}`,
    `- Every citation quoted: ${quoted} of ${rows.length}`,
    `- With a failed check: ${failing}`,
  ];
  for (const r of rows) {
    const own = reports.filter((p) => p.itemId === r.id);
    lines.push(
      '',
      `## ${r.kind} ${r.id}`,
      '',
      `- File: ${r.file}`,
      `- Status: ${r.status} (version ${r.version})`,
      `- Reviewer role: ${r.detail.reviewed_by ?? 'none yet'}`,
      `- Needs human approval: ${r.needs_human_approval ? 'yes' : 'no'}`,
      '',
      '### Citations',
      '',
      ...citationTable(r.detail.citations),
      '',
      '### Checks',
      '',
      ...checkTable(r.detail.checks),
      '',
      '### Version history',
      '',
      ...historyTable(await history(r.file, r.id)),
      '',
      '### Reports',
      '',
      ...reportTable(own),
    );
  }
  return `${lines.join('\n')}\n`;
}

function entryIn(json, id) {
  if (Array.isArray(json)) return json.find((e) => e.id === id);
  return json?.id === id ? json : null;
}

/** history(file, id): one row per version and status of an entry, read from git commits. */
export function gitHistory({
  repoRoot = REPO_ROOT,
  contentRoot = join(REPO_ROOT, 'content'),
} = {}) {
  return async (file, id) => {
    const path = relative(repoRoot, join(contentRoot, file));
    let log;
    try {
      ({ stdout: log } = await exec('git', ['log', '--reverse', '--format=%H %cI', '--', path], {
        cwd: repoRoot,
      }));
    } catch {
      return [];
    }
    const rows = [];
    for (const line of log.trim().split('\n').filter(Boolean)) {
      const [sha, date] = line.split(' ');
      let entry;
      try {
        const { stdout } = await exec('git', ['show', `${sha}:${path}`], {
          cwd: repoRoot,
          maxBuffer: 1 << 26,
        });
        entry = entryIn(JSON.parse(stdout), id);
      } catch {
        continue;
      }
      const v = entry?.verification;
      if (!v) continue;
      const last = rows.at(-1);
      if (last?.version === v.version && last?.status === v.status) continue;
      rows.push({
        version: v.version,
        status: v.status,
        at: stamp(new Date(date)),
        commit: sha.slice(0, 7),
      });
    }
    return rows;
  };
}

export async function run(argv, deps = {}) {
  const { out = console.log, err = console.error, now = () => new Date() } = deps;
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        content: { type: 'string' },
        reports: { type: 'string' },
        out: { type: 'string' },
        'no-history': { type: 'boolean' },
      },
    });
  } catch (e) {
    err(e.message);
    return 2;
  }
  const { values, positionals } = parsed;
  const [filter] = positionals;
  if (!filter) {
    err('Usage: pnpm content:audit <item | topic | topic tree | subject id>');
    return 2;
  }
  const contentRoot = resolve(values.content ?? join(REPO_ROOT, 'content'));
  const content = await loadContent(contentRoot);
  if (auditReport(content, { filter }).length === 0) {
    err(`Nothing found for ${filter}.`);
    return 1;
  }
  const reports = values.reports ? JSON.parse(await readFile(values.reports, 'utf8')) : [];
  const history = values['no-history'] ? undefined : gitHistory({ contentRoot });
  const markdown = await auditMarkdown(content, { filter, history, reports, generatedAt: now() });
  if (values.out) await writeFile(values.out, markdown);
  else out(markdown);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await run(process.argv.slice(2));
}
