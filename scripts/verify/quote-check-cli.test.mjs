import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from './quote-check-cli.mjs';
import { draftItem, quoted, verifiedRecord } from './test-content.mjs';

const URL_PAGE = 'https://www.gov.uk/fixture-page';
const HTML = new TextEncoder().encode('<p>A17 solve linear equations in one unknown</p>');
const sha = createHash('sha256').update(HTML).digest('hex');
const store = {
  async get(url) {
    if (url !== URL_PAGE) throw new Error(`${url}: download failed: HTTP 404`);
    return {
      url,
      bytes: HTML,
      contentType: 'text/html',
      sha256: sha,
      retrievedAt: 'x',
      fromCache: true,
    };
  },
};
const good = quoted({ url: URL_PAGE, location: 'A17', quote: 'solve linear equations' });
const bad = quoted({ url: URL_PAGE, location: 'A17', quote: 'differentiate' });

async function contentDir(items) {
  const root = await mkdtemp(join(tmpdir(), 'rd-qc-'));
  await mkdir(join(root, 'items'), { recursive: true });
  await writeFile(join(root, 'items/fixture.json'), JSON.stringify(items));
  return root;
}

function capture() {
  const lines = { out: [], err: [] };
  return { lines, out: (s) => lines.out.push(s), err: (s) => lines.err.push(s) };
}

test('prints a pass line per item and exits 0 when every quote is found', async () => {
  const root = await contentDir([draftItem('fixture-a', [good])]);
  const io = capture();
  const code = await run(['--content', root], { store, ...io });
  assert.equal(code, 0);
  assert.match(io.lines.out.join('\n'), /pass {2}item fixture-a/);
  assert.match(io.lines.out.join('\n'), /1 of 1 passed/);
});

test('exits 1 and explains each failing citation', async () => {
  const root = await contentDir([draftItem('fixture-a', [good]), draftItem('fixture-b', [bad])]);
  const io = capture();
  const code = await run(['--content', root], { store, ...io });
  assert.equal(code, 1);
  assert.match(io.lines.out.join('\n'), /FAIL {2}item fixture-b/);
  assert.match(io.lines.out.join('\n'), /citation 1: quote not found in the source/);
});

test('--json prints the full results', async () => {
  const root = await contentDir([draftItem('fixture-a', [good])]);
  const io = capture();
  await run(['--content', root, '--json'], { store, ...io });
  const [result] = JSON.parse(io.lines.out.join(''));
  assert.equal(result.check.name, 'quote-check');
  assert.equal(result.citations[0].sha256, sha);
});

test('--write records the check and the hash in draft content files', async () => {
  const root = await contentDir([draftItem('fixture-a', [good])]);
  await run(['--content', root, '--write'], { store, ...capture() });
  const [saved] = JSON.parse(await readFile(join(root, 'items/fixture.json'), 'utf8'));
  assert.equal(saved.citations[0].sha256, sha);
  assert.equal(saved.verification.checks[0].name, 'quote-check');
});

test('--write skips verified content and says so', async () => {
  const item = { ...draftItem('fixture-a', [good]), verification: verifiedRecord() };
  const root = await contentDir([item]);
  const io = capture();
  await run(['--content', root, '--write'], { store, ...io });
  assert.match(io.lines.err.join('\n'), /not written: fixture-a: verified version 1 is immutable/);
});

test('--only with an unknown id is an error', async () => {
  const root = await contentDir([draftItem('fixture-a', [good])]);
  const io = capture();
  assert.equal(await run(['--content', root, '--only', 'nope'], { store, ...io }), 1);
  assert.match(io.lines.err.join('\n'), /Nothing found for nope/);
});

test('an unknown option is a usage error', async () => {
  const io = capture();
  assert.equal(await run(['--bogus'], { store, ...io }), 2);
});
