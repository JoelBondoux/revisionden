#!/usr/bin/env node
// pnpm content:quote-check [--content <dir>] [--only <id>] [--write] [--refresh] [--json]
// Fetches every cited source (official hosts only), confirms each quote at its stated location
// and prints the result. --write records the quote-check and source SHA-256 in draft content.
// Sources are cached outside the repository (REVISIONDEN_SOURCE_CACHE, default
// ~/.cache/revisionden/sources): exam board documents are never committed.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { loadContent } from '../content/validate.mjs';
import { replaceInFile } from './content-files.mjs';
import { applyQuoteCheck, quoteCheckContent } from './quote-check.mjs';
import { createSourceStore, REPO_ROOT } from './sources.mjs';

const LABEL = {
  items: 'item',
  topicTrees: 'topic-tree',
  markSchemes: 'mark-scheme',
  diagrams: 'diagram',
};

export async function run(argv, deps = {}) {
  const { out = console.log, err = console.error, now } = deps;
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: {
        content: { type: 'string' },
        only: { type: 'string' },
        write: { type: 'boolean' },
        refresh: { type: 'boolean' },
        json: { type: 'boolean' },
      },
    }));
  } catch (e) {
    err(e.message);
    return 2;
  }
  const root = resolve(values.content ?? `${REPO_ROOT}/content`);
  const base = deps.store ?? createSourceStore();
  const store = values.refresh ? { get: (url) => base.get(url, { refresh: true }) } : base;
  const results = await quoteCheckContent(await loadContent(root), {
    store,
    now,
    only: values.only,
  });
  if (results.length === 0) {
    err(`Nothing found for ${values.only}.`);
    return 1;
  }

  if (values.json) out(JSON.stringify(results, null, 2));
  else {
    for (const r of results) {
      out(`${r.result === 'pass' ? 'pass' : 'FAIL'}  ${LABEL[r.kind]} ${r.id}  ${r.check.notes}`);
    }
    const passed = results.filter((r) => r.result === 'pass').length;
    const all = results.flatMap((r) => r.citations);
    const count = (result) => all.filter((c) => c.result === result).length;
    out(
      `Quote check: ${passed} of ${results.length} passed. Citations: ${all.length}, ` +
        `${count('pass')} exact, ${count('near')} near matches for a reviewer to confirm, ` +
        `${count('fail')} not confirmed.`,
    );
  }

  if (values.write) {
    const content = await loadContent(root);
    for (const r of results) {
      const data = content[r.kind].find((e) => e.data.id === r.id).data;
      try {
        await replaceInFile(root, r.file, applyQuoteCheck(data, r));
      } catch (e) {
        err(`not written: ${e.message}`);
      }
    }
  }
  return results.every((r) => r.result === 'pass') ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await run(process.argv.slice(2));
}
