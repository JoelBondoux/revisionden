import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  LearnAttemptResponseSchema,
  LessonResponseSchema,
  ProgressSchema,
  StartingTestResponseSchema,
  StartingTestResultSchema,
  SubjectTopicsResponseSchema,
  type LearnItem,
} from '@revisionden/core';
import { items, rewards, streaks, topics } from '@revisionden/db';
import { syncContent } from './learning/content-sync';
import type { MathsEngine } from './learning/maths-engine';
import { createTestContext, jsonRequest, type TestContext } from './test/helpers';
import { DRAFT_PROMPTS, TEST_SUBJECT, testItems, testTopicTree } from './test/learning-fixtures';

type H = Record<string, string>;

const engineCalls: { lines: string[]; expected: unknown }[] = [];
const fakeEngine: MathsEngine = {
  async checkWorking(lines, expected) {
    engineCalls.push({ lines, expected });
    const last = lines[lines.length - 1]!.replace(/\s/g, '');
    return {
      firstWrongLine: lines.includes('wrong') ? lines.indexOf('wrong') : null,
      finalAnswerCorrect: last === 'x=2',
    };
  },
};

let t: TestContext;

beforeAll(async () => {
  t = await createTestContext({ mathsEngine: fakeEngine });
  await syncContent(t.db, { topicTrees: [testTopicTree], items: testItems });
});

afterAll(async () => {
  await t.close();
});

const get = (path: string, headers: H) => t.app.request(path, { headers });

async function lesson(headers: H, query: string) {
  const res = await get(`/v1/student/learn/lesson?${query}`, headers);
  expect(res.status).toBe(200);
  return LessonResponseSchema.parse(await res.json());
}

const itemByPrompt = (list: LearnItem[], prompt: string) =>
  list.find((i) => ('prompt' in i ? i.prompt : i.front) === prompt)!;

async function allItems(headers: H) {
  return [
    ...(await lesson(headers, 'topicId=test-topic-a&count=20')).items,
    ...(await lesson(headers, 'topicId=test-topic-b&count=20')).items,
  ];
}

function attempt(headers: H, body: Record<string, unknown>) {
  return t.app.request(
    '/v1/student/learn/attempts',
    jsonRequest('POST', { timeMs: 1000, mode: 'learn', ...body }, headers),
  );
}

async function answer(headers: H, itemId: string, value: unknown) {
  const res = await attempt(headers, { itemId, answer: value });
  expect(res.status).toBe(200);
  return LearnAttemptResponseSchema.parse(await res.json());
}

describe('content sync', () => {
  it('loads topics and items from the content format', async () => {
    const topicRows = await t.db.select().from(topics).where(eq(topics.subjectId, TEST_SUBJECT));
    expect(topicRows.map((r) => r.id).sort()).toEqual([
      'test-topic-a',
      'test-topic-b',
      'test-topic-c',
      'test-unit',
    ]);
    const order = [...topicRows].sort((x, y) => x.position - y.position).map((r) => r.id);
    expect(order).toEqual(['test-unit', 'test-topic-a', 'test-topic-b', 'test-topic-c']);
    const [mc] = await t.db.select().from(items).where(eq(items.contentId, 'test-mc-0001'));
    expect(mc).toMatchObject({ type: 'multiple_choice', status: 'verified', version: 1 });
    const [work] = await t.db.select().from(items).where(eq(items.contentId, 'test-work-0001'));
    expect(work!.type).toBe('worked_maths');
  });

  it('updates items in place when run again', async () => {
    const changed = testItems.map((i) =>
      i.id === 'test-short-0001' ? { ...i, verification: { ...i.verification, version: 2 } } : i,
    );
    const result = await syncContent(t.db, { topicTrees: [testTopicTree], items: changed });
    expect(result).toEqual({ topics: 4, items: testItems.length });
    const rows = await t.db.select().from(items).where(eq(items.contentId, 'test-short-0001'));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.version).toBe(2);
  });
});

describe('who can use the learning routes', () => {
  it('needs a signed-in student device', async () => {
    const res = await t.app.request('/v1/student/learn/lesson?topicId=test-topic-a');
    expect(res.status).toBe(401);
  });
});

