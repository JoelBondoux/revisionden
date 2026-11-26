import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EFFECT_STYLE_UNLOCKS, EffectStylesResponseSchema } from '@revisionden/core';
import { eq } from 'drizzle-orm';
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

  it('never lists tester styles outside development: a locked style stays locked', async () => {
    const { headers } = await t.familyStudent('es_locked');
    const body = await styles(headers);
    expect(body.testerStyles).toBeUndefined();
    expect(body.unlocked).not.toContain('pixel-arcade');
  });

  it('needs a signed-in student device', async () => {
    expect((await t.app.request('/v1/student/rewards/effect-styles')).status).toBe(401);
  });
});

// J12c: on the dev environment only (STYLE_TESTER with ENVIRONMENT=development), testers may try
// every style. The response says so; nothing is unlocked or recorded for real.
describe('the dev style tester', () => {
  let dev: TestContext;

  beforeAll(async () => {
    dev = await createTestContext({ config: { styleTester: true } });
  });

  afterAll(async () => {
    await dev.close();
  });

  it('lists every style a tester may try, and still only the really unlocked ones', async () => {
    const { studentId, headers } = await dev.familyStudent('es_tester');
    const res = await dev.app.request('/v1/student/rewards/effect-styles', { headers });
    const body = EffectStylesResponseSchema.parse(await res.json());
    expect(body.unlocked).toEqual([]);
    expect(body.testerStyles).toEqual(EFFECT_STYLE_UNLOCKS.map((u) => u.style));
    // Trying styles grants nothing.
    expect(await dev.db.select().from(rewards).where(eq(rewards.studentId, studentId))).toEqual([]);
  });
});
