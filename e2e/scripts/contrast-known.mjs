// W21: merges a CONTRAST_UPDATE=1 run (e2e/test-results/contrast/*.json) into
// e2e/tests/contrast-known.json, replacing the rows of each screen the run covered.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../test-results/contrast/', import.meta.url));
const file = new URL('../tests/contrast-known.json', import.meta.url);
const known = JSON.parse(readFileSync(file, 'utf8'));
const sorted = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
// Each result file covers one screen in one mode on one project
// (tierN-<project>-<mode>-<variant>-<encoded screen>.json): its old rows are replaced by what it
// found, and every other row is kept, so a partial run refreshes only the screens and variants it
// ran (a standard-only run leaves the colour-blind and tint rows alone).
for (const name of readdirSync(dir).filter((n) => n.endsWith('.json'))) {
  const m =
    /^(tier[12])-(phone|desktop)-(light|dark)-(standard|colourblind|cream|blue)-(.+)\.json$/.exec(
      name,
    );
  if (!m) continue;
  const [, tier, project, mode, variant, screen] = m;
  const route = decodeURIComponent(screen);
  const ours = (key) => {
    const [look, keyMode, keyScreen] = key.split('|');
    // A look is recorded as name[+variant][@desktop]; no +variant is the standard palette.
    const keyVariant = /\+([a-z]+)/.exec(look)?.[1] ?? 'standard';
    return (
      keyMode === mode &&
      keyScreen === route &&
      keyVariant === variant &&
      look.endsWith('@desktop') === (project === 'desktop')
    );
  };
  const kept = Object.entries(known[tier] ?? {}).filter(([key]) => !ours(key));
  const found = JSON.parse(readFileSync(join(dir, name), 'utf8'));
  known[tier] = sorted({ ...Object.fromEntries(kept), ...found });
}
for (const tier of ['tier1', 'tier2'])
  console.log(`${tier}: ${Object.keys(known[tier]).length} known failures`);
writeFileSync(file, `${JSON.stringify(known, null, 2)}\n`);
