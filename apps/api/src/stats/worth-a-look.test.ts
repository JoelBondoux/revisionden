import { afterEach, describe, expect, it } from 'vitest';
import { reviewPoints, topics } from '@revisionden/db';
import { WorthALookSchema } from '@revisionden/core';
import { createTestContext, type TestContext } from '../test/helpers';

let ctx: TestContext;
afterEach(async () => ctx?.close());

/** Made-up topics; not educational content. */
async function seedTopics(db: TestContext['db']) {
  await db.insert(topics).values([
    { id: 'wal-topic-a', subjectId: 'gcse-maths', board: 'test-board', title: 'Demo topic A' },
    { id: 'wal-topic-b', subjectId: 'gcse-maths', board: 'test-board', title: 'Demo topic B' },
  ]);
}

const point = (studentId: string, learningPoint: string, topicId: string, flagged: boolean) => ({
  studentId,
  learningPoint,
  topicId,
  dueDay: '2026-12-01',
  misses: flagged ? 3 : 1,
  flagged,
});

describe('GET /v1/students/:id/worth-a-look (parent)', () => {
  it('lists the topics with points flagged as tricky, one entry per topic', async () => {
    ctx = await createTestContext();
    const { studentId, parent } = await ctx.familyStudent('wal_kid');
    await seedTopics(ctx.db);
    await ctx.db
      .insert(reviewPoints)
      .values([
        point(studentId, 'lp-1', 'wal-topic-b', true),
        point(studentId, 'lp-2', 'wal-topic-b', true),
        point(studentId, 'lp-3', 'wal-topic-a', true),
        point(studentId, 'lp-4', 'wal-topic-a', false),
      ]);
    const res = await ctx.app.request(`/v1/students/${studentId}/worth-a-look`, {
      headers: parent.headers,
    });
    expect(res.status).toBe(200);
    expect(WorthALookSchema.parse(await res.json())).toEqual({
      topics: [
        { topicId: 'wal-topic-a', title: 'Demo topic A', points: 1 },
        { topicId: 'wal-topic-b', title: 'Demo topic B', points: 2 },
      ],
    });
  });

  it('is empty when nothing is flagged', async () => {
    ctx = await createTestContext();
    const { studentId, parent } = await ctx.familyStudent('wal_kid');
    const res = await ctx.app.request(`/v1/students/${studentId}/worth-a-look`, {
      headers: parent.headers,
    });
    expect(await res.json()).toEqual({ topics: [] });
  });

  it("never shows another family's child, and is not for the child's own device", async () => {
    ctx = await createTestContext();
    const { studentId, headers } = await ctx.familyStudent('wal_kid');
    const other = await ctx.signInParent();
    const path = `/v1/students/${studentId}/worth-a-look`;
    expect((await ctx.app.request(path, { headers: other.headers })).status).toBe(404);
    expect((await ctx.app.request(path, { headers })).status).toBe(401);
    expect((await ctx.app.request(path)).status).toBe(401);
  });
});
