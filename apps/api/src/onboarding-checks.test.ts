import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  AVATAR_CATALOGUE,
  DEFAULT_AVATAR,
  encodeAvatar,
  OnboardedChildSchema,
  OnboardingFamilySchema,
  StudentAvatarSchema,
  StudentSubjectsSchema,
} from '@revisionden/core';
import { enrolments, rewards } from '@revisionden/db';
import { and, eq } from 'drizzle-orm';
import { AVATAR, createTestContext, jsonRequest, type TestContext } from './test/helpers';

let t: TestContext;

beforeAll(async () => {
  t = await createTestContext();
});

afterAll(async () => {
  await t.close();
});

type Headers = Record<string, string>;
let count = 0;

/** A parent, a Year 11 child with Maths (both Not sure) and History (Not sure board), signed in. */
async function setup() {
  count += 1;
  const parent = await t.signInParent();
  const res = await t.app.request(
    '/v1/onboarding/children',
    jsonRequest(
      'POST',
      {
        nickname: `Kid_${count}`,
        avatarCode: AVATAR,
        yearGroup: 11,
        subjects: [
          { subjectId: 'gcse-maths', board: 'not_sure', tier: 'not_sure' },
          { subjectId: 'gcse-history', board: 'not_sure', tier: 'none' },
          { subjectId: 'gcse-film-studies', board: 'Eduqas', tier: 'none' },
        ],
      },
      parent.headers,
    ),
  );
  const child = OnboardedChildSchema.parse(await res.json());
  const student = await t.signInStudent(child.student.id);
  return { parent: parent.headers, student, id: child.student.id };
}

const patch = (path: string, body: unknown, headers: Headers) =>
  t.app.request(path, jsonRequest('PATCH', body, headers));

async function familyChecks(headers: Headers) {
  const res = await t.app.request('/v1/onboarding/family', { headers });
  return OnboardingFamilySchema.parse(await res.json()).children[0]!.toCheckLater;
}

