#!/usr/bin/env node
// pnpm content:check-links [--content <dir>]
// Requests every "Learn it first" link (content/learn-links/*.json) and fails if any answers with
// anything other than 2xx or 3xx, or cannot be reached. Run by .github/workflows/learn-links.yml.
import { dirname, join, relative, resolve } from 'node:path';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { checkLinks, listLinks } from './learn-links.mjs';

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

export async function run(
  argv,
  { fetch = globalThis.fetch, out = console.log, err = console.error } = {},
) {
  const { values } = parseArgs({ args: argv, options: { content: { type: 'string' } } });
  const root = resolve(values.content ?? DEFAULT_CONTENT);
  const links = listLinks(await loadLearnLinks(root));
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
