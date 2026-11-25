import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CardsDueSchema, LessonResponseSchema, TopicMapSchema } from '@revisionden/core';
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

const get = (path: string, headers: H = {}) => t.app.request(path, { headers });

async function map(headers: H, query = '') {
  const res = await get(`/v1/student/map${query}`, headers);
  expect(res.status).toBe(200);
  return TopicMapSchema.parse(await res.json());
}

async function due(headers: H) {
  const res = await get('/v1/student/cards/due', headers);
  expect(res.status).toBe(200);
  return CardsDueSchema.parse(await res.json()).due;
}

describe('topic map (F2)', () => {
  it('needs a signed-in student device', async () => {
    expect((await get('/v1/student/map')).status).toBe(401);
    expect((await get('/v1/student/cards/due')).status).toBe(401);
  });

  it('shows the enrolled subject as units of topics in specification order', async () => {
    const { headers } = await t.familyStudent('map_kid', [TEST_SUBJECT]);
    const body = await map(headers);
    expect(body).toMatchObject({
      subject: 'Test Subject',
      streakDays: 0,
      xpToday: 0,
      dailyGoalXp: 50,
    });
    expect(body.units).toHaveLength(1);
    const unit = body.units[0]!;
    expect(unit).toMatchObject({ id: 'test-unit', title: 'Test unit', masteryPercent: 0 });
    expect(unit.topics.map((x) => [x.id, x.status])).toEqual([
      ['test-topic-a', 'in-progress'],
      ['test-topic-b', 'in-progress'],
      ['test-topic-c', 'locked'],
    ]);
    expect(unit.challenge).toEqual({ lessonId: 'test-unit', unlockAtPercent: 80, unlocked: false });
    expect(body.nextMission).toMatchObject({ kind: 'continue', lessonId: 'test-topic-a' });
  });

  it('follows the student’s answers: a shaky topic becomes the weak spot to fix next', async () => {
    const { headers } = await t.familyStudent('map_answer_kid', [TEST_SUBJECT]);
    const lesson = LessonResponseSchema.parse(
      await (await get('/v1/student/learn/lesson?topicId=test-topic-a&count=20', headers)).json(),
    );
    const mc = lesson.items.find((i) => 'prompt' in i && i.prompt === 'Test question 1')!;
    await t.app.request(
      '/v1/student/learn/attempts',
      jsonRequest('POST', { itemId: mc.id, answer: 1, timeMs: 1, mode: 'learn' }, headers),
    );
    const body = await map(headers);
    const a = body.units[0]!.topics.find((x) => x.id === 'test-topic-a')!;
    expect(a.mastery).toBeGreaterThan(0);
    expect(a.status).toBe('weak');
    expect(body.xpToday).toBe(10);
    expect(body.nextMission).toMatchObject({ kind: 'weak-spot', lessonId: 'test-topic-a' });
  });

  it('can show a named subject, and says so when there is none', async () => {
    const { headers } = await t.familyStudent('map_named_kid');
    expect((await map(headers, `?subjectId=${TEST_SUBJECT}`)).units).toHaveLength(1);
    const none = await get('/v1/student/map', headers);
    expect(none.status).toBe(404);
    expect(((await none.json()) as { error: { code: string } }).error.code).toBe('no_subject');
    expect((await get('/v1/student/map?subjectId=no-such-subject', headers)).status).toBe(404);
  });

  it('serves a unit challenge lesson from all the unit’s topics', async () => {
    const { headers } = await t.familyStudent('map_unit_kid', [TEST_SUBJECT]);
    const res = await get('/v1/student/learn/lesson?topicId=test-unit&count=20', headers);
    const lesson = LessonResponseSchema.parse(await res.json());
    expect(new Set(lesson.items.map((i) => i.topicId))).toEqual(
      new Set(['test-topic-a', 'test-topic-b']),
    );
  });
});

describe('cards due (F2)', () => {
  it('counts due flashcards, including new deck cards, and drops once reviewed', async () => {
    const { headers } = await t.familyStudent('due_kid', [TEST_SUBJECT]);
    expect(await due(headers)).toBe(1);
    const overview = (await (await get('/v1/student/flashcards', headers)).json()) as {
      due: { id: string }[];
    };
    const session = await t.app.request('/v1/student/flashcards/sessions', {
      method: 'POST',
      headers,
    });
    const { id: sessionId } = (await session.json()) as { id: string };
    const res = await t.app.request(
      `/v1/student/flashcards/${overview.due[0]!.id}/review`,
      jsonRequest('POST', { rating: 'good', sessionId }, headers),
    );
    expect(res.status).toBe(200);
    expect(await due(headers)).toBe(0);
  });

  it('is zero for a student with no subjects', async () => {
    const { headers } = await t.familyStudent('due_none_kid');
    expect(await due(headers)).toBe(0);
  });
});
