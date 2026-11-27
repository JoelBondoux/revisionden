// W21: merges a CONTRAST_UPDATE=1 run (e2e/test-results/contrast/*.json) into
// e2e/tests/contrast-known.json, replacing each tier's list that the run covered.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../test-results/contrast/', import.meta.url));
const file = new URL('../tests/contrast-known.json', import.meta.url);
const known = JSON.parse(readFileSync(file, 'utf8'));
const sorted = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
for (const tier of ['tier1', 'tier2']) {
  const files = readdirSync(dir).filter((n) => n.startsWith(`${tier}-`) && n.endsWith('.json'));
  if (files.length === 0) continue; // that tier was not run: keep its list as it is
  const found = {};
  for (const name of files) Object.assign(found, JSON.parse(readFileSync(join(dir, name), 'utf8')));
  known[tier] = sorted(found);
  console.log(`${tier}: ${Object.keys(found).length} known failures`);
}
writeFileSync(file, `${JSON.stringify(known, null, 2)}\n`);
