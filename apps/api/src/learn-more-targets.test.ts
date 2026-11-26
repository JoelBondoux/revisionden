import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FlashcardsOverviewSchema, LessonResponseSchema } from '@revisionden/core';
import { syncContent, type ContentItem, type ContentTopicTree } from './learning/content-sync';
import { createTestContext, type TestContext } from './test/helpers';
import { testItems } from './test/learning-fixtures';

/**
 * Learn more (Q6b): lesson items and flashcards say which content item and learning point they
 * come from, so the app can show the most specific links. Made-up content, not educational.
 */
const SUBJECT = 'targets-subject';
const card = testItems.find((i) => i.id === 'test-card-0001')!;
const short = testItems.find((i) => i.id === 'test-short-0001')!;
const tree: ContentTopicTree = {
  id: 'targets-tree',
  subject: SUBJECT,
  board: 'test-board',
  topics: [
    {
      id: 'tg-unit',
      title: 'Targets unit',
      children: [{ id: 'tg-topic', title: 'Targets topic', spec_ref: ['T1'], citations: [] }],
    },
  ],
};
const content: ContentItem[] = [
  {
    ...short,
    id: 'tg-short',
    topic: 'tg-topic',
    learning_point: 'tg-topic-lp-one',
    prompt: 'Targets question',
  },
  { ...card, id: 'tg-card', topic: 'tg-topic', learning_point: 'tg-topic-lp-two' },
  { ...card, id: 'tg-plain', topic: 'tg-topic', front: 'Plain front', back: 'Plain back' },
];

let t: TestContext;

beforeAll(async () => {
  t = await createTestContext();
  await syncContent(t.db, { topicTrees: [tree], items: content });
});

afterAll(async () => {
  await t.close();
});

describe('Learn more targets', () => {
  it('gives each lesson item its content id and learning point', async () => {
    const { headers } = await t.familyStudent('tg_lesson', [SUBJECT]);
    const res = await t.app.request('/v1/student/learn/lesson?topicId=tg-topic', { headers });
    expect(res.status).toBe(200);
    const { items } = LessonResponseSchema.parse(await res.json());
    const question = items.find((i) => i.type === 'short_answer')!;
    expect(question.contentId).toBe('tg-short');
    expect(question.learningPoint).toBe('tg-topic-lp-one');
  });

  it('gives each deck flashcard its content id and learning point, when it has one', async () => {
    const { headers } = await t.familyStudent('tg_cards', [SUBJECT]);
    const res = await t.app.request('/v1/student/flashcards', { headers });
    expect(res.status).toBe(200);
    const { due } = FlashcardsOverviewSchema.parse(await res.json());
    const tagged = due.find((c) => c.contentId === 'tg-card')!;
    expect(tagged.learningPoint).toBe('tg-topic-lp-two');
    const plain = due.find((c) => c.contentId === 'tg-plain')!;
    expect(plain).not.toHaveProperty('learningPoint');
  });
});
