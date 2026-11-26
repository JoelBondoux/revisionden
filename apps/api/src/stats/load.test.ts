import { afterEach, describe, expect, it } from 'vitest';
import { attempts, items, topics } from '@revisionden/db';
import { createTestContext, type TestContext } from '../test/helpers';
import { loadStatsData } from './load';

let ctx: TestContext;
afterEach(async () => ctx?.close());

describe('dashboard answers (F10)', () => {
  it('carries the helped flag, so dashboards count a helped answer as wrong for mastery', async () => {
    ctx = await createTestContext();
    const { studentId } = await ctx.familyStudent('stats_helped');
    // Made-up topic and item; not educational content.
    await ctx.db
      .insert(topics)
      .values({ id: 'helped-topic', subjectId: 'gcse-maths', board: 'test-board', title: 'Demo' });
    const [item] = await ctx.db
      .insert(items)
      .values({
        topicId: 'helped-topic',
        type: 'multiple_choice',
        body: { prompt: 'Demo question' },
        answer: { key: { option: 0 } },
        status: 'verified',
      })
      .returning({ id: items.id });
    const base = {
      studentId,
      itemId: item!.id,
      correct: true,
      score: 1,
      mode: 'learn',
      xpEarned: 5,
    };
    await ctx.db.insert(attempts).values([
      { ...base, helped: true, createdAt: new Date(ctx.clock.now().getTime() - 2000) },
      { ...base, createdAt: new Date(ctx.clock.now().getTime() - 1000) },
    ]);
    const data = await loadStatsData(ctx.db, studentId, ctx.clock.now());
    expect(data.answers.map((a) => a.helped)).toEqual([true, false]);
    expect(data.answers.map((a) => a.score)).toEqual([1, 1]);
  });
});
