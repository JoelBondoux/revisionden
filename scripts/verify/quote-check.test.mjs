import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  QUOTE_CHECK_TOOL,
  applyQuoteCheck,
  checkCitation,
  quoteCheckContent,
} from './quote-check.mjs';
import { buildPdf } from './test-pdf.mjs';
import { draftItem, quoted, verifiedRecord } from './test-content.mjs';

const SPEC_URL = 'https://qualifications.pearson.com/fixture-spec.pdf';
const PAGE_URL = 'https://www.gov.uk/fixture-subject-content';
const SPEC = buildPdf([
  ['Fixture specification', 'Contents'],
  ['Algebra', 'A17 solve linear equations in one unknown algebraically'],
]);
const PAGE = new TextEncoder().encode('<h2>A17</h2><p>solve linear equations in one unknown</p>');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const AT = new Date('2026-11-24T12:00:00Z');

function fakeStore(extra = {}) {
  const docs = {
    [SPEC_URL]: { bytes: SPEC, contentType: 'application/pdf' },
    [PAGE_URL]: { bytes: PAGE, contentType: 'text/html' },
    ...extra,
  };
  const calls = [];
  return {
    calls,
    async get(url) {
      calls.push(url);
      const d = docs[url];
      if (!d) throw new Error(`${url}: download failed: HTTP 404`);
      return { url, ...d, sha256: sha(d.bytes), retrievedAt: AT.toISOString(), fromCache: false };
    },
  };
}

test('a quote on the stated page of the PDF passes and records the source hash', async () => {
  const c = quoted({
    url: SPEC_URL,
    location: 'page 2, A17',
    quote: 'solve linear equations in one unknown',
  });
  const r = await checkCitation(c, fakeStore());
  assert.equal(r.result, 'pass');
  assert.equal(r.page, 2);
  assert.equal(r.sha256, sha(SPEC));
});

test('a quote on the wrong page fails', async () => {
  const c = quoted({ url: SPEC_URL, location: 'page 1', quote: 'solve linear equations' });
  const r = await checkCitation(c, fakeStore());
  assert.equal(r.result, 'fail');
  assert.match(r.reason, /found on page 2, not page 1/);
});

test('a quote that is not in the source fails', async () => {
  const c = quoted({ url: SPEC_URL, location: 'page 2', quote: 'solve simultaneous equations' });
  const r = await checkCitation(c, fakeStore());
  assert.equal(r.result, 'fail');
  assert.equal(r.reason, 'quote not found in the source');
});

test('a quote on a web page passes when the specification code is next to it', async () => {
  const c = quoted({ url: PAGE_URL, location: 'A17', quote: 'solve linear equations' });
  assert.equal((await checkCitation(c, fakeStore())).result, 'pass');
});

test('a citation without a quote fails without downloading anything', async () => {
  const store = fakeStore();
  const c = { ...quoted({ url: SPEC_URL }), quote: undefined, retrieved_at: undefined };
  const r = await checkCitation(c, store);
  assert.equal(r.result, 'fail');
  assert.equal(r.reason, 'the citation has no quote yet');
  assert.equal(store.calls.length, 0);
});

test('a source that cannot be downloaded fails the citation with the reason', async () => {
  const c = quoted({ url: 'https://www.aqa.org.uk/missing.pdf', location: 'page 1' });
  const r = await checkCitation(c, fakeStore());
  assert.equal(r.result, 'fail');
  assert.match(r.reason, /HTTP 404/);
});

test('checks every citation of every item and passes an item only if all of them pass', async () => {
  const good = quoted({ url: SPEC_URL, location: 'page 2', quote: 'solve linear equations' });
  const bad = quoted({ url: SPEC_URL, location: 'page 2', quote: 'not in the source' });
  const content = {
    items: [
      { file: 'items/a.json', data: draftItem('fixture-item-good', [good]) },
      { file: 'items/a.json', data: draftItem('fixture-item-bad', [good, bad]) },
    ],
    topicTrees: [],
    markSchemes: [],
    diagrams: [],
  };
  const store = fakeStore();
  const results = await quoteCheckContent(content, { store, now: () => AT });
  assert.deepEqual(
    results.map((r) => [r.id, r.result]),
    [
      ['fixture-item-good', 'pass'],
      ['fixture-item-bad', 'fail'],
    ],
  );
  assert.equal(results[1].citations[1].reason, 'quote not found in the source');
  assert.deepEqual(results[0].check, {
    name: 'quote-check',
    result: 'pass',
    tool: QUOTE_CHECK_TOOL.name,
    tool_version: QUOTE_CHECK_TOOL.version,
    at: '2026-11-24T12:00:00Z',
    notes: `citation 1: found on page 2 (sha256 ${sha(SPEC)})`,
  });
});

test('can limit the check to one id', async () => {
  const c = quoted({ url: SPEC_URL, location: 'page 2', quote: 'solve linear equations' });
  const content = {
    items: [
      { file: 'f', data: draftItem('fixture-a', [c]) },
      { file: 'f', data: draftItem('fixture-b', [c]) },
    ],
  };
  const results = await quoteCheckContent(content, {
    store: fakeStore(),
    now: () => AT,
    only: 'fixture-b',
  });
  assert.deepEqual(
    results.map((r) => r.id),
    ['fixture-b'],
  );
});

test('checks the citations of every leaf of a topic tree as one record', async () => {
  const c = quoted({ url: SPEC_URL, location: 'page 2', quote: 'solve linear equations' });
  const tree = {
    id: 'fixture-tree',
    topics: [{ id: 'fixture-parent', children: [{ id: 'fixture-leaf', citations: [c] }] }],
    verification: { status: 'draft', version: 1, checks: [] },
  };
  const results = await quoteCheckContent(
    { topicTrees: [{ file: 't.json', data: tree }] },
    { store: fakeStore(), now: () => AT },
  );
  assert.equal(results.length, 1);
  assert.equal(results[0].kind, 'topicTrees');
  assert.equal(results[0].result, 'pass');
});

test('writing the result adds the check and the source hash to a draft item', async () => {
  const c = quoted({ url: SPEC_URL, location: 'page 2', quote: 'solve linear equations' });
  const item = draftItem('fixture-a', [c]);
  item.verification.checks.push({
    name: 'quote-check',
    result: 'fail',
    tool: 'x',
    tool_version: '0',
    at: '2026-01-01T00:00:00Z',
  });
  const [result] = await quoteCheckContent(
    { items: [{ file: 'f', data: item }] },
    {
      store: fakeStore(),
      now: () => AT,
    },
  );
  const updated = applyQuoteCheck(item, result);
  assert.equal(updated.citations[0].sha256, sha(SPEC));
  assert.equal(updated.verification.checks.length, 1);
  assert.equal(updated.verification.checks[0].result, 'pass');
  assert.equal(item.verification.checks[0].result, 'fail', 'the input is not changed');
});

test('writing to verified content is refused, because verified versions are immutable', () => {
  const item = { ...draftItem('fixture-a', [quoted()]), verification: verifiedRecord() };
  assert.throws(
    () => applyQuoteCheck(item, { citations: [], check: {} }),
    /verified version 1 is immutable/,
  );
});
