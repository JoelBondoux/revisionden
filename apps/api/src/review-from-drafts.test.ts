import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { items, reviewerRoles } from '@revisionden/db';
import { syncContent, type ContentItem } from './learning/content-sync';
import { testTopicTree } from './test/learning-fixtures';
import { createTestContext, jsonRequest, type TestContext } from './test/helpers';

// Made-up content: not educational, every question and citation is fake on purpose.
const passed = (names: string[]) =>
  names.map((name) => ({ name, result: 'pass', tool: 't', tool_version: '1', at: 'x' }));
const automated = [
  'grounded-writing',
  'quote-check',
  'blind-answer',
  'adversarial-review',
  'schema',
];

const item = (id: string, over: Partial<ContentItem> = {}): ContentItem => ({
  id,
  topic: 'test-topic-a',
  type: 'short_answer',
  difficulty: 1,
  prompt: `Fixture question ${id}?`,
  answer: { accepted: ['fixture'] },
  source_ref: 'Test reference T1',
  checked_by: ['author'],
  citations: [{ publisher: 'Test board', location: 'T1', quote: 'fixture words' }],
  verification: { status: 'draft', version: 1, checks: passed(automated) },
  ...over,
});

const ready = item('test-ready-0001');
const failing = item('test-failing-0001', {
  verification: { status: 'draft', version: 1, checks: passed(['quote-check']) },
});
const verifiedItem = item('test-verified-0001', {
  verification: { status: 'verified', version: 1, checks: passed(automated) },
});
const proof = item('test-proof-0001', {
  type: 'extended_answer',
  answer: undefined,
  mark_scheme_ref: 'test-scheme',
  exemplars: [{ band: 'top', level: 2, answer: 'Fixture answer' }],
  verification: {
    status: 'draft',
    version: 1,
    checks: passed([...automated.filter((n) => n !== 'blind-answer'), 'blind-marking']),
  },
});
const factFailed = item('test-factfail-0001', {
  facts: [{ statement: 'Fixture fact.', ask: 'Fixture?' }],
  verification: {
    status: 'draft',
    version: 1,
    checks: [
      ...passed(automated),
      { name: 'fact-check', result: 'fail', tool: 't', tool_version: '1', at: 'x' },
    ],
  },
});
const scheme = { id: 'test-scheme', type: 'points', points: [{ code: 'B1', description: 'x' }] };

let t: TestContext;
beforeEach(async () => {
  t = await createTestContext({ verification: { randomSeed: () => 7 } });
  await syncContent(t.db, {
    topicTrees: [testTopicTree],
    items: [ready, failing, verifiedItem, proof, factFailed],
    markSchemes: [scheme],
  });
});
afterEach(async () => {
  await t.close();
});

async function reviewer(role: 'subject-specialist' | 'content-lead' = 'content-lead') {
  const user = await t.signInParent();
  await t.db.insert(reviewerRoles).values({ authUserId: user.userId, role });
  return user.headers;
}

const create = (headers: Record<string, string>, title = 'Fixture drafts') =>
  t.app.request('/v1/review/batches/from-drafts', jsonRequest('POST', { title }, headers));

describe('content sync keeps a review snapshot', () => {
  it('stores the full item with its linked mark scheme', async () => {
    const [row] = await t.db
      .select({ snapshot: items.reviewSnapshot })
      .from(items)
      .where(eq(items.contentId, 'test-proof-0001'));
    expect(row!.snapshot).toMatchObject({
      id: 'test-proof-0001',
      exemplars: [{ band: 'top', level: 2, answer: 'Fixture answer' }],
      mark_scheme_detail: scheme,
    });
  });
});

describe('a review batch from draft items', () => {
  it('counts the drafts whose automated checks all passed', async () => {
    const headers = await reviewer();
    const res = await t.app.request('/v1/review/batches/from-drafts', { headers });
    expect(await res.json()).toEqual({ ready: 3 });
  });

  it('puts only ready drafts in the batch, with their snapshots, and samples them', async () => {
    const headers = await reviewer();
    const res = await create(headers);
    expect(res.status).toBe(201);
    const created = (await res.json()) as { id: string; size: number; sample: string[] };
    expect(created.size).toBe(3);
    expect(created.sample.sort()).toEqual([
      'test-factfail-0001',
      'test-proof-0001',
      'test-ready-0001',
    ]);
    const batch = (await (
      await t.app.request(`/v1/review/batches/${created.id}`, { headers })
    ).json()) as { items: { itemId: string; needsHumanApproval: boolean; snapshot: object }[] };
    const byId = Object.fromEntries(batch.items.map((i) => [i.itemId, i]));
    expect(byId['test-proof-0001']!.needsHumanApproval).toBe(true);
    // A failed fact-check (decision 0009) means individual review, never batch sampling.
    expect(byId['test-factfail-0001']!.needsHumanApproval).toBe(true);
    expect(byId['test-ready-0001']!.needsHumanApproval).toBe(false);
    expect(byId['test-ready-0001']!.snapshot).toMatchObject({ prompt: ready.prompt });
  });

  it('does not offer an item again while its version is in an open batch', async () => {
    const headers = await reviewer();
    await create(headers);
    const again = await create(headers, 'Second');
    expect(again.status).toBe(409);
    const res = await t.app.request('/v1/review/batches/from-drafts', { headers });
    expect(await res.json()).toEqual({ ready: 0 });
  });

  it('is for content leads only', async () => {
    const res = await create(await reviewer('subject-specialist'));
    expect(res.status).toBe(403);
  });
});