describe('only verified content reaches students (flag off)', () => {
  it('never serves draft or quarantined items in lessons', async () => {
    const { headers } = await t.familyStudent('gate_kid');
    const served = await lesson(headers, `subjectId=${TEST_SUBJECT}&count=20`);
    const all = [...served.items, ...(await allItems(headers))];
    const text = JSON.stringify(all);
    for (const prompt of DRAFT_PROMPTS) expect(text).not.toContain(prompt);
    expect(all.every((i) => !i.draft)).toBe(true);
    expect(served.draftContent).toBe(false);
  });

  it('never puts a draft in a starting test', async () => {
    const { headers } = await t.familyStudent('gate_test_kid');
    const res = await t.app.request(
      '/v1/student/learn/starting-tests',
      jsonRequest('POST', { subjectId: TEST_SUBJECT }, headers),
    );
    const test = StartingTestResponseSchema.parse(await res.json());
    const text = JSON.stringify(test);
    for (const prompt of DRAFT_PROMPTS) expect(text).not.toContain(prompt);
  });

  it('refuses an answer to a draft item', async () => {
    const { headers } = await t.familyStudent('gate_answer_kid');
    const [draft] = await t.db.select().from(items).where(eq(items.contentId, 'test-draft-0001'));
    const res = await attempt(headers, { itemId: draft!.id, answer: 0 });
    expect(res.status).toBe(404);
  });
});

describe('drafts with the development flag on', () => {
  it('serves drafts marked as draft, but never quarantined items', async () => {
    const dev = await createTestContext({ serveDraftContent: true });
    try {
      await syncContent(dev.db, { topicTrees: [testTopicTree], items: testItems });
      const { headers } = await dev.familyStudent('dev_kid');
      const res = await dev.app.request('/v1/student/learn/lesson?topicId=test-topic-a&count=20', {
        headers,
      });
      const served = LessonResponseSchema.parse(await res.json());
      const draftItem = served.items.find((i) => 'prompt' in i && i.prompt === 'Draft question 1');
      expect(draftItem?.draft).toBe(true);
      expect(served.draftContent).toBe(true);
      const b = await dev.app.request('/v1/student/learn/lesson?topicId=test-topic-b&count=20', {
        headers,
      });
      expect(JSON.stringify(await b.json())).not.toContain('Quarantined question 1');
    } finally {
      await dev.close();
    }
  });
});

describe('lessons', () => {
  it('serves a topic’s items without their answers', async () => {
    const { headers } = await t.familyStudent('lesson_kid');
    const served = await lesson(headers, 'topicId=test-topic-a&count=20');
    expect(served.items.every((i) => i.topicId === 'test-topic-a')).toBe(true);
    const mc = itemByPrompt(served.items, 'Test question 1');
    expect(mc).toMatchObject({ type: 'multiple_choice', topicTitle: 'Test topic A' });
    const text = JSON.stringify(served);
    expect(text).not.toContain('Test explanation 1');
    expect(text).not.toContain('test answer');
    expect(text).not.toContain('"answer"');
  });

  it('limits the number of items', async () => {
    const { headers } = await t.familyStudent('count_kid');
    expect((await lesson(headers, 'topicId=test-topic-a&count=2')).items).toHaveLength(2);
  });

  it('picks a mixed lesson across a subject, never more than 3 in a row from one topic', async () => {
    const { headers } = await t.familyStudent('mixed_kid');
    const served = await lesson(headers, `subjectId=${TEST_SUBJECT}&count=6`);
    expect(served.items.length).toBeGreaterThan(0);
    let run = 1;
    for (let i = 1; i < served.items.length; i++) {
      run = served.items[i]!.topicId === served.items[i - 1]!.topicId ? run + 1 : 1;
      expect(run).toBeLessThanOrEqual(3);
    }
  });

  it('needs a subject or a topic', async () => {
    const { headers } = await t.familyStudent('no_query_kid');
    expect((await get('/v1/student/learn/lesson', headers)).status).toBe(400);
  });

  it('lists command-word lessons from items tagged command-word', async () => {
    const { headers } = await t.familyStudent('command_kid');
    const res = await get('/v1/student/learn/command-words', headers);
    const served = LessonResponseSchema.parse(await res.json());
    expect(served.items.map((i) => ('prompt' in i ? i.prompt : ''))).toEqual([
      'Test command word question 1',
    ]);
  });
});

