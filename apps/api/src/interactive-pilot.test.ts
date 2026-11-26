import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LessonResponseSchema } from '@revisionden/core';
import { mastery } from '@revisionden/db';
import { syncContent, type ContentItem } from './learning/content-sync';
import { createTestContext, type TestContext } from './test/helpers';
import { TEST_SUBJECT, testItems, testTopicTree } from './test/learning-fixtures';

// Lesson pilot W8 (owner, 2026-11-26): the area model steps show only when the topic is a weak
// spot, first in the lesson, and never in subject lessons or for a topic with no history.
const pilotStep: ContentItem = {
  id: 'test-area-0001',
  topic: 'test-topic-a',
  type: 'area_model',
  mode: 'explore',
  difficulty: 5,
  prompt: 'Make x^2 + 5x + 6 into a rectangle.',
  quadratic: { b: 5, c: 6 },
  answer: { pair: [2, 3] },
  marks: 1,
  tags: ['interactive-pilot'],
  source_ref: 'Test specification reference T1',
  checked_by: ['maths-engine'],
  verification: { status: 'verified', version: 1, checks: [] },
};

let t: TestContext;

beforeAll(async () => {
  t = await createTestContext();
  await syncContent(t.db, { topicTrees: [testTopicTree], items: [...testItems, pilotStep] });
});

afterAll(async () => {
  await t.close();
});

async function lessonTypes(headers: Record<string, string>, query: string) {
  const res = await t.app.request(`/v1/student/learn/lesson?${query}`, { headers });
  expect(res.status).toBe(200);
  return LessonResponseSchema.parse(await res.json()).items.map((i) => i.type);
}

async function studentWithMastery(nickname: string, value?: number) {
  const student = await t.familyStudent(nickname);
  if (value !== undefined) {
    await t.db
      .insert(mastery)
      .values({ studentId: student.studentId, topicId: 'test-topic-a', value: value / 100 });
  }
  return student;
}

describe('the interactive pilot in the lesson route', () => {
  it('comes first in the topic lesson when the topic is a weak spot', async () => {
    const { headers } = await studentWithMastery('pilot_weak', 59);
    const types = await lessonTypes(headers, 'topicId=test-topic-a&count=20');
    expect(types[0]).toBe('area_model');
    expect(types.filter((x) => x === 'area_model')).toHaveLength(1);
    expect(types.length).toBeGreaterThan(1);
  });

  it('is left out at exactly 60 mastery', async () => {
    const { headers } = await studentWithMastery('pilot_sixty', 60);
    expect(await lessonTypes(headers, 'topicId=test-topic-a&count=20')).not.toContain('area_model');
  });

  it('is left out for a topic with no history yet', async () => {
    const { headers } = await studentWithMastery('pilot_new');
    expect(await lessonTypes(headers, 'topicId=test-topic-a&count=20')).not.toContain('area_model');
  });

  it('is left out of a unit challenge and a subject lesson, even for a weak spot', async () => {
    const { headers } = await studentWithMastery('pilot_mixed', 30);
    expect(await lessonTypes(headers, 'topicId=test-unit&count=20')).not.toContain('area_model');
    expect(await lessonTypes(headers, `subjectId=${TEST_SUBJECT}&count=20`)).not.toContain(
      'area_model',
    );
  });
});
