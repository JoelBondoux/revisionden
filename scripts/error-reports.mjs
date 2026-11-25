// Prints the error reports sent with the "Send error report" button, grouped by screen, API
// path and status, newest reference codes first (the same as GET /v1/admin/error-reports).
//   DATABASE_URL=postgres://… node scripts/error-reports.mjs [--since 2026-11-25T00:00:00Z] [--json]
// Read-only. Reports are anonymous: no family, student, account or free text.
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

const DAY_MS = 24 * 60 * 60 * 1000;
const RETENTION_DAYS = 90;
const REFS_PER_GROUP = 20;

/** The start of the window: 24 hours ago by default, at most 90 days back. */
export function parseSince(value, now = new Date()) {
  const asked = value === undefined ? new Date(now.getTime() - DAY_MS) : new Date(value);
  if (Number.isNaN(asked.getTime())) throw new Error('since must be a date and time');
  return new Date(Math.max(asked.getTime(), now.getTime() - RETENTION_DAYS * DAY_MS));
}

/** Rows from the error_reports table (snake_case) grouped like the API does. */
export function groupReports(rows, since) {
  const groups = new Map();
  for (const row of rows) {
    const key = JSON.stringify([row.screen, row.api_path, row.status]);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const summary = [...groups.values()].map((list) => {
    const newest = [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const last = newest[0];
    const first = newest[newest.length - 1];
    return {
      screen: last.screen,
      apiPath: last.api_path ?? null,
      status: last.status ?? null,
      count: list.length,
      refs: newest.slice(0, REFS_PER_GROUP).map((r) => r.ref),
      builds: [...new Set(newest.map((r) => r.build))],
      firstSeen: new Date(first.created_at).toISOString(),
      lastSeen: new Date(last.created_at).toISOString(),
    };
  });
  summary.sort((a, b) => b.count - a.count || b.lastSeen.localeCompare(a.lastSeen));
  return { since: since.toISOString(), total: rows.length, groups: summary };
}

export function formatSummary(summary) {
  if (summary.total === 0) return `No error reports since ${summary.since}.`;
  const lines = [`${summary.total} error reports since ${summary.since}:`];
  for (const g of summary.groups) {
    const call = g.apiPath ? ` → ${g.apiPath} ${g.status ?? ''}`.trimEnd() : '';
    lines.push(
      `${g.count}× ${g.screen}${call} (builds ${g.builds.join(', ')}) ${g.refs.join(' ')}` +
        ` [${g.firstSeen} … ${g.lastSeen}]`,
    );
  }
  return lines.join('\n');
}

async function main() {
  const { values } = parseArgs({
    options: { since: { type: 'string' }, json: { type: 'boolean', default: false } },
  });
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Set DATABASE_URL to the environment database (read-only use).');
  const since = parseSince(values.since);
  // The Neon driver is a dependency of packages/db.
  const require = createRequire(new URL('../packages/db/package.json', import.meta.url));
  const { neon } = await import(pathToFileURL(require.resolve('@neondatabase/serverless')).href);
  const sql = neon(url);
  const rows = await sql`
    select ref, screen, api_path, status, build, created_at
    from error_reports where created_at >= ${since.toISOString()}
    order by created_at desc`;
  const summary = groupReports(rows, since);
  console.log(values.json ? JSON.stringify(summary, null, 2) : formatSummary(summary));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
