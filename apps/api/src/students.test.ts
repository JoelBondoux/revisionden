import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  EnrolmentListResponseSchema,
  EnrolmentSchema,
  StudentListResponseSchema,
  StudentSchema,
} from '@revisionden/core';
import { AVATAR, AVATAR_2, createTestContext, jsonRequest, type TestContext } from './test/helpers';

let t: TestContext;

beforeAll(async () => {
  t = await createTestContext();
});

afterAll(async () => {
  await t.close();
});

type Headers = Record<string, string>;

function createStudent(headers: Headers, body: Record<string, unknown>) {
  return t.app.request('/v1/students', jsonRequest('POST', body, headers));
}

async function newStudentId(headers: Headers, nickname: string): Promise<string> {
  const res = await createStudent(headers, { nickname, avatarCode: AVATAR, yearGroup: 11 });
  return StudentSchema.parse(await res.json()).id;
}

describe('family', () => {
  it('creates a family on first sign-in and keeps the same family afterwards', async () => {
    const { headers } = await t.signInParent();
    const first = await t.app.request('/v1/me', { headers });
    expect(first.status).toBe(200);
    const body = (await first.json()) as { familyId: string; email: string };
    expect(body.familyId).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.email).toMatch(/@example\.com$/);

    const second = (await (await t.app.request('/v1/me', { headers })).json()) as {
      familyId: string;
    };
    expect(second.familyId).toBe(body.familyId);
  });
});

describe('student profiles', () => {
  it('creates a student with a nickname, avatar code and year group only', async () => {
    const { headers } = await t.signInParent();
    const res = await createStudent(headers, {
      nickname: 'quiz_fox',
      avatarCode: AVATAR,
      yearGroup: 11,
    });
    expect(res.status).toBe(201);
    const student = StudentSchema.strict().parse(await res.json());
    expect(student).toMatchObject({ nickname: 'quiz_fox', avatarCode: AVATAR, yearGroup: 11 });
  });

  it.each([
    ['too short', 'a'],
    ['too long', 'a'.repeat(17)],
    ['a double space', 'quiz  fox'],
    ['a symbol', 'quiz-fox!'],
    ['a blocked word', 'admin_kid'],
  ])('rejects a nickname with %s', async (_label, nickname) => {
    const { headers } = await t.signInParent();
    const res = await createStudent(headers, { nickname, avatarCode: AVATAR, yearGroup: 11 });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: 'invalid_request' } });
  });

  it('accepts single spaces between words and trims spaces at the ends', async () => {
    const { headers } = await t.signInParent();
    const res = await createStudent(headers, {
      nickname: '  quiz fox ',
      avatarCode: AVATAR,
      yearGroup: 11,
    });
    expect(res.status).toBe(201);
    expect(StudentSchema.parse(await res.json()).nickname).toBe('quiz fox');
  });

  it('rejects an avatar code that is not in the avatar format', async () => {
    const { headers } = await t.signInParent();
    const res = await createStudent(headers, { nickname: 'owl_0', avatarCode: 'x', yearGroup: 9 });
    expect(res.status).toBe(400);
  });

  it.each([8, 14])('rejects year group %i (only Years 9 to 13)', async (yearGroup) => {
    const { headers } = await t.signInParent();
    const res = await createStudent(headers, {
      nickname: `owl_y${yearGroup}`,
      avatarCode: AVATAR,
      yearGroup,
    });
    expect(res.status).toBe(400);
  });

  it('rejects fields that are not allowed, such as a real name', async () => {
    const { headers } = await t.signInParent();
    const res = await createStudent(headers, {
      nickname: 'owl_2',
      avatarCode: AVATAR,
      yearGroup: 9,
      realName: 'Should Not Be Stored',
    });
    expect(res.status).toBe(400);
  });

  it('refuses a second student with the same nickname in the family', async () => {
    const { headers } = await t.signInParent();
    await newStudentId(headers, 'twin');
    const res = await createStudent(headers, {
      nickname: 'twin',
      avatarCode: AVATAR,
      yearGroup: 9,
    });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: { code: 'nickname_taken' } });
  });

  it('refuses to rename a student to a nickname already used in the family', async () => {
    const { headers } = await t.signInParent();
    await newStudentId(headers, 'taken');
    const other = await newStudentId(headers, 'free');
    const res = await t.app.request(
      `/v1/students/${other}`,
      jsonRequest('PATCH', { nickname: 'taken' }, headers),
    );
    expect(res.status).toBe(409);
  });

  it('lists, updates and deletes the family students', async () => {
    const { headers } = await t.signInParent();
    const id = await newStudentId(headers, 'maths_cat');

    const list = await t.app.request('/v1/students', { headers });
    expect(StudentListResponseSchema.parse(await list.json())).toEqual({
      students: [{ id, nickname: 'maths_cat', avatarCode: AVATAR, yearGroup: 11 }],
    });

    const patched = await t.app.request(
      `/v1/students/${id}`,
      jsonRequest('PATCH', { avatarCode: AVATAR_2, yearGroup: 12 }, headers),
    );
    expect(patched.status).toBe(200);
    expect(StudentSchema.parse(await patched.json())).toMatchObject({
      avatarCode: AVATAR_2,
      yearGroup: 12,
    });

    const one = await t.app.request(`/v1/students/${id}`, { headers });
    expect(StudentSchema.parse(await one.json())).toMatchObject({ nickname: 'maths_cat' });

    const del = await t.app.request(`/v1/students/${id}`, { method: 'DELETE', headers });
    expect(del.status).toBe(204);
    expect((await t.app.request(`/v1/students/${id}`, { headers })).status).toBe(404);
  });

  it('rejects an update with nothing to change', async () => {
    const { headers } = await t.signInParent();
    const id = await newStudentId(headers, 'still_me');
    const res = await t.app.request(`/v1/students/${id}`, jsonRequest('PATCH', {}, headers));
    expect(res.status).toBe(400);
  });

  it('returns 404 for a student id that is not a valid id', async () => {
    const { headers } = await t.signInParent();
    expect((await t.app.request('/v1/students/not-a-uuid', { headers })).status).toBe(404);
  });
});