describe('answering (feedback level 1: instant feedback)', () => {
  it('marks a right multiple choice answer, gives XP and the explanation', async () => {
    const { headers } = await t.familyStudent('mc_kid');
    const mc = itemByPrompt(await allItems(headers), 'Test question 1');
    const result = await answer(headers, mc.id, 1);
    expect(result).toMatchObject({ correct: true, score: 1, xpEarned: 10, flashcardAdded: false });
    expect(result.feedback).toEqual({
      correctAnswer: 'Option B',
      explanation: 'Test explanation 1',
    });
    expect(result.progress).toMatchObject({ xpToday: 10, totalXp: 10, goalMet: false });
  });

  it('turns a wrong answer into a flashcard, once', async () => {
    const { headers } = await t.familyStudent('wrong_kid');
    const mc = itemByPrompt(await allItems(headers), 'Test question 1');
    const first = await answer(headers, mc.id, 0);
    expect(first).toMatchObject({ correct: false, xpEarned: 0, flashcardAdded: true });
    expect(first.feedback?.correctAnswer).toBe('Option B');
    const again = await answer(headers, mc.id, 2);
    expect(again.flashcardAdded).toBe(false);
  });

  it('marks short answers and numeric answers', async () => {
    const { headers } = await t.familyStudent('text_kid');
    const all = await allItems(headers);
    const short = await answer(headers, itemByPrompt(all, 'Test question 2').id, ' Test Answer ');
    expect(short).toMatchObject({ correct: true, xpEarned: 15 });
    const numeric = await answer(headers, itemByPrompt(all, 'Test question 3').id, '5');
    expect(numeric).toMatchObject({ correct: false, xpEarned: 0 });
    expect(numeric.feedback?.correctAnswer).toBe('4 cm');
  });

  it('checks maths working with the maths engine and shows the first wrong line', async () => {
    const { headers } = await t.familyStudent('working_kid');
    const work = itemByPrompt(await allItems(headers), 'Test question 4');
    const good = await answer(headers, work.id, { lines: ['x + 1 = 3', 'x = 2'] });
    expect(good).toMatchObject({ correct: true, xpEarned: 20 });
    expect(engineCalls.at(-1)?.expected).toEqual({ solutions: ['2'] });
    const bad = await answer(headers, work.id, { lines: ['x + 1 = 3', 'wrong', 'x = 5'] });
    expect(bad).toMatchObject({ correct: false });
    expect(bad.feedback).toMatchObject({ correctAnswer: 'x = 2', firstWrongLine: 1 });
  });

  // Without a maths engine, typed working is skipped, not a 503 (F12): no-maths-engine.test.ts.

  it('rejects an answer of the wrong shape for the item type', async () => {
    const { headers } = await t.familyStudent('shape_kid');
    const work = itemByPrompt(await allItems(headers), 'Test question 4');
    expect((await attempt(headers, { itemId: work.id, answer: 'x = 2' })).status).toBe(400);
  });

  it('does not mark long answers yet', async () => {
    const { headers } = await t.familyStudent('long_kid');
    const long = itemByPrompt(await allItems(headers), 'Test question 6');
    const res = await attempt(headers, { itemId: long.id, answer: 'my essay' });
    expect(res.status).toBe(422);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('not_marked_yet');
  });

  it('marks a flashcard in a lesson from the student’s own check', async () => {
    const { headers } = await t.familyStudent('selfcheck_kid');
    const card = itemByPrompt(await allItems(headers), 'Test front 1');
    expect(card).toMatchObject({ type: 'flashcard', back: 'Test back 1' });
    expect(await answer(headers, card.id, true)).toMatchObject({ correct: true, xpEarned: 5 });
  });

  it('never changes topic mastery from a flashcard self-rating', async () => {
    const { headers } = await t.familyStudent('selfrate_kid');
    const card = itemByPrompt(await allItems(headers), 'Test front 1');
    for (let i = 0; i < 3; i++) await answer(headers, card.id, true);
    const res = await t.app.request(`/v1/student/learn/subjects/${TEST_SUBJECT}/topics`, {
      headers,
    });
    const body = SubjectTopicsResponseSchema.parse(await res.json());
    expect(body.topics.find((x) => x.topicId === 'test-topic-a')!.mastery).toBe(0);
  });

  it('answers 404 for an item that does not exist', async () => {
    const { headers } = await t.familyStudent('missing_kid');
    const res = await attempt(headers, {
      itemId: '00000000-0000-4000-8000-00000000abcd',
      answer: 1,
    });
    expect(res.status).toBe(404);
  });
});

