// W21b: makes the tier 2 known list from what CI draws. The painted workflow prints each test's
// findings (CONTRAST_RECORD=1) into its job log between CONTRAST-RESULT and CONTRAST-END; save
// each shard's log, then:
//   node e2e/scripts/contrast-from-log.mjs shard1.log shard2.log ...
//   node e2e/scripts/contrast-known.mjs
// The first writes e2e/test-results/contrast/*.json; the second merges them as an update run's.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = fileURLToPath(new URL('../test-results/contrast/', import.meta.url));
  mkdirSync(dir, { recursive: true });
  let files = 0;
  for (const log of process.argv.slice(2))
    for (const [name, found] of Object.entries(resultsFromLog(readFileSync(log, 'utf8')))) {
      writeFileSync(join(dir, name), JSON.stringify(found, null, 2));
      files++;
    }
  console.log(`${files} result files written to ${dir}`);
}
