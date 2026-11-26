import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { OnboardedChildSchema, ParentSubjectsSchema } from '@revisionden/core';
import { attempts, items, topics } from '@revisionden/db';
import { eq } from 'drizzle-orm';
import { AVATAR, createTestContext, jsonRequest, type TestContext } from './test/helpers';

let t: TestContext;

beforeAll(async () => {
  t = await createTestContext();
  // Made-up content (not educational): GCSE Maths has a question, nothing else does.
  await t.db
    .insert(topics)
    .values({ id: 'e5-demo-topic', subjectId: 'gcse-maths', board: 'test-board', title: 'Demo' });
  await t.db.insert(items).values({
    topicId: 'e5-demo-topic',
    type: 'multiple_choice',
    body: { prompt: 'Demo question' },
    answer: { key: { option: 0 } },
    status: 'verified',
  });
});

afterAll(async () => {
  await t.close();
});

type Headers = Record<string, string>;
let count = 0;

/** A parent and a Year 11 child taking Maths (Edexcel, higher) and History. */
async function setup() {
  count += 1;
  const parent = await t.signInParent();
  const res = await t.app.request(
    '/v1/onboarding/children',
    jsonRequest(
      'POST',
      {
        nickname: `Subjects_${count}`,
        avatarCode: AVATAR,
        yearGroup: 11,
        subjects: [
          { subjectId: 'gcse-maths', board: 'Edexcel', tier: 'higher' },
          { subjectId: 'gcse-history', board: 'AQA', tier: 'none' },
        ],
      },
      parent.headers,
    ),
  );
  const child = OnboardedChildSchema.parse(await res.json());
  return { headers: parent.headers, id: child.student.id };
}

const list = async (id: string, headers: Headers) => {
  const res = await t.app.request(`/v1/students/${id}/subjects`, { headers });
  expect(res.status).toBe(200);
  return ParentSubjectsSchema.parse(await res.json());
};
const add = (id: string, body: unknown, headers: Headers) =>
  t.app.request(`/v1/students/${id}/subjects`, jsonRequest('POST', body, headers));
const remove = (id: string, subjectId: string, headers: Headers) =>
  t.app.request(`/v1/students/${id}/subjects/${subjectId}`, { method: 'DELETE', headers });

async function events(headers: Headers) {
  const res = await t.app.request('/v1/family/events', { headers });
  return ((await res.json()) as { events: { kind: string; what: string; important: boolean }[] })
    .events;
}

describe('a parent manages a child’s subjects', () => {
  it('lists the subjects, saying which have no questions yet', async () => {
    const { headers, id } = await setup();
    const body = await list(id, headers);
    expect(body.subjects.map((s) => [s.subjectId, s.hasQuestions])).toEqual([
      ['gcse-history', false],
      ['gcse-maths', true],
    ]);
    expect(body.subjects[1]).toMatchObject({ board: 'Edexcel', tier: 'higher' });
  });

  it('adds a subject from the catalogue, with Not sure allowed for the board', async () => {
    const { headers, id } = await setup();
    const res = await add(
      id,
      { subjectId: 'gcse-physics', board: 'not_sure', tier: 'higher' },
      headers,
    );
    expect(res.status).toBe(201);
    expect((await list(id, headers)).subjects.map((s) => s.subjectId)).toContain('gcse-physics');
  });

  it('refuses a subject that does not fit the school year or the board', async () => {
    const { headers, id } = await setup();
    const wrongLevel = await add(
      id,
      { subjectId: 'alevel-maths', board: 'AQA', tier: 'none' },
      headers,
    );
    expect(wrongLevel.status).toBe(400);
    const wrongBoard = await add(
      id,
      { subjectId: 'gcse-film-studies', board: 'AQA', tier: 'none' },
      headers,
    );
    expect(wrongBoard.status).toBe(400);
  });

  it('refuses a subject the child already takes', async () => {
    const { headers, id } = await setup();
    const res = await add(id, { subjectId: 'gcse-maths', board: 'AQA', tier: 'higher' }, headers);
    expect(res.status).toBe(409);
    expect(
      (await list(id, headers)).subjects.find((s) => s.subjectId === 'gcse-maths'),
    ).toMatchObject({ board: 'Edexcel' });
  });

  it('removes a subject but keeps the answers, so progress comes back if it is added again', async () => {
    const { headers, id } = await setup();
    const [item] = await t.db
      .select({ id: items.id })
      .from(items)
      .where(eq(items.topicId, 'e5-demo-topic'));
    await t.db.insert(attempts).values({
      studentId: id,
      itemId: item!.id,
      correct: true,
      score: 1,
      mode: 'learn',
      xpEarned: 10,
    });
    expect((await remove(id, 'gcse-maths', headers)).status).toBe(204);
    expect((await list(id, headers)).subjects.map((s) => s.subjectId)).toEqual(['gcse-history']);
    const kept = await t.db.select().from(attempts).where(eq(attempts.studentId, id));
    expect(kept).toHaveLength(1);
    expect(
      (await add(id, { subjectId: 'gcse-maths', board: 'Edexcel', tier: 'higher' }, headers))
        .status,
    ).toBe(201);
  });

  it('says not found when removing a subject the child does not take', async () => {
    const { headers, id } = await setup();
    expect((await remove(id, 'gcse-physics', headers)).status).toBe(404);
  });

  it('keeps other families out', async () => {
    const { id } = await setup();
    const other = await setup();
    expect(
      (await t.app.request(`/v1/students/${id}/subjects`, { headers: other.headers })).status,
    ).toBe(404);
    expect(
      (await add(id, { subjectId: 'gcse-physics', board: 'AQA', tier: 'higher' }, other.headers))
        .status,
    ).toBe(404);
    expect((await remove(id, 'gcse-maths', other.headers)).status).toBe(404);
  });

  it('logs adding, removing and changing a board or tier as important changes', async () => {
    const { headers, id } = await setup();
    await add(id, { subjectId: 'gcse-physics', board: 'AQA', tier: 'higher' }, headers);
    await remove(id, 'gcse-history', headers);
    await t.app.request(
      `/v1/students/${id}/enrolments/gcse-maths`,
      jsonRequest('PATCH', { tier: 'foundation' }, headers),
    );
    const log = await events(headers);
    const nickname = `Subjects_${count}`;
    expect(log.filter((e) => e.what.includes(nickname)).map((e) => [e.kind, e.important])).toEqual(
      expect.arrayContaining([
        ['subject_added', true],
        ['subject_removed', true],
        ['subject_changed', true],
      ]),
    );
    expect(log.find((e) => e.kind === 'subject_added')!.what).toBe(
      `added a subject for ${nickname}`,
    );
  });
});
