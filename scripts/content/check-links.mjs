#!/usr/bin/env node
// pnpm content:check-links [--content <dir>] [--probe-providers] [--coverage]
// Requests every learn link (content/learn-links/*.json) and fails if any answers with anything
// other than 2xx or 3xx, cannot be reached, or (when match-checked) now has a different page title.
// --probe-providers only reports what each provider's home page answers from this machine.
// --coverage only prints how many topics and learning points with items have a shown link.
// Run by .github/workflows/learn-links.yml.
import { dirname, join, relative, resolve } from 'node:path';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { checkLinks, linkCoverage, listLinks, probeProviders } from './learn-links.mjs';

const DEFAULT_CONTENT = join(dirname(fileURLToPath(import.meta.url)), '../../content');

async function loadLearnLinks(root) {
  const dir = join(root, 'learn-links');
  let names = [];
  try {
    names = (await readdir(dir)).filter((n) => n.endsWith('.json')).sort();
  } catch {
    return [];
  }
  return Promise.all(
    names.map(async (n) => ({
      file: relative(root, join(dir, n)),
      data: JSON.parse(await readFile(join(dir, n), 'utf8')),
    })),
  );
}

/** Every item (each JSON file under items/ holds an array). No packages: CI installs none here. */
async function loadItems(root) {
  const dir = join(root, 'items');
  let names = [];
  try {
    names = (await readdir(dir, { recursive: true })).filter((n) => n.endsWith('.json')).sort();
  } catch {
    return [];
  }
  const files = await Promise.all(
    names.map(async (n) => {
      const data = JSON.parse(await readFile(join(dir, n), 'utf8'));
      return (Array.isArray(data) ? data : []).map((item) => ({
        file: join('items', n),
        data: item,
      }));
    }),
  );
  return files.flat();
}

export async function run(
  argv,
  { fetch = globalThis.fetch, out = console.log, err = console.error } = {},
) {
  const { values } = parseArgs({
    args: argv,
    options: {
      content: { type: 'string' },
      'probe-providers': { type: 'boolean' },
      coverage: { type: 'boolean' },
    },
  });
  const root = resolve(values.content ?? DEFAULT_CONTENT);
  if (values['probe-providers']) {
    for (const r of await probeProviders({ fetch }))
      out(`provider ${r.provider} ${r.url} ${r.status}`);
    return 0;
  }
  if (values.coverage) {
    const learnLinks = await loadLearnLinks(root);
    const { topics, points } = linkCoverage({ items: await loadItems(root), learnLinks });
    out(`Topics with items: ${topics.withItems}; with a shown link: ${topics.withLink}`);
    out(
      `Learning points with items: ${points.withItems}; with a link of their own: ${points.withOwnLink}; covered by any link: ${points.withAnyLink}`,
    );
    if (topics.missing.length) out(`No link yet: ${topics.missing.join(', ')}`);
    if (points.missing.length)
      out(`Learning points with no link yet: ${points.missing.join(', ')}`);
    return 0;
  }
  const learnLinks = await loadLearnLinks(root);
  const links = listLinks(learnLinks);
  const results = await checkLinks(links, { fetch });
  const broken = results.filter((r) => !r.ok);
  for (const r of results) out(`${r.ok ? 'ok' : 'BROKEN'} ${r.status} ${r.url}`);
  for (const r of broken) err(`broken: ${r.url} (${r.status}) in ${r.file}`);
  if (broken.length) {
    err(`${broken.length} of ${results.length} learn links are broken.`);
    return 1;
  }
  out(`All ${results.length} learn links work.`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await run(process.argv.slice(2));
}
