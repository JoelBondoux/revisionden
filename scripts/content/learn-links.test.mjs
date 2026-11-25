import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkLinks,
  isWorkingStatus,
  learnLinkErrors,
  listLinks,
  PROVIDER_HOSTS,
} from './learn-links.mjs';
import { createValidators } from './schemas.mjs';

const subject = { file: 'subjects/maths.json', data: { id: 'gcse-maths', level: 'GCSE' } };
const tree = {
  file: 'topic-trees/t.json',
  data: {
    id: 'tree',
    subject: 'gcse-maths',
    board: 'edexcel',
    topics: [{ id: 'unit', title: 'U', children: [{ id: 'gcse-maths-h-a17', title: 'Linear' }] }],
  },
};
const link = (extra = {}) => ({
  title: 'Solving linear equations',
  url: 'https://www.bbc.co.uk/bitesize/guides/example/revision/1',
  provider: 'bitesize',
  level: 'GCSE',
  checked_at: '2026-11-25',
  ...extra,
});
const content = (data, file = 'learn-links/gcse-maths-h-a17.json') => ({
  subjects: [subject],
  topicTrees: [tree],
  learnLinks: [{ file, data }],
});

test('the learn links schema accepts a well-formed file', () => {
  const { learnLinks } = createValidators();
  assert.equal(learnLinks({ topic: 'gcse-maths-h-a17', links: [link()] }), true);
  assert.equal(
    learnLinks({ topic: 'gcse-maths-h-a17', links: [link({ checked_at: null })] }),
    true,
  );
  assert.equal(
    learnLinks({ topic: 'gcse-maths-h-a17', links: [link({ board: 'edexcel' })] }),
    true,
  );
});

test('the learn links schema rejects missing fields, other providers and plain http', () => {
  const { learnLinks } = createValidators();
  assert.equal(learnLinks({ topic: 'x', links: [] }), false);
  assert.equal(learnLinks({ topic: 'x', links: [link({ provider: 'youtube' })] }), false);
  assert.equal(
    learnLinks({ topic: 'x', links: [link({ url: 'http://www.bbc.co.uk/bitesize' })] }),
    false,
  );
  assert.equal(learnLinks({ topic: 'x', links: [link({ checked_at: 'yesterday' })] }), false);
  const noTitle = link();
  delete noTitle.title;
  assert.equal(learnLinks({ topic: 'x', links: [noTitle] }), false);
});

test('a good learn links file has no errors', () => {
  assert.deepEqual(learnLinkErrors(content({ topic: 'gcse-maths-h-a17', links: [link()] })), []);
});

test('links must belong to a real topic, named in the file name', () => {
  const errors = learnLinkErrors(
    content({ topic: 'gcse-maths-h-zz', links: [link()] }, 'learn-links/gcse-maths-h-zz.json'),
  );
  assert.match(errors[0].message, /topic gcse-maths-h-zz does not exist/);
  const named = learnLinkErrors(
    content({ topic: 'gcse-maths-h-a17', links: [link()] }, 'learn-links/other.json'),
  );
  assert.match(named[0].message, /file name must be gcse-maths-h-a17\.json/);
});

test("a link's host must match its provider", () => {
  const errors = learnLinkErrors(
    content({
      topic: 'gcse-maths-h-a17',
      links: [
        link({ provider: 'oak' }),
        link({ url: 'https://www.bbc.co.uk.example.com/bitesize/x' }),
      ],
    }),
  );
  assert.equal(errors.length, 2);
  assert.match(errors[0].message, /oak links must be on www\.thenational\.academy/);
  assert.deepEqual(PROVIDER_HOSTS.oak, { host: 'www.thenational.academy', path: '/' });
});

test("a link's level and board must match the topic's subject and topic tree", () => {
  const errors = learnLinkErrors(
    content({
      topic: 'gcse-maths-h-a17',
      links: [
        link({ level: 'A-Level' }),
        link({ url: 'https://www.bbc.co.uk/bitesize/b', board: 'aqa' }),
      ],
    }),
  );
  assert.equal(errors.length, 2);
  assert.match(errors[0].message, /level A-Level does not match the subject \(GCSE\)/);
  assert.match(errors[1].message, /board aqa does not match the topic tree \(edexcel\)/);
});

test('the same URL is not listed twice for a topic', () => {
  const errors = learnLinkErrors(content({ topic: 'gcse-maths-h-a17', links: [link(), link()] }));
  assert.match(errors[0].message, /listed twice/);
});

test('2xx and 3xx count as working; anything else is broken', () => {
  assert.equal(isWorkingStatus(200), true);
  assert.equal(isWorkingStatus(301), true);
  assert.equal(isWorkingStatus(399), true);
  assert.equal(isWorkingStatus(404), false);
  assert.equal(isWorkingStatus(500), false);
  assert.equal(isWorkingStatus(199), false);
});

test('the link check requests every URL and reports broken ones and network errors', async () => {
  const seen = [];
  const fakeFetch = async (url, init) => {
    seen.push([url, init.method, init.redirect]);
    if (url.endsWith('/gone')) return { status: 404 };
    if (url.endsWith('/down')) throw new Error('getaddrinfo ENOTFOUND');
    return { status: url.endsWith('/moved') ? 301 : 200 };
  };
  const results = await checkLinks(
    [
      { file: 'a.json', url: 'https://x/ok' },
      { file: 'a.json', url: 'https://x/moved' },
      { file: 'b.json', url: 'https://x/gone' },
      { file: 'b.json', url: 'https://x/down' },
    ],
    { fetch: fakeFetch },
  );
  assert.deepEqual(
    results.map((r) => [r.url, r.ok, r.status]),
    [
      ['https://x/ok', true, 200],
      ['https://x/moved', true, 301],
      ['https://x/gone', false, 404],
      ['https://x/down', false, 'getaddrinfo ENOTFOUND'],
    ],
  );
  assert.deepEqual(seen[0], ['https://x/ok', 'GET', 'manual']);
});

test('listLinks flattens every file into one list of URLs', () => {
  assert.deepEqual(
    listLinks([
      { file: 'f.json', data: { topic: 't', links: [link(), link({ url: 'https://u' })] } },
    ]),
    [
      { file: 'f.json', topic: 't', url: link().url },
      { file: 'f.json', topic: 't', url: 'https://u' },
    ],
  );
});

test('content validation includes the learn links checks', async () => {
  const { validateContent } = await import('./validate.mjs');
  const { loadContent } = await import('./validate.mjs');
  const { mkdtempSync, mkdirSync, writeFileSync, cpSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const repoContent = join(dirname(fileURLToPath(import.meta.url)), '../../content');
  const root = mkdtempSync(join(tmpdir(), 'learn-links-'));
  cpSync(join(repoContent, 'subjects'), join(root, 'subjects'), { recursive: true });
  cpSync(join(repoContent, 'topic-trees'), join(root, 'topic-trees'), { recursive: true });
  mkdirSync(join(root, 'learn-links'));
  writeFileSync(
    join(root, 'learn-links', 'gcse-maths-h-a17.json'),
    JSON.stringify({ topic: 'gcse-maths-h-a17', links: [link({ provider: 'oak' })] }),
  );
  const loaded = await loadContent(root);
  assert.equal(loaded.learnLinks.length, 1);
  const errors = await validateContent(loaded, { checkMaths: null });
  assert.ok(
    errors.some((e) => /oak links must be on/.test(e.message)),
    JSON.stringify(errors),
  );
});
