import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from './check-links.mjs';

function contentWith(urls) {
  const root = mkdtempSync(join(tmpdir(), 'check-links-'));
  mkdirSync(join(root, 'learn-links'));
  writeFileSync(
    join(root, 'learn-links', 't.json'),
    JSON.stringify({
      topic: 't',
      links: urls.map((url) => ({
        title: 'T',
        url,
        provider: 'oak',
        level: 'GCSE',
        checked_at: null,
      })),
    }),
  );
  return root;
}

const capture = () => {
  const lines = [];
  return { lines, log: (l) => lines.push(l) };
};

test('passes when every link answers 2xx or 3xx', async () => {
  const out = capture();
  const code = await run(['--content', contentWith(['https://x/a', 'https://x/b'])], {
    fetch: async (url) => ({ status: url.endsWith('b') ? 302 : 200 }),
    out: out.log,
    err: out.log,
  });
  assert.equal(code, 0);
  assert.match(out.lines.at(-1), /All 2 learn links work/);
});

test('fails and names each broken link', async () => {
  const out = capture();
  const code = await run(['--content', contentWith(['https://x/a', 'https://x/gone'])], {
    fetch: async (url) => ({ status: url.endsWith('gone') ? 404 : 200 }),
    out: out.log,
    err: out.log,
  });
  assert.equal(code, 1);
  assert.ok(
    out.lines.some((l) => /broken: https:\/\/x\/gone \(404\) in learn-links\/t\.json/.test(l)),
  );
});

test('passes with nothing to check', async () => {
  const root = mkdtempSync(join(tmpdir(), 'check-links-empty-'));
  const out = capture();
  assert.equal(
    await run(['--content', root], {
      fetch: async () => ({ status: 500 }),
      out: out.log,
      err: out.log,
    }),
    0,
  );
});
