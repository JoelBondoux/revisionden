import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import {
  DailySetResponseSchema,
  LessonResponseSchema,
  ProgressSchema,
  StartingTestResponseSchema,
  UnmarkedAttemptResponseSchema,
} from '@revisionden/core';
import { attempts, items } from '@revisionden/db';
import { syncContent } from './learning/content-sync';
import { createTestContext, jsonRequest, type TestContext } from './test/helpers';
import { TEST_SUBJECT, testItems, testTopicTree } from './test/learning-fixtures';

type H = Record<string, string>;

/** No maths engine is set up (MATHS_ENGINE_URL unset, owner bug RD-JE5DWP): F12. */
let t: TestContext;
let workedId: string;

beforeAll(async () => {
  t = await createTestContext();
  await syncContent(t.db, { topicTrees: [testTopicTree], items: testItems });
  const [row] = await t.db.select().from(items).where(eq(items.contentId, 'test-work-0001'));
  workedId = row!.id;
});

afterAll(async () => {
  await t.close();
});

const get = (path: string, headers: H) => t.app.request(path, { headers });

describe('without the maths engine, typed working is skipped (F12)', () => {
  it('leaves typed-working questions out of lessons', async () => {
    const { headers } = await t.familyStudent('noengine_lesson', [TEST_SUBJECT]);
    const res = await get('/v1/student/learn/lesson?topicId=test-topic-b&count=20', headers);
    expect(res.status).toBe(200);
    const lesson = LessonResponseSchema.parse(await res.json());
    expect(lesson.items.length).toBeGreaterThan(0);
    expect(lesson.items.map((i) => i.type)).not.toContain('worked_maths');
  });

  it('leaves them out of the starting test and the 5-a-day', async () => {
    const { headers } = await t.familyStudent('noengine_start', [TEST_SUBJECT]);
    const started = await t.app.request(
      '/v1/student/learn/starting-tests',
      jsonRequest('POST', { subjectId: TEST_SUBJECT }, headers),
    );
    expect(started.status).toBe(201);
    const test = StartingTestResponseSchema.parse(await started.json());
    expect(test.items.map((i) => i.type)).not.toContain('worked_maths');
    const daily = DailySetResponseSchema.parse(
      await (await get('/v1/student/daily', headers)).json(),
    );
    expect(daily.items.map((i) => i.type)).not.toContain('worked_maths');
  });

  it('says one answered anyway is unmarked, and records nothing: no XP, streak or mastery', async () => {
    const { headers, studentId } = await t.familyStudent('noengine_answer', [TEST_SUBJECT]);
    const before = ProgressSchema.parse(
      await (await get('/v1/student/learn/progress', headers)).json(),
    );
    const res = await t.app.request(
      '/v1/student/learn/attempts',
      jsonRequest(
        'POST',
        { itemId: workedId, answer: { lines: ['x = 2'] }, timeMs: 1000, mode: 'learn' },
        headers,
      ),
    );
    expect(res.status).toBe(200);
    expect(UnmarkedAttemptResponseSchema.parse(await res.json())).toEqual({
      unmarked: true,
      itemId: workedId,
    });
    const saved = await t.db
      .select()
      .from(attempts)
      .where(and(eq(attempts.studentId, studentId), eq(attempts.itemId, workedId)));
    expect(saved).toEqual([]);
    const after = ProgressSchema.parse(
      await (await get('/v1/student/learn/progress', headers)).json(),
    );
    expect(after).toEqual(before);
  });
});
