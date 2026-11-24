import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { items } from '@revisionden/db';
import { syncContent, type ContentItem } from '../learning/content-sync';
import { testTopicTree } from '../test/learning-fixtures';
import { createTestContext, type TestContext } from '../test/helpers';
import { toShortAnswerQuestion } from './items';

let t: TestContext;
beforeEach(async () => {
  t = await createTestContext();
});
afterEach(async () => {
  await t.close();
});

// Made-up content in the content/ format (not educational content).
const shortAnswer: ContentItem = {
  id: 'test-roundtrip-0001',
  topic: 'test-topic-a',
  type: 'short_answer',
  difficulty: 2,
  prompt: 'Test round-trip question?',
  answer: { accepted: ['test answer', 'other answer'] },
  marks: 2,
  mark_scheme: ['B1 for test idea one', 'B1 test idea two'],
  source_ref: 'Test specification reference T1',
  checked_by: ['author'],
  citations: [],
  verification: { status: 'verified', version: 1, checks: [] },
};

describe('item JSON in the items table', () => {
  it('a short answer stored by the content sync can be marked by the AI marking', async () => {
    await syncContent(t.db, { topicTrees: [testTopicTree], items: [shortAnswer] });
    const [row] = await t.db.select().from(items).where(eq(items.contentId, shortAnswer.id));
    expect(toShortAnswerQuestion(row!)).toEqual({
      topic: 'test-topic-a',
      prompt: 'Test round-trip question?',
      marks: 2,
      acceptedAnswers: ['test answer', 'other answer'],
      points: [
        { code: 'B1', description: 'test idea one', accepted: ['test idea one'] },
        { code: 'B1', description: 'test idea two', accepted: ['test idea two'] },
      ],
    });
  });

  it('the student-facing body never holds the answer or the mark scheme', async () => {
    await syncContent(t.db, { topicTrees: [testTopicTree], items: [shortAnswer] });
    const [row] = await t.db.select().from(items).where(eq(items.contentId, shortAnswer.id));
    expect(JSON.stringify(row!.body)).not.toMatch(/test answer|test idea/);
    expect(row!.body).toMatchObject({ prompt: 'Test round-trip question?', marks: 2 });
  });
});