describe('mastery, XP, daily goal and streak', () => {
  it('raises the topic’s mastery after a right answer', async () => {
    const { headers } = await t.familyStudent('mastery_kid');
    const mc = itemByPrompt(await allItems(headers), 'Test question 1');
    await answer(headers, mc.id, 1);
    const res = await get(`/v1/student/learn/subjects/${TEST_SUBJECT}/topics`, headers);
    const body = SubjectTopicsResponseSchema.parse(await res.json());
    const a = body.topics.find((x) => x.topicId === 'test-topic-a')!;
    const b = body.topics.find((x) => x.topicId === 'test-topic-b')!;
    expect(a.mastery).toBeGreaterThan(0);
    expect(b.mastery).toBe(0);
    expect(a.items).toBeGreaterThan(0);
    expect(body.startingTestDone).toBe(false);
  });

  it('meets the daily goal at 50 XP and counts a streak day once', async () => {
    const { headers: first, studentId } = await t.familyStudent('goal_kid');
    let headers = first;
    const short = itemByPrompt(await allItems(headers), 'Test question 2');
    let last;
    for (let i = 0; i < 2; i++) last = await answer(headers, short.id, 'test answer');
    expect(last!.progress).toMatchObject({ xpToday: 30, goalMet: false });
    // The 3rd right answer in a row earns the +5 combo bonus (docs/GAME_FEEL.md).
    last = await answer(headers, short.id, 'test answer');
    expect(last.progress).toMatchObject({ xpToday: 50, goalMet: true });
    expect(last.progress.streak).toMatchObject({ current: 1, best: 1 });
    last = await answer(headers, short.id, 'test answer');
    expect(last.progress.streak.current).toBe(1);

    t.clock.advance(24 * 60 * 60 * 1000);
    headers = await t.signInStudent(studentId); // the 12-hour device session has ended
    const next = ProgressSchema.parse(
      await (await get('/v1/student/learn/progress', headers)).json(),
    );
    expect(next).toMatchObject({ xpToday: 0, totalXp: 70, goalMet: false });
    expect(next.streak.current).toBe(1);
    for (let i = 0; i < 4; i++) last = await answer(headers, short.id, 'test answer');
    expect(last.progress.streak.current).toBe(2);

    t.clock.advance(3 * 24 * 60 * 60 * 1000);
    headers = await t.signInStudent(studentId);
    const lapsed = ProgressSchema.parse(
      await (await get('/v1/student/learn/progress', headers)).json(),
    );
    expect(lapsed.streak).toMatchObject({ current: 0, best: 2 });
  });
});

describe('rewards earned by an answer', () => {
  it('returns rewards the answer earned, once each, and saves them', async () => {
    const { headers, studentId } = await t.familyStudent('rw_answer_kid');
    await t.db.insert(streaks).values({ studentId, current: 8, best: 8 });
    const mc = itemByPrompt(await allItems(headers), 'Test question 1');
    const first = await answer(headers, mc.id, 1);
    expect(first.newlyEarned.map((r) => r.id)).toContain('streak-7');
    expect(first.newlyEarned[0]).toMatchObject({ earned: true });
    const saved = await t.db.select().from(rewards).where(eq(rewards.studentId, studentId));
    expect(saved.map((r) => r.rewardId)).toContain('streak-7');
    const second = await answer(headers, mc.id, 1);
    expect(second.newlyEarned.map((r) => r.id)).not.toContain('streak-7');
  });

  it('returns no rewards when nothing new is earned', async () => {
    const { headers } = await t.familyStudent('rw_none_kid');
    const mc = itemByPrompt(await allItems(headers), 'Test question 1');
    // The very first lesson answer earns Explorer's first step (R7b), so answer once first.
    expect((await answer(headers, mc.id, 0)).newlyEarned.map((r) => r.id)).toEqual(['explorer-1']);
    expect((await answer(headers, mc.id, 0)).newlyEarned).toEqual([]);
  });
});

