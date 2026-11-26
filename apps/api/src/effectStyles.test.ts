import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EffectStylesResponseSchema } from '@revisionden/core';
import { rewards } from '@revisionden/db';
import { createTestContext, type TestContext } from './test/helpers';

// J10b: which effect styles a student has unlocked, worked out from their earned rewards
// (Pop Burst with the level 5 reward, Starlight with 10 topics mastered). Sticker Book is
// everyone's default, so it is never listed.
let t: TestContext;

beforeAll(async () => {
  t = await createTestContext();
});

afterAll(async () => {
  await t.close();
});

async function styles(headers: Record<string, string>) {
  const res = await t.app.request('/v1/student/rewards/effect-styles', { headers });
  expect(res.status).toBe(200);
  return EffectStylesResponseSchema.parse(await res.json());
}

describe('effect styles a student has unlocked', () => {
  it('lists none for a new student', async () => {
    const { headers } = await t.familyStudent('es_new');
    expect(await styles(headers)).toEqual({ unlocked: [] });
  });

  it('lists the styles that come with earned rewards', async () => {
    const { studentId, headers } = await t.familyStudent('es_some');
    await t.db.insert(rewards).values([
      { studentId, rewardId: 'level-4' },
      { studentId, rewardId: 'level-5' },
    ]);
    expect(await styles(headers)).toEqual({ unlocked: ['pop-burst'] });
    await t.db.insert(rewards).values({ studentId, rewardId: 'topics-mastered-10' });
    expect(await styles(headers)).toEqual({ unlocked: ['pop-burst', 'starlight'] });
  });

  it('needs a signed-in student device', async () => {
    expect((await t.app.request('/v1/student/rewards/effect-styles')).status).toBe(401);
  });
});
