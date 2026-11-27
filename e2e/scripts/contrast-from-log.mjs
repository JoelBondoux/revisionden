// W21b: keeps the tier 2 known list in step with what CI draws. On every painted run, each test
// that differs from the list (CONTRAST_RECORD=1) prints its differences into the job log, between
// CONTRAST-RESULT and CONTRAST-END: the rows it found that are not listed, and the listed rows it
// no longer finds. Save each shard's log, then:
//   node e2e/scripts/contrast-from-log.mjs shard1.log shard2.log ...
// It applies them to e2e/tests/contrast-known.json.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const STAMP = /^\d{4}-\d\d-\d\dT[\d:.]+Z /;

/** Every result file printed in a log, by name. A result with no end is refused. */
export function resultsFromLog(log) {
  const out = {};
  let name = null;
  let body = [];
  for (const raw of log.split('\n')) {
    const line = raw.replace(STAMP, '');
    const start = /^CONTRAST-RESULT (\S+\.json)$/.exec(line.trim());
    if (start) {
      if (name) throw new Error(`${name} has no CONTRAST-END`);
      [name, body] = [start[1], []];
    } else if (line.trim() === 'CONTRAST-END' && name) {
      out[name] = JSON.parse(body.join('\n'));
      name = null;
    } else if (name) body.push(line);
  }
  if (name) throw new Error(`${name} has no CONTRAST-END`);
  return out;
}

const sorted = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));

/** The known list with CI's differences applied: new rows added, rows CI no longer finds removed. */
export function applyDiffs(known, diffs) {
  const tier2 = { ...known.tier2 };
  for (const diff of Object.values(diffs)) {
    for (const key of diff.fixed ?? []) delete tier2[key];
    Object.assign(tier2, diff.new ?? {});
  }
  return { ...known, tier2: sorted(tier2) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = new URL('../tests/contrast-known.json', import.meta.url);
  const known = JSON.parse(readFileSync(file, 'utf8'));
  const diffs = {};
  for (const log of process.argv.slice(2))
    for (const [name, diff] of Object.entries(resultsFromLog(readFileSync(log, 'utf8'))))
      if (name.startsWith('diff-tier2-')) diffs[name] = diff;
  const next = applyDiffs(known, diffs);
  writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
  console.log(
    `${Object.keys(diffs).length} tests differed; tier2: ${Object.keys(known.tier2).length} -> ${Object.keys(next.tier2).length} rows`,
  );
}
