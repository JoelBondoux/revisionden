import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import {
  DAY_MS,
  DailySetResponseSchema,
  EXPECTED_SECONDS,
  LearnAttemptResponseSchema,
  LessonResponseSchema,
} from '@revisionden/core';
import { attempts, items, mastery, reviewPoints } from '@revisionden/db';
import { syncContent, type ContentItem, type ContentTopicTree } from './learning/content-sync';
import { AVATAR, createTestContext, jsonRequest, type TestContext } from './test/helpers';
import { testItems } from './test/learning-fixtures';

type H = Record<string, string>;

/** Made-up content (not educational): short answers whose right answer is "right". */
const SUBJECT = 'mistakes-subject';
const short = testItems.find((i) => i.id === 'test-short-0001')!;
const item = (id: string, topic: string, extra: Partial<ContentItem> = {}): ContentItem => ({
  ...short,
  id,
  topic,
  prompt: `Mistakes question ${id}`,
  answer: { accepted: ['right'] },
  ...extra,
});
const tree: ContentTopicTree = {
  id: 'mistakes-tree',
  subject: SUBJECT,
  board: 'test-board',
  topics: [
    {
      id: 'mk-unit',
      title: 'Mistakes unit',
      children: [
        { id: 'mk-topic-a', title: 'Mistakes topic A', spec_ref: ['M1'], citations: [] },
        { id: 'mk-topic-b', title: 'Mistakes topic B', spec_ref: ['M2'], citations: [] },
      ],
    },
  ],
};
const content = [
  item('mk-a1', 'mk-topic-a', { learning_point: 'mk-lp-1', difficulty: 2 }),
  item('mk-a2', 'mk-topic-a', { learning_point: 'mk-lp-1', difficulty: 3 }),
  item('mk-a3', 'mk-topic-a', { learning_point: 'mk-lp-2', difficulty: 2 }),
  item('mk-b1', 'mk-topic-b'),
  item('mk-b2', 'mk-topic-b', { expected_seconds: 10 }),
];

let t: TestContext;
let ids: Record<string, string>;

beforeAll(async () => {
  t = await createTestContext();
  await syncContent(t.db, { topicTrees: [tree], items: content });
  const rows = await t.db.select({ id: items.id, contentId: items.contentId }).from(items);
  ids = Object.fromEntries(rows.map((r) => [r.contentId!, r.id]));
});

afterAll(async () => {
  await t.close();
});

const student = (nickname: string) => t.familyStudent(nickname, [SUBJECT]);

async function answer(
  headers: H,
  contentId: string,
  value: string,
  extra: Record<string, unknown> = {},
) {
  const res = await t.app.request(
    '/v1/student/learn/attempts',
    jsonRequest(
      'POST',
      { itemId: ids[contentId], answer: value, timeMs: 1000, mode: 'learn', ...extra },
      headers,
    ),
  );
  expect(res.status).toBe(200);
  return LearnAttemptResponseSchema.parse(await res.json());
}

async function lesson(headers: H, query: string) {
  const res = await t.app.request(`/v1/student/learn/lesson?${query}`, { headers });
  expect(res.status).toBe(200);
  return LessonResponseSchema.parse(await res.json()).items;
}

async function points(studentId: string) {
  return t.db.select().from(reviewPoints).where(eq(reviewPoints.studentId, studentId));
}

/** Moves the clock on whole days and signs the student in again (sessions last 12 hours). */
async function nextDays(studentId: string, days: number) {
  t.clock.advance(days * DAY_MS);
  return t.signInStudent(studentId);
}

describe('a similar question after a wrong answer (in-lesson retry)', () => {
  it('offers another question on the same learning point', async () => {
    const { headers } = await student('mk_similar');
    const result = await answer(headers, 'mk-a1', 'wrong');
    expect(result.similar?.id).toBe(ids['mk-a2']);
  });

  it('uses the topic when items have no finer learning point', async () => {
    const { headers } = await student('mk_topic');
    expect((await answer(headers, 'mk-b1', 'wrong')).similar?.id).toBe(ids['mk-b2']);
  });

  it('offers nothing seen in the last 7 days, so the lesson repeats the question instead', async () => {
    const { headers } = await student('mk_seen');
    await answer(headers, 'mk-a2', 'right');
    expect((await answer(headers, 'mk-a1', 'wrong')).similar).toBeNull();
  });

  it('offers nothing after a right answer', async () => {
    const { headers } = await student('mk_right');
    expect((await answer(headers, 'mk-a1', 'right')).similar ?? null).toBeNull();
  });
});