describe('starting test', () => {
  async function start(headers: H) {
    const res = await t.app.request(
      '/v1/student/learn/starting-tests',
      jsonRequest('POST', { subjectId: TEST_SUBJECT }, headers),
    );
    expect(res.status).toBe(201);
    return StartingTestResponseSchema.parse(await res.json());
  }

  it('gives about 5 minutes of questions, without flashcards or long answers', async () => {
    const { headers } = await t.familyStudent('start_kid');
    const test = await start(headers);
    expect(test.timeLimitSeconds).toBe(300);
    expect(test.items.length).toBeGreaterThan(0);
    expect(test.items.every((i) => i.type !== 'flashcard' && i.type !== 'extended_answer')).toBe(
      true,
    );
    expect(new Set(test.items.map((i) => i.topicId))).toEqual(
      new Set(['test-topic-a', 'test-topic-b']),
    );
  });

  it('hides feedback until the end, then sets mastery per topic', async () => {
    const { headers } = await t.familyStudent('start_result_kid');
    const test = await start(headers);
    const mc = test.items.find(
      (i) => i.type === 'multiple_choice' && i.prompt === 'Test question 1',
    );
    const numeric = test.items.find((i) => i.type === 'numeric');
    let answered = 0;
    if (mc) {
      const res = await attempt(headers, {
        itemId: mc.id,
        answer: 1,
        mode: 'test',
        startingTestId: test.id,
      });
      const body = LearnAttemptResponseSchema.parse(await res.json());
      expect(body.feedback).toBeNull();
      expect(body.flashcardAdded).toBe(false);
      answered++;
    }
    if (numeric) {
      await attempt(headers, {
        itemId: numeric.id,
        answer: '0',
        mode: 'test',
        startingTestId: test.id,
      });
      answered++;
    }
    const res = await t.app.request(`/v1/student/learn/starting-tests/${test.id}/finish`, {
      method: 'POST',
      headers,
    });
    expect(res.status).toBe(200);
    const result = StartingTestResultSchema.parse(await res.json());
    expect(result).toMatchObject({ answered, total: test.items.length });
    expect(result.topics.map((x) => x.topicId).sort()).toEqual(['test-topic-a', 'test-topic-b']);

    const topicsRes = await get(`/v1/student/learn/subjects/${TEST_SUBJECT}/topics`, headers);
    expect(SubjectTopicsResponseSchema.parse(await topicsRes.json()).startingTestDone).toBe(true);
  });

  it('refuses answers to items that are not in the test, or in learn mode', async () => {
    const { headers } = await t.familyStudent('start_wrong_kid');
    const test = await start(headers);
    const card = itemByPrompt(await allItems(headers), 'Test front 1');
    const outside = await attempt(headers, {
      itemId: card.id,
      answer: true,
      mode: 'test',
      startingTestId: test.id,
    });
    expect(outside.status).toBe(400);
    const learnMode = await attempt(headers, {
      itemId: test.items[0]!.id,
      answer: 0,
      startingTestId: test.id,
    });
    expect(learnMode.status).toBe(400);
  });

  it('keeps each student’s test to themselves', async () => {
    const owner = await t.familyStudent('start_owner');
    const other = await t.familyStudent('start_other');
    const test = await start(owner.headers);
    const res = await t.app.request(`/v1/student/learn/starting-tests/${test.id}/finish`, {
      method: 'POST',
      headers: other.headers,
    });
    expect(res.status).toBe(404);
    const bad = await t.app.request('/v1/student/learn/starting-tests/not-an-id/finish', {
      method: 'POST',
      headers: other.headers,
    });
    expect(bad.status).toBe(404);
  });

  it('says so when a subject has no questions ready', async () => {
    const { headers } = await t.familyStudent('start_empty_kid');
    const res = await t.app.request(
      '/v1/student/learn/starting-tests',
      jsonRequest('POST', { subjectId: 'no-such-subject' }, headers),
    );
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('no_content');
  });
});
