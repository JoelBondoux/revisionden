import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestContext, jsonRequest, type TestContext } from './test/helpers';

let t: TestContext;

beforeAll(async () => {
  t = await createTestContext();
});

afterAll(async () => {
  await t.close();
});

type Headers = Record<string, string>;

async function createStudent(headers: Headers, body: Record<string, unknown>) {
  return t.app.request('/v1/students', jsonRequest('POST', body, headers));
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
      avatarCode: 'fx01',
      yearGroup: 11,
    });
    expect(res.status).toBe(201);
    const student = await res.json();
    expect(student).toEqual({
      id: expect.any(String),
      nickname: 'quiz_fox',
      avatarCode: 'fx01',
      yearGroup: 11,
    });
  });

  it.each([
    ['too short', 'a'],
    ['too long', 'a'.repeat(17)],
    ['a space', 'quiz fox'],
    ['a symbol', 'quiz-fox!'],
  ])('rejects a nickname with %s', async (_label, nickname) => {
    const { headers } = await t.signInParent();
    const res = await createStudent(headers, { nickname, avatarCode: 'fx01', yearGroup: 11 });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid_request' });
  });

  it('rejects a year group outside 7 to 13', async () => {
    const { headers } = await t.signInParent();
    const res = await createStudent(headers, { nickname: 'owl_1', avatarCode: 'o', yearGroup: 14 });
    expect(res.status).toBe(400);
  });

  it('rejects fields that are not allowed, such as a real name', async () => {
    const { headers } = await t.signInParent();
    const res = await createStudent(headers, {
      nickname: 'owl_2',
      avatarCode: 'o',
      yearGroup: 9,
      realName: 'Should Not Be Stored',
    });
    expect(res.status).toBe(400);
  });

  it('refuses a second student with the same nickname in the family', async () => {
    const { headers } = await t.signInParent();
    await createStudent(headers, { nickname: 'twin', avatarCode: 'a', yearGroup: 10 });
    const res = await createStudent(headers, { nickname: 'twin', avatarCode: 'b', yearGroup: 10 });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'nickname_taken' });
  });

  it('lists, updates and deletes the family students', async () => {
    const { headers } = await t.signInParent();
    const created = (await (
      await createStudent(headers, { nickname: 'maths_cat', avatarCode: 'c1', yearGroup: 10 })
    ).json()) as { id: string };

    const list = await t.app.request('/v1/students', { headers });
    expect(await list.json()).toEqual([
      { id: created.id, nickname: 'maths_cat', avatarCode: 'c1', yearGroup: 10 },
    ]);

    const patched = await t.app.request(
      `/v1/students/${created.id}`,
      jsonRequest('PATCH', { avatarCode: 'c2', yearGroup: 11 }, headers),
    );
    expect(patched.status).toBe(200);
    expect(await patched.json()).toMatchObject({ avatarCode: 'c2', yearGroup: 11 });

    const one = await t.app.request(`/v1/students/${created.id}`, { headers });
    expect(await one.json()).toMatchObject({ nickname: 'maths_cat', avatarCode: 'c2' });

    const del = await t.app.request(`/v1/students/${created.id}`, { method: 'DELETE', headers });
    expect(del.status).toBe(204);
    expect((await t.app.request(`/v1/students/${created.id}`, { headers })).status).toBe(404);
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
    const student = (await (
      await createStudent(a.headers, { nickname: 'private_1', avatarCode: 'p', yearGroup: 12 })
    ).json()) as { id: string };

    expect(await (await t.app.request('/v1/students', { headers: b.headers })).json()).toEqual([]);

    const path = `/v1/students/${student.id}`;
    expect((await t.app.request(path, { headers: b.headers })).status).toBe(404);
    expect(
      (await t.app.request(path, jsonRequest('PATCH', { yearGroup: 7 }, b.headers))).status,
    ).toBe(404);
    expect((await t.app.request(path, { method: 'DELETE', headers: b.headers })).status).toBe(404);
    expect((await t.app.request(`${path}/enrolments`, { headers: b.headers })).status).toBe(404);
    expect(
      (
        await t.app.request(
          `${path}/enrolments/gcse-maths`,
          jsonRequest('PUT', { board: 'aqa', tier: 'higher' }, b.headers),
        )
      ).status,
    ).toBe(404);

    // Still intact for its own family.
    const own = await t.app.request(path, { headers: a.headers });
    expect(await own.json()).toMatchObject({ yearGroup: 12 });
  });
});

describe('enrolments', () => {
  it('records subject, board and tier, including "not sure"', async () => {
    const { headers } = await t.signInParent();
    const { id } = (await (
      await createStudent(headers, { nickname: 'chem_owl', avatarCode: 'o', yearGroup: 11 })
    ).json()) as { id: string };

    const put = await t.app.request(
      `/v1/students/${id}/enrolments/gcse-maths`,
      jsonRequest('PUT', { board: 'aqa', tier: 'higher', specVersion: '8300' }, headers),
    );
    expect(put.status).toBe(200);
    await t.app.request(
      `/v1/students/${id}/enrolments/gcse-chemistry`,
      jsonRequest('PUT', { board: 'not_sure', tier: 'not_sure' }, headers),
    );
    // Changing an enrolment replaces it.
    await t.app.request(
      `/v1/students/${id}/enrolments/gcse-maths`,
      jsonRequest('PUT', { board: 'edexcel', tier: 'foundation' }, headers),
    );

    const list = await t.app.request(`/v1/students/${id}/enrolments`, { headers });
    expect(await list.json()).toEqual([
      { subjectId: 'gcse-chemistry', board: 'not_sure', tier: 'not_sure', specVersion: null },
      { subjectId: 'gcse-maths', board: 'edexcel', tier: 'foundation', specVersion: null },
    ]);

    const del = await t.app.request(`/v1/students/${id}/enrolments/gcse-chemistry`, {
      method: 'DELETE',
      headers,
    });
    expect(del.status).toBe(204);
    const after = (await (
      await t.app.request(`/v1/students/${id}/enrolments`, { headers })
    ).json()) as unknown[];
    expect(after).toHaveLength(1);
  });

  it('rejects an unknown tier', async () => {
    const { headers } = await t.signInParent();
    const { id } = (await (
      await createStudent(headers, { nickname: 'bio_owl', avatarCode: 'o', yearGroup: 11 })
    ).json()) as { id: string };
    const res = await t.app.request(
      `/v1/students/${id}/enrolments/gcse-biology`,
      jsonRequest('PUT', { board: 'aqa', tier: 'expert' }, headers),
    );
    expect(res.status).toBe(400);
  });
});
