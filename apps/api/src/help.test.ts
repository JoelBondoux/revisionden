import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import {
  LearnAttemptResponseSchema,
  LessonResponseSchema,
  helpedXp,
  xpForAnswer,
} from '@revisionden/core';
import { attempts, mastery, reviewPoints } from '@revisionden/db';
import { syncContent, type ContentItem, type ContentTopicTree } from './learning/content-sync';
import { createTestContext, jsonRequest, type TestContext } from './test/helpers';
import { testItems } from './test/learning-fixtures';

type H = Record<string, string>;

/** Made-up content (not educational): short answers whose right answer is "right". */
const SUBJECT = 'help-subject';
const short = testItems.find((i) => i.id === 'test-short-0001')!;
const tree: ContentTopicTree = {
  id: 'help-tree',
  subject: SUBJECT,
  board: 'test-board',
  topics: [
    {
      id: 'hp-unit',
      title: 'Help unit',
      children: [{ id: 'hp-topic', title: 'Help topic', spec_ref: ['H1'], citations: [] }],
    },
  ],
};
const item = (id: string, extra: Partial<ContentItem>): ContentItem => ({
  ...short,
  id,
  topic: 'hp-topic',
  prompt: `Help question ${id}`,
  answer: { accepted: ['right'] },
  explanation: undefined,
  hint: undefined,
  ...extra,
});
const content = [
  item('hp-both', { hint: 'Help hint', mark_scheme: ['Help step one', 'Help step two'] }),
  item('hp-steps', { explanation: 'Help explanation' }),
  item('hp-none', {}),
];

let t: TestContext;
let ids: Record<string, string>;

beforeAll(async () => {
  t = await createTestContext();
  await syncContent(t.db, { topicTrees: [tree], items: content });
  const { headers } = await t.familyStudent('hp_probe', [SUBJECT]);
  const res = await t.app.request('/v1/student/learn/lesson?topicId=hp-topic&count=20', {
    headers,
  });
  const lesson = LessonResponseSchema.parse(await res.json()).items;
  ids = Object.fromEntries(
    lesson.map((i) => [('prompt' in i ? i.prompt : '').replace('Help question ', ''), i.id]),
  );
});

afterAll(async () => {
  await t.close();
});

async function answer(headers: H, key: string, value: string, extra: object = {}) {
  const res = await t.app.request(
    '/v1/student/learn/attempts',
    jsonRequest(
      'POST',
      { itemId: ids[key], answer: value, timeMs: 1000, mode: 'learn', ...extra },
      headers,
    ),
  );
  return res;
}

describe('Need a clue? and Help me understand (F10)', () => {
  it('marks items that have verified steps, and keeps the hint', async () => {
    const { headers } = await t.familyStudent('hp_items', [SUBJECT]);
    const res = await t.app.request('/v1/student/learn/lesson?topicId=hp-topic&count=20', {
      headers,
    });
    const lesson = LessonResponseSchema.parse(await res.json()).items;
    const byKey = (k: string) => lesson.find((i) => i.id === ids[k])!;
    expect(byKey('hp-both')).toMatchObject({ hint: 'Help hint', canHelp: true });
    expect(byKey('hp-steps')).toMatchObject({ canHelp: true });
    expect(byKey('hp-none')).not.toHaveProperty('canHelp');
  });

  it('gives the verified steps, ending on the answer', async () => {
    const { headers } = await t.familyStudent('hp_steps', [SUBJECT]);
    const res = await t.app.request(`/v1/student/learn/items/${ids['hp-both']}/help`, {
      headers,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      steps: ['Help step one', 'Help step two', 'Answer: right'],
    });
    const none = await t.app.request(`/v1/student/learn/items/${ids['hp-none']}/help`, {
      headers,
    });
    expect(none.status).toBe(404);
  });

  it('pays full XP after only the clue (no penalty)', async () => {
    const { headers } = await t.familyStudent('hp_clue', [SUBJECT]);
    const result = LearnAttemptResponseSchema.parse(
      await (await answer(headers, 'hp-both', 'right')).json(),
    );
    expect(result.xpEarned).toBe(xpForAnswer({ type: 'short_answer', score: 1 }));
  });

  it('pays half XP for a right helped answer, with no combo, and practises it like a miss', async () => {
    const { headers, studentId } = await t.familyStudent('hp_helped', [SUBJECT]);
    await answer(headers, 'hp-none', 'right');
    const result = LearnAttemptResponseSchema.parse(
      await (await answer(headers, 'hp-both', 'right', { helped: true })).json(),
    );
    expect(result).toMatchObject({
      correct: true,
      helped: true,
      combo: 0,
      comboBonusXp: 0,
      flashcardAdded: true,
    });
    expect(result.xpEarned).toBe(helpedXp(xpForAnswer({ type: 'short_answer', score: 1 })));
    const [saved] = await t.db
      .select({ helped: attempts.helped })
      .from(attempts)
      .where(and(eq(attempts.studentId, studentId), eq(attempts.itemId, ids['hp-both']!)));
    expect(saved!.helped).toBe(true);
    expect(
      await t.db.select().from(reviewPoints).where(eq(reviewPoints.studentId, studentId)),
    ).toHaveLength(1);
  });

  it('counts a helped answer as wrong for mastery', async () => {
    const plain = await t.familyStudent('hp_plain', [SUBJECT]);
    const helped = await t.familyStudent('hp_masteryh', [SUBJECT]);
    await answer(plain.headers, 'hp-both', 'right');
    await answer(helped.headers, 'hp-both', 'right', { helped: true });
    const level = async (studentId: string) =>
      (await t.db.select().from(mastery).where(eq(mastery.studentId, studentId)))[0]!.value;
    expect(await level(helped.studentId)).toBeLessThan(await level(plain.studentId));
  });

  it('refuses help in Test mode (exam conditions)', async () => {
    const { headers } = await t.familyStudent('hp_test', [SUBJECT]);
    const res = await answer(headers, 'hp-both', 'right', { helped: true, mode: 'test' });
    expect(res.status).toBe(400);
  });
});
