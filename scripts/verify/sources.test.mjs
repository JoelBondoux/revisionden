import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ALLOWED_HOSTS, createSourceStore, isAllowedSource } from './sources.mjs';

const tempDir = () => mkdtemp(join(tmpdir(), 'rd-sources-'));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

function fakeFetch(responses) {
  const calls = [];
  const fetch = async (url) => {
    calls.push(url);
    const r = responses[url];
    if (!r) throw new Error(`unexpected fetch ${url}`);
    return new Response(r.body, {
      status: r.status ?? 200,
      headers: { 'content-type': r.type ?? 'text/html' },
    });
  };
  return { fetch, calls };
}

const URL_A = 'https://qualifications.pearson.com/spec.pdf';

test('allows only the official exam board and government hosts over https', () => {
  assert.ok(ALLOWED_HOSTS.includes('www.aqa.org.uk'));
  assert.equal(isAllowedSource('https://www.ocr.org.uk/a.pdf'), true);
  assert.equal(isAllowedSource('https://assets.publishing.service.gov.uk/x.pdf'), true);
  assert.equal(isAllowedSource('http://www.aqa.org.uk/a.pdf'), false);
  assert.equal(isAllowedSource('https://www.revision-site.example/a'), false);
  assert.equal(isAllowedSource('https://aqa.org.uk.evil.example/a'), false);
  assert.equal(isAllowedSource('not a url'), false);
});

test('fetches a source once and then serves it from the cache', async () => {
  const cacheDir = await tempDir();
  const { fetch, calls } = fakeFetch({ [URL_A]: { body: 'hello', type: 'application/pdf' } });
  const now = () => new Date('2026-11-24T09:00:00Z');
  const store = createSourceStore({ cacheDir, fetch, now, repoRoot: '/nowhere' });

  const first = await store.get(URL_A);
  assert.equal(new TextDecoder().decode(first.bytes), 'hello');
  assert.equal(first.contentType, 'application/pdf');
  assert.equal(first.sha256, sha('hello'));
  assert.equal(first.retrievedAt, '2026-11-24T09:00:00.000Z');
  assert.equal(first.fromCache, false);

  const second = await store.get(URL_A);
  assert.equal(second.fromCache, true);
  assert.equal(second.sha256, first.sha256);
  assert.equal(second.retrievedAt, first.retrievedAt);
  assert.equal(calls.length, 1);
  assert.equal((await readdir(cacheDir)).length, 2);
});

test('fetches again when asked to refresh', async () => {
  const cacheDir = await tempDir();
  const { fetch, calls } = fakeFetch({ [URL_A]: { body: 'v1' } });
  const store = createSourceStore({ cacheDir, fetch, repoRoot: '/nowhere' });
  await store.get(URL_A);
  await store.get(URL_A, { refresh: true });
  assert.equal(calls.length, 2);
});

test('refuses to fetch from a host that is not an official source', async () => {
  const store = createSourceStore({
    cacheDir: await tempDir(),
    fetch: fakeFetch({}).fetch,
    repoRoot: '/nowhere',
  });
  await assert.rejects(
    store.get('https://www.revision-site.example/notes'),
    /not an allowed official source/,
  );
});

test('reports a failed download', async () => {
  const { fetch } = fakeFetch({ [URL_A]: { body: 'gone', status: 404 } });
  const store = createSourceStore({ cacheDir: await tempDir(), fetch, repoRoot: '/nowhere' });
  await assert.rejects(store.get(URL_A), /download failed: HTTP 404/);
});

test('refuses a redirect that lands on a host that is not allowed', async () => {
  const fetch = async () => {
    const res = new Response('x', { status: 200 });
    Object.defineProperty(res, 'url', { value: 'https://www.other.example/x' });
    return res;
  };
  const store = createSourceStore({ cacheDir: await tempDir(), fetch, repoRoot: '/nowhere' });
  await assert.rejects(store.get(URL_A), /redirected to a host that is not allowed/);
});

test('never keeps the cache inside the repository, which is public', () => {
  assert.throws(
    () => createSourceStore({ cacheDir: '/repo/cache', repoRoot: '/repo', fetch: async () => {} }),
    /must be outside the repository/,
  );
});
