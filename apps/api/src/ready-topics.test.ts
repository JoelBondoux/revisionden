import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TopicMapSchema } from '@revisionden/core';
import type { ContentItem, ContentTopicTree } from './learning/content-sync';
import { syncContent } from './learning/content-sync';
import { createTestContext, type TestContext } from './test/helpers';
import { testItems, testTopicTree } from './test/learning-fixtures';

/*
 * UX-3: no dead-end lessons. A topic counts as ready on the map (and in the subject's topic list)
 * only when a lesson on it would find a question: typed working needs the maths engine (F12), and
 * the interactive pilot steps only show for a weak spot (W8). Made-up content only.
 */

const SUBJECT = 'ready-subject';
const tree: ContentTopicTree = {
  id: 'ready-tree',
  subject: SUBJECT,
  board: 'test-board',
  topics: [
    {
      id: 'ready-unit',
      title: 'Ready unit',
      children: ['ready', 'working-only', 'pilot-only'].map((name) => ({
        id: `ready-topic-${name}`,
        title: `Topic ${name}`,
        spec_ref: ['R1'],
        citations: testTopicCitations(),
      })),
    },
  ],
};

function testTopicCitations() {
  return testTopicTree.topics[0]!.children![0]!.citations;
}

const like = (id: string) => testItems.find((i) => i.id === id)!;
const items: ContentItem[] = [
  { ...like('test-mc-0001'), id: 'ready-mc-0001', topic: 'ready-topic-ready' },
  { ...like('test-work-0001'), id: 'ready-work-0001', topic: 'ready-topic-working-only' },
  {
    ...like('test-mc-0001'),
    id: 'ready-pilot-0001',
    topic: 'ready-topic-pilot-only',
    tags: ['interactive-pilot'],
  },
];

let t: TestContext;

beforeAll(async () => {
  t = await createTestContext(); // no maths engine
  await syncContent(t.db, { topicTrees: [tree], items });
});

afterAll(async () => {
  await t.close();
});

describe('which topics are ready for a lesson (UX-3)', () => {
  it('locks topics on the map whose only questions a lesson would leave out', async () => {
    const { headers } = await t.familyStudent('ready_map', [SUBJECT]);
    const res = await t.app.request(`/v1/student/map?subjectId=${SUBJECT}`, { headers });
    expect(res.status).toBe(200);
    const map = TopicMapSchema.parse(await res.json());
    const status = Object.fromEntries(
      map.units.flatMap((u) => u.topics).map((x) => [x.id, x.status]),
    );
    expect(status).toEqual({
      'ready-topic-ready': 'in-progress',
      'ready-topic-working-only': 'locked',
      'ready-topic-pilot-only': 'locked',
    });
    expect(map.nextMission?.lessonId).toBe('ready-topic-ready');
  });

  it("lists only topics with lesson questions on the subject's page", async () => {
    const { headers } = await t.familyStudent('ready_list', [SUBJECT]);
    const res = await t.app.request(`/v1/student/learn/subjects/${SUBJECT}/topics`, { headers });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { topics: { topicId: string; items: number }[] };
    expect(body.topics.map((x) => x.topicId)).toEqual(['ready-topic-ready']);
  });
});
