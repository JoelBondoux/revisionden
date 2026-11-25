import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  LearnAttemptResponseSchema,
  LessonResponseSchema,
  StartingTestResponseSchema,
  StartingTestResultSchema,
  type LearnItem,
} from '@revisionden/core';
import { syncContent } from './learning/content-sync';
import { createTestContext, jsonRequest, type TestContext } from './test/helpers';
import { TEST_SUBJECT, testItems, testTopicTree } from './test/learning-fixtures';

type H = Record<string, string>;

let t: TestContext;

beforeAll(async () => {
  t = await createTestContext();
  await syncContent(t.db, { topicTrees: [testTopicTree], items: testItems });
});

afterAll(async () => {
  await t.close();
});

const SECONDS = 1000;
const MINUTES = 60 * SECONDS;

/** The right answer for each test item, by prompt (from the fake fixtures). */
const RIGHT: Record<string, unknown> = {
  'Test question 1': 1,
  'Test question 2': 'test answer',
  'Test question 3': '4',
};

async function mcItem(headers: H): Promise<LearnItem> {
  const res = await t.app.request('/v1/student/learn/lesson?topicId=test-topic-a&count=20', {
    headers,
  });
  const lesson = LessonResponseSchema.parse(await res.json());
  return lesson.items.find((i) => 'prompt' in i && i.prompt === 'Test question 1')!;
}

async function answer(headers: H, itemId: string, value: unknown, extra = {}) {
  t.clock.advance(20 * SECONDS);
  const res = await t.app.request(
    '/v1/student/learn/attempts',
    jsonRequest('POST', { timeMs: 1000, mode: 'learn', itemId, answer: value, ...extra }, headers),
  );
  expect(res.status).toBe(200);
  return LearnAttemptResponseSchema.parse(await res.json());
}

async function rewardXp(headers: H): Promise<number> {
  const res = await t.app.request('/v1/student/rewards', { headers });
  const body = (await res.json()) as { overview: { level: { totalXp: number } } };
  return body.overview.level.totalXp;
}

describe('combo bonus XP in Learn mode (docs/GAME_FEEL.md "XP rule")', () => {
  it('adds +5 XP to each right answer from the 3rd in a row', async () => {
    const { headers } = await t.familyStudent('combo_kid');
    const mc = await mcItem(headers);
    const results = [];
    for (let i = 0; i < 4; i += 1) results.push(await answer(headers, mc.id, 1));
    expect(results.map((r) => r.combo)).toEqual([1, 2, 3, 4]);
    expect(results.map((r) => r.comboBonusXp)).toEqual([0, 0, 5, 5]);
    expect(results.map((r) => r.xpEarned)).toEqual([10, 10, 15, 15]);
    expect(results[3]!.progress.xpToday).toBe(50);
  });

  it('counts the bonus towards reward XP (levels), like any XP from answers', async () => {
    const { headers } = await t.familyStudent('combo_reward_kid');
    const mc = await mcItem(headers);
    for (let i = 0; i < 3; i += 1) await answer(headers, mc.id, 1);
    expect(await rewardXp(headers)).toBe(35);
  });

  it('quietly resets the combo after a wrong answer', async () => {
    const { headers } = await t.familyStudent('combo_reset_kid');
    const mc = await mcItem(headers);
    await answer(headers, mc.id, 1);
    await answer(headers, mc.id, 1);
    const wrong = await answer(headers, mc.id, 0);
    expect(wrong).toMatchObject({ combo: 0, comboBonusXp: 0, xpEarned: 0 });
    const next = await answer(headers, mc.id, 1);
    expect(next).toMatchObject({ combo: 1, comboBonusXp: 0, xpEarned: 10 });
  });

  it('never spans sessions: after more than 5 minutes away the combo starts again', async () => {
    const { headers } = await t.familyStudent('combo_gap_kid');
    const mc = await mcItem(headers);
    await answer(headers, mc.id, 1);
    await answer(headers, mc.id, 1);
    t.clock.advance(6 * MINUTES);
    const after = await answer(headers, mc.id, 1);
    expect(after).toMatchObject({ combo: 1, comboBonusXp: 0 });
  });
});

describe('combo bonus XP in Test mode (the starting test)', () => {
  async function start(headers: H) {
    const res = await t.app.request(
      '/v1/student/learn/starting-tests',
      jsonRequest('POST', { subjectId: TEST_SUBJECT }, headers),
    );
    return StartingTestResponseSchema.parse(await res.json());
  }

  async function finish(headers: H, id: string) {
    const res = await t.app.request(`/v1/student/learn/starting-tests/${id}/finish`, {
      method: 'POST',
      headers,
    });
    expect(res.status).toBe(200);
    return StartingTestResultSchema.parse(await res.json());
  }

  it('shows no combo while answering, then applies the bonus at the reveal, once', async () => {
    const { headers } = await t.familyStudent('combo_test_kid');
    const test = await start(headers);
    const rightOnes = test.items.filter((i) => 'prompt' in i && i.prompt in RIGHT);
    expect(rightOnes.length).toBeGreaterThanOrEqual(3);
    let baseXp = 0;
    for (const item of rightOnes) {
      const marked = await answer(headers, item.id, RIGHT[(item as { prompt: string }).prompt], {
        mode: 'test',
        startingTestId: test.id,
      });
      expect(marked).toMatchObject({ combo: 0, comboBonusXp: 0 });
      baseXp += marked.xpEarned;
    }
    const expectedBonus = (rightOnes.length - 2) * 5;
    const result = await finish(headers, test.id);
    expect(result).toMatchObject({ bestCombo: rightOnes.length, comboBonusXp: expectedBonus });
    expect(await rewardXp(headers)).toBe(baseXp + expectedBonus);

    const again = await finish(headers, test.id);
    expect(again.comboBonusXp).toBe(expectedBonus);
    expect(await rewardXp(headers)).toBe(baseXp + expectedBonus);
  });

  it('does not carry a test into a Learn mode combo', async () => {
    const { headers } = await t.familyStudent('combo_mixed_kid');
    const test = await start(headers);
    const mcInTest = test.items.find((i) => 'prompt' in i && i.prompt === 'Test question 1')!;
    await answer(headers, mcInTest.id, 1, { mode: 'test', startingTestId: test.id });
    await answer(headers, mcInTest.id, 1, { mode: 'test', startingTestId: test.id });
    const learn = await answer(headers, mcInTest.id, 1);
    expect(learn.combo).toBe(1);
  });
});