describe('family isolation', () => {
  it('never lets a parent see or change another family students', async () => {
    const a = await t.signInParent();
    const b = await t.signInParent();
    const id = await newStudentId(a.headers, 'private_1');

    const bList = await t.app.request('/v1/students', { headers: b.headers });
    expect(await bList.json()).toEqual({ students: [] });

    const path = `/v1/students/${id}`;
    expect((await t.app.request(path, { headers: b.headers })).status).toBe(404);
    expect(
      (await t.app.request(path, jsonRequest('PATCH', { yearGroup: 10 }, b.headers))).status,
    ).toBe(404);
    expect((await t.app.request(path, { method: 'DELETE', headers: b.headers })).status).toBe(404);
    expect((await t.app.request(`${path}/enrolments`, { headers: b.headers })).status).toBe(404);
    expect(
      (
        await t.app.request(
          `${path}/enrolments`,
          jsonRequest('POST', { subjectId: 'gcse-maths', board: 'AQA', tier: 'higher' }, b.headers),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await t.app.request(`${path}/enrolments/gcse-maths`, {
          method: 'DELETE',
          headers: b.headers,
        })
      ).status,
    ).toBe(404);

    // Still intact for its own family.
    const own = await t.app.request(path, { headers: a.headers });
    expect(await own.json()).toMatchObject({ yearGroup: 11 });
  });
});

describe('enrolments', () => {
  it('records subject, board and tier, including "not sure"', async () => {
    const { headers } = await t.signInParent();
    const id = await newStudentId(headers, 'chem_owl');
    const enrol = (body: Record<string, unknown>) =>
      t.app.request(`/v1/students/${id}/enrolments`, jsonRequest('POST', body, headers));

    const created = await enrol({
      subjectId: 'gcse-maths',
      board: 'AQA',
      tier: 'higher',
      specVersion: '8300',
    });
    expect(created.status).toBe(200);
    expect(EnrolmentSchema.parse(await created.json())).toEqual({
      studentId: id,
      subjectId: 'gcse-maths',
      board: 'AQA',
      tier: 'higher',
      specVersion: '8300',
    });
    await enrol({ subjectId: 'gcse-chemistry', board: 'not_sure', tier: 'not_sure' });
    // Enrolling again in the same subject replaces it.
    await enrol({ subjectId: 'gcse-maths', board: 'Edexcel', tier: 'foundation' });

    const list = await t.app.request(`/v1/students/${id}/enrolments`, { headers });
    expect(EnrolmentListResponseSchema.parse(await list.json())).toEqual({
      enrolments: [
        { studentId: id, subjectId: 'gcse-chemistry', board: 'not_sure', tier: 'not_sure' },
        { studentId: id, subjectId: 'gcse-maths', board: 'Edexcel', tier: 'foundation' },
      ],
    });

    const del = await t.app.request(`/v1/students/${id}/enrolments/gcse-chemistry`, {
      method: 'DELETE',
      headers,
    });
    expect(del.status).toBe(204);
    const after = EnrolmentListResponseSchema.parse(
      await (await t.app.request(`/v1/students/${id}/enrolments`, { headers })).json(),
    );
    expect(after.enrolments).toHaveLength(1);
  });

  it('rejects an unknown tier or board', async () => {
    const { headers } = await t.signInParent();
    const id = await newStudentId(headers, 'bio_owl');
    for (const body of [
      { subjectId: 'gcse-biology', board: 'AQA', tier: 'expert' },
      { subjectId: 'gcse-biology', board: 'Hogwarts', tier: 'higher' },
    ]) {
      const res = await t.app.request(
        `/v1/students/${id}/enrolments`,
        jsonRequest('POST', body, headers),
      );
      expect(res.status).toBe(400);
    }
  });
});
