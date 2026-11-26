import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FlashcardsOverviewSchema } from '@revisionden/core';
import { syncContent, type ContentItem, type ContentTopicTree } from './learning/content-sync';
import { createTestContext, jsonRequest, type TestContext } from './test/helpers';
import { testItems } from './test/learning-fixtures';

type H = Record<string, string>;

/** Made-up content (not educational), checked like real content. */
const SUBJECT = 'explain-subject';
const card = testItems.find((i) => i.id === 'test-card-0001')!;
const short = testItems.find((i) => i.id === 'test-short-0001')!;
const tree: ContentTopicTree = {
  id: 'explain-tree',
  subject: SUBJECT,
  board: 'test-board',
  topics: [
    {
      id: 'ex-unit',
      title: 'Explain unit',
      children: [{ id: 'ex-topic', title: 'Explain topic', spec_ref: ['E1'], citations: [] }],
    },
  ],
};
const content: ContentItem[] = [
  {
    ...card,
    id: 'ex-formula',
    topic: 'ex-topic',
    front: 'Formula front',
    back: 'Formula back',
    back_formula: { formula: 'y = m*x + c', conditions: ['m is the gradient'] },
  },
  { ...card, id: 'ex-plain', topic: 'ex-topic', front: 'Plain front', back: 'Plain back' },
  {
    ...short,
    id: 'ex-short',
    topic: 'ex-topic',
    prompt: 'Explain question',
    answer: { accepted: ['right'] },
    mark_scheme: ['Point one', 'Point two'],
  },
];

let t: TestContext;
let shortId: string;

beforeAll(async () => {
  t = await createTestContext();
  await syncContent(t.db, { topicTrees: [tree], items: content });
  const lesson = (await (
    await t.app.request('/v1/student/learn/lesson?topicId=ex-topic', {
      headers: (await t.familyStudent('ex_probe', [SUBJECT])).headers,
    })
  ).json()) as { items: { id: string; prompt?: string }[] };
  shortId = lesson.items.find((i) => i.prompt === 'Explain question')!.id;
});

afterAll(async () => {
  await t.close();
});

async function cards(headers: H) {
  const res = await t.app.request('/v1/student/flashcards', { headers });
  expect(res.status).toBe(200);
  return FlashcardsOverviewSchema.parse(await res.json()).due;
}

describe('Explain steps on flashcards (F7, verified content only)', () => {
  it('gives a formula card its formula, conditions and answer as steps', async () => {
    const { headers } = await t.familyStudent('ex_formula', [SUBJECT]);
    const due = await cards(headers);
    expect(due.find((c) => c.front === 'Formula front')?.explain).toEqual([
      'Formula: y = m*x + c',
      'Condition: m is the gradient',
      'Answer: Formula back',
    ]);
  });

  it('gives a card without steps no explain list', async () => {
    const { headers } = await t.familyStudent('ex_plain', [SUBJECT]);
    const due = await cards(headers);
    expect(due.find((c) => c.front === 'Plain front')).not.toHaveProperty('explain');
  });

  it('explains a card made from a missed question with its mark scheme', async () => {
    const { headers } = await t.familyStudent('ex_missed', [SUBJECT]);
    const res = await t.app.request(
      '/v1/student/learn/attempts',
      jsonRequest(
        'POST',
        { itemId: shortId, answer: 'wrong', timeMs: 1000, mode: 'learn' },
        headers,
      ),
    );
    expect(res.status).toBe(200);
    const due = await cards(headers);
    expect(due.find((c) => c.front === 'Explain question')?.explain).toEqual([
      'Point one',
      'Point two',
      'Answer: right',
    ]);
  });
});
