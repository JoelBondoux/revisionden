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

test('--probe-providers prints what each provider home page answered and never fails', async () => {
  const out = capture();
  const code = await run(['--probe-providers'], {
    fetch: async (url) => {
      if (url.includes('bbc')) throw new Error('fetch failed');
      return { status: 200 };
    },
    out: out.log,
    err: out.log,
  });
  assert.equal(code, 0);
  assert.deepEqual(out.lines, [
    'provider oak https://www.thenational.academy/ 200',
    'provider bitesize https://www.bbc.co.uk/bitesize/ fetch failed',
  ]);
});

test('--coverage prints how many topics and learning points with items have a shown link', async () => {
  const root = mkdtempSync(join(tmpdir(), 'check-links-coverage-'));
  for (const dir of ['learn-links', 'items', 'subjects', 'topic-trees']) mkdirSync(join(root, dir));
  writeFileSync(
    join(root, 'items', 'a.json'),
    JSON.stringify([
      { id: 't-0001', topic: 't', learning_point: 't-lp-one' },
      { id: 'u-0001', topic: 'u', learning_point: 'u-lp-two' },
    ]),
  );
  writeFileSync(
    join(root, 'learn-links', 't.json'),
    JSON.stringify({
      topic: 't',
      links: [
        {
          title: 'T',
          url: 'https://www.thenational.academy/t',
          provider: 'oak',
          level: 'GCSE',
          checked_at: '2026-11-26',
          match: {
            page_title: 'T',
            teaches: 'Teaches topic t.',
            level: 'GCSE',
            checked_at: '2026-11-26',
          },
        },
      ],
    }),
  );
  const out = capture();
  const code = await run(['--coverage', '--content', root], {
    fetch: async () => {
      throw new Error('no requests for coverage');
    },
    out: out.log,
    err: out.log,
  });
  assert.equal(code, 0);
  assert.deepEqual(out.lines, [
    'Topics with items: 2; with a shown link: 1',
    'Learning points with items: 2; with a link of their own: 0; covered by any link: 1',
    'Legacy links (shown, not yet match-checked): 0',
    'No link yet: u',
    'Learning points with no link yet: u-lp-two',
  ]);
});

test('the link check runs without installed packages (CI installs none): only node: and local imports', async () => {
  const { readFileSync } = await import('node:fs');
  const { dirname, resolve: resolvePath } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const here = dirname(fileURLToPath(import.meta.url));
  const seen = new Set();
  const outside = [];
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const src = readFileSync(file, 'utf8');
    for (const [, spec] of src.matchAll(/^\s*import[^'"]*['"]([^'"]+)['"]/gm)) {
      if (spec.startsWith('node:')) continue;
      if (spec.startsWith('.')) visit(resolvePath(dirname(file), spec));
      else outside.push(`${spec} (from ${file.split('/').pop()})`);
    }
  };
  visit(resolvePath(here, 'check-links.mjs'));
  assert.deepEqual(outside, []);
});

test('legacy links pass but are listed as a warning, and counted in coverage', async () => {
  const root = mkdtempSync(join(tmpdir(), 'check-links-legacy-'));
  mkdirSync(join(root, 'learn-links'));
  const legacy =
    'https://www.thenational.academy/teachers/programmes/maths-secondary-ks4-higher/units/percentages/lessons/checking-and-securing-understanding-of-percentage-increase';
  writeFileSync(
    join(root, 'learn-links', 't.json'),
    JSON.stringify({
      topic: 't',
      links: [
        { title: 'T', url: legacy, provider: 'oak', level: 'GCSE', checked_at: '2026-11-25' },
      ],
    }),
  );
  const out = capture();
  const code = await run(['--content', root], {
    fetch: async () => ({ status: 200 }),
    out: out.log,
    err: out.log,
  });
  assert.equal(code, 0);
  assert.ok(
    out.lines.includes(
      `warning: legacy link, shown without a match check until it is re-read: ${legacy} in learn-links/t.json`,
    ),
    out.lines.join('\n'),
  );
  const cov = capture();
  await run(['--coverage', '--content', root], {
    fetch: async () => ({}),
    out: cov.log,
    err: cov.log,
  });
  assert.ok(
    cov.lines.includes('Legacy links (shown, not yet match-checked): 1'),
    cov.lines.join('\n'),
  );
});