describe('slow means shaky', () => {
  it('scores a slow right answer but marks it shaky and brings it back tomorrow', async () => {
    const { headers, studentId } = await student('mk_slow');
    const slow = 2 * EXPECTED_SECONDS.short_answer * 1000 + 1;
    const result = await answer(headers, 'mk-a3', 'right', { timeMs: slow });
    expect(result).toMatchObject({ correct: true, shaky: true });
    expect(result.xpEarned).toBeGreaterThan(0);
    expect(await points(studentId)).toEqual([
      expect.objectContaining({ learningPoint: 'mk-lp-2', rung: 0, dueDay: '2026-11-25' }),
    ]);
  });

  it('follows the item’s own expected time', async () => {
    const { headers } = await student('mk_own_time');
    expect((await answer(headers, 'mk-b2', 'right', { timeMs: 21_000 })).shaky).toBe(true);
    expect((await answer(headers, 'mk-b1', 'right', { timeMs: 21_000 })).shaky).toBe(false);
  });
});

describe('the review ladder across sessions', () => {
  it('brings a missed learning point back as a warm-up the next day, then in 3 days', async () => {
    const { headers: first, studentId } = await student('mk_ladder');
    await answer(first, 'mk-a1', 'wrong');
    expect(await points(studentId)).toEqual([
      expect.objectContaining({ learningPoint: 'mk-lp-1', topicId: 'mk-topic-a', rung: 0 }),
    ]);

    // Not due yet: the same day's lessons have no warm-up.
    expect((await lesson(first, `subjectId=${SUBJECT}`)).some((i) => i.warmUp)).toBe(false);

    const headers = await nextDays(studentId, 1);
    const list = await lesson(headers, `topicId=mk-topic-b`);
    expect(list[0]).toMatchObject({ topicId: 'mk-topic-a', warmUp: true });
    expect([ids['mk-a1'], ids['mk-a2']]).toContain(list[0]!.id);
    expect(list.filter((i) => i.warmUp)).toHaveLength(1);

    await answer(headers, 'mk-a2', 'right');
    const [point] = await points(studentId);
    expect(point).toMatchObject({ rung: 1 });
    expect(Date.parse(point!.dueDay) - Date.parse('2026-11-25')).toBe(3 * DAY_MS);
  });

  it('still warms up a due point when every question on it was seen this week', async () => {
    const { headers: first, studentId } = await student('mk_all_seen');
    await answer(first, 'mk-a2', 'right');
    await answer(first, 'mk-a1', 'wrong', { retry: true });
    const headers = await nextDays(studentId, 1);
    const [warm] = await lesson(headers, `subjectId=${SUBJECT}`);
    expect(warm).toMatchObject({ warmUp: true, id: ids['mk-a1'] });
  });

  it('puts a due learning point first in the 5-a-day', async () => {
    const { headers: first, studentId } = await student('mk_daily');
    await answer(first, 'mk-b1', 'right');
    await answer(first, 'mk-a3', 'wrong');
    const headers = await nextDays(studentId, 1);
    const res = await t.app.request('/v1/student/daily', { headers });
    const set = DailySetResponseSchema.parse(await res.json());
    expect(set.items[0]).toMatchObject({ id: ids['mk-a3'], warmUp: true });
  });
});

describe('retries and mastery', () => {
  it('saves a retry and counts it at half weight', async () => {
    const plain = await student('mk_first');
    const retried = await student('mk_retry');
    await answer(plain.headers, 'mk-b1', 'right');
    await answer(retried.headers, 'mk-b1', 'right', { retry: true });
    const [saved] = await t.db
      .select({ retry: attempts.retry })
      .from(attempts)
      .where(eq(attempts.studentId, retried.studentId));
    expect(saved!.retry).toBe(true);
    const level = async (studentId: string) =>
      (
        await t.db
          .select({ value: mastery.value })
          .from(mastery)
          .where(and(eq(mastery.studentId, studentId), eq(mastery.topicId, 'mk-topic-b')))
      )[0]!.value;
    expect(await level(retried.studentId)).toBeLessThan(await level(plain.studentId));
  });
});

describe('family data export', () => {
  it('includes the review ladder', async () => {
    const parent = await t.signInParent();
    const res = await t.app.request(
      '/v1/students',
      jsonRequest(
        'POST',
        { nickname: 'mk_export', avatarCode: AVATAR, yearGroup: 10 },
        parent.headers,
      ),
    );
    expect(res.status).toBeLessThan(300);
    const data = (await (
      await t.app.request('/v1/export', { headers: parent.headers })
    ).json()) as {
      students: { reviewPoints: unknown[] }[];
    };
    expect(data.students[0]!.reviewPoints).toEqual([]);
  });
});