describe('parent sets a board or tier later', () => {
  it('sets a Not sure board and tier, and the checks left go down', async () => {
    const { parent, id } = await setup();
    expect(await familyChecks(parent)).toBe(3);
    const res = await patch(
      `/v1/students/${id}/enrolments/gcse-maths`,
      { board: 'AQA', tier: 'higher' },
      parent,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      subjectId: 'gcse-maths',
      board: 'AQA',
      tier: 'higher',
    });
    expect(await familyChecks(parent)).toBe(1);
  });

  it('keeps both choices when the board and tier are sent at the same time', async () => {
    const { parent, id } = await setup();
    const path = `/v1/students/${id}/enrolments/gcse-maths`;
    const [a, b] = await Promise.all([
      patch(path, { board: 'Edexcel' }, parent),
      patch(path, { tier: 'higher' }, parent),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    const [row] = await t.db
      .select()
      .from(enrolments)
      .where(and(eq(enrolments.studentId, id), eq(enrolments.subjectId, 'gcse-maths')));
    expect({ board: row!.board, tier: row!.tier }).toEqual({ board: 'Edexcel', tier: 'higher' });
  });

  it('can change a board that was already set', async () => {
    const { parent, id } = await setup();
    const res = await patch(
      `/v1/students/${id}/enrolments/gcse-film-studies`,
      { board: 'not_sure' },
      parent,
    );
    expect(res.status).toBe(200);
  });

  it('refuses a board that does not offer the subject', async () => {
    const { parent, id } = await setup();
    const res = await patch(
      `/v1/students/${id}/enrolments/gcse-film-studies`,
      { board: 'AQA' },
      parent,
    );
    expect(res.status).toBe(400);
  });

  it('refuses a tier for a subject without tiers', async () => {
    const { parent, id } = await setup();
    const res = await patch(
      `/v1/students/${id}/enrolments/gcse-history`,
      { tier: 'higher' },
      parent,
    );
    expect(res.status).toBe(400);
  });

  it('says not found for a subject the child does not take', async () => {
    const { parent, id } = await setup();
    const res = await patch(`/v1/students/${id}/enrolments/gcse-physics`, { board: 'AQA' }, parent);
    expect(res.status).toBe(404);
  });

  it('cannot change another family’s child', async () => {
    const { id } = await setup();
    const other = await t.signInParent();
    const res = await patch(
      `/v1/students/${id}/enrolments/gcse-maths`,
      { board: 'AQA' },
      other.headers,
    );
    expect(res.status).toBe(404);
  });

  it('needs at least one of board or tier', async () => {
    const { parent, id } = await setup();
    const res = await patch(`/v1/students/${id}/enrolments/gcse-maths`, {}, parent);
    expect(res.status).toBe(400);
  });
});

describe('student sets their own Not sure board or tier', () => {
  it('lists their subjects and how many are left to check', async () => {
    const { student } = await setup();
    const res = await t.app.request('/v1/student/subjects', { headers: student });
    expect(res.status).toBe(200);
    const body = StudentSubjectsSchema.parse(await res.json());
    expect(body.toCheckLater).toBe(3);
    expect(body.enrolments.map((e) => e.subjectId)).toEqual([
      'gcse-film-studies',
      'gcse-history',
      'gcse-maths',
    ]);
  });

  it('can change Not sure to a real board or tier', async () => {
    const { student } = await setup();
    const res = await patch('/v1/student/subjects/gcse-maths', { tier: 'foundation' }, student);
    expect(res.status).toBe(200);
    const list = StudentSubjectsSchema.parse(
      await (await t.app.request('/v1/student/subjects', { headers: student })).json(),
    );
    expect(list.toCheckLater).toBe(2);
  });

  it('cannot change a board or tier that is already set', async () => {
    const { student } = await setup();
    const res = await patch(
      '/v1/student/subjects/gcse-film-studies',
      { board: 'not_sure' },
      student,
    );
    expect(res.status).toBe(403);
    const res2 = await patch('/v1/student/subjects/gcse-maths', { tier: 'higher' }, student);
    expect(res2.status).toBe(200);
    const res3 = await patch('/v1/student/subjects/gcse-maths', { tier: 'foundation' }, student);
    expect(res3.status).toBe(403);
  });

  it('cannot set a value back to Not sure', async () => {
    const { student } = await setup();
    const res = await patch('/v1/student/subjects/gcse-maths', { board: 'not_sure' }, student);
    expect(res.status).toBe(400);
  });

  it('refuses a board that does not offer the subject', async () => {
    const { student } = await setup();
    const res = await patch('/v1/student/subjects/gcse-history', { board: 'CCEA' }, student);
    expect(res.status).toBe(400);
  });

  it('says not found for a subject they do not take', async () => {
    const { student } = await setup();
    const res = await patch('/v1/student/subjects/gcse-physics', { board: 'AQA' }, student);
    expect(res.status).toBe(404);
  });

  it('needs a signed-in student device', async () => {
    const res = await patch('/v1/student/subjects/gcse-maths', { board: 'AQA' }, {});
    expect(res.status).toBe(401);
  });
});

async function setTargets(
  ctx: { parent: Headers; student: Headers; id: string },
  parentTarget: string,
  studentTarget: string,
) {
  const put = (path: string, targetGrade: string, headers: Headers) =>
    t.app.request(path, jsonRequest('PUT', { targetGrade }, headers));
  expect(
    (await put(`/v1/students/${ctx.id}/target-grades/gcse-maths`, parentTarget, ctx.parent)).status,
  ).toBe(200);
  expect(
    (await put('/v1/student/target-grades/gcse-maths', studentTarget, ctx.student)).status,
  ).toBe(200);
}

/** The targets as stored, not as read back (the read already hides off-scale ones). */
async function mathsTargets(id: string) {
  const [row] = await t.db
    .select()
    .from(enrolments)
    .where(and(eq(enrolments.studentId, id), eq(enrolments.subjectId, 'gcse-maths')));
  return { parent: row!.parentTargetGrade, student: row!.studentTargetGrade };
}

describe('target grades when the board or tier changes', () => {
  it('clears a target that is not on the new tier and keeps one that is (parent change)', async () => {
    const ctx = await setup();
    await patch(`/v1/students/${ctx.id}/enrolments/gcse-maths`, { board: 'Edexcel' }, ctx.parent);
    await setTargets(ctx, '9', '2');
    const res = await patch(
      `/v1/students/${ctx.id}/enrolments/gcse-maths`,
      { tier: 'foundation' },
      ctx.parent,
    );
    expect(res.status).toBe(200);
    expect(await mathsTargets(ctx.id)).toEqual({ parent: null, student: '2' });
  });

  it('clears a target that is not on the new tier and keeps one that is (student change)', async () => {
    const ctx = await setup();
    await patch(`/v1/students/${ctx.id}/enrolments/gcse-maths`, { board: 'Edexcel' }, ctx.parent);
    await setTargets(ctx, '7', '1');
    const res = await patch('/v1/student/subjects/gcse-maths', { tier: 'higher' }, ctx.student);
    expect(res.status).toBe(200);
    expect(await mathsTargets(ctx.id)).toEqual({ parent: '7', student: null });
  });

  it('never brings back a cleared target when the board and tier change at the same time', async () => {
    const ctx = await setup();
    const path = `/v1/students/${ctx.id}/enrolments/gcse-maths`;
    await patch(path, { board: 'Edexcel' }, ctx.parent);
    await setTargets(ctx, '9', '2');
    await Promise.all([
      patch(path, { tier: 'foundation' }, ctx.parent),
      patch(path, { board: 'AQA' }, ctx.parent),
    ]);
    expect(await mathsTargets(ctx.id)).toEqual({ parent: null, student: null });
  });

  it('clears both targets when the new board has no grade scale yet', async () => {
    const ctx = await setup();
    await patch(`/v1/students/${ctx.id}/enrolments/gcse-maths`, { board: 'Edexcel' }, ctx.parent);
    await setTargets(ctx, '5', '4');
    await patch(`/v1/students/${ctx.id}/enrolments/gcse-maths`, { board: 'AQA' }, ctx.parent);
    expect(await mathsTargets(ctx.id)).toEqual({ parent: null, student: null });
  });
});

describe('student avatar on their own device', () => {
  const LOCKED = encodeAvatar({
    ...DEFAULT_AVATAR,
    skin: AVATAR_CATALOGUE.skin.findIndex((i) => i.id === 'alien'),
  });

  it('reads and saves their avatar code', async () => {
    const { student } = await setup();
    const read = StudentAvatarSchema.parse(
      await (await t.app.request('/v1/student/avatar', { headers: student })).json(),
    );
    expect(read).toEqual({ avatarCode: AVATAR, earnedRewardIds: [] });
    const code = encodeAvatar({ ...DEFAULT_AVATAR, hairStyle: 2 });
    const res = await t.app.request(
      '/v1/student/avatar',
      jsonRequest('PUT', { avatarCode: code }, student),
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as { avatarCode: string }).avatarCode).toBe(code);
  });

  it('refuses locked items until the reward is earned', async () => {
    const { student, id } = await setup();
    const put = () =>
      t.app.request('/v1/student/avatar', jsonRequest('PUT', { avatarCode: LOCKED }, student));
    expect((await put()).status).toBe(400);
    await t.db.insert(rewards).values({ studentId: id, rewardId: 'streak-100' });
    expect((await put()).status).toBe(200);
  });
});
