import { afterEach, describe, expect, it } from 'vitest';
import { ParentTargetGradesSchema, StudentStatsSchema } from '@revisionden/core';
import { targetGradeAdapters } from './target-grades';
import { createTestContext, jsonRequest, type TestContext } from '../test/helpers';

let ctx: TestContext;
afterEach(async () => ctx?.close());

type H = Record<string, string>;

/** A child with Maths (Edexcel, higher) and Maths-free History (AQA): one cited scale, one not. */
async function setUp() {
  ctx = await createTestContext();
  const family = await ctx.familyStudent('target_kid');
  const enrol = (subjectId: string, board: string, tier: string) =>
    ctx.app.request(
      `/v1/students/${family.studentId}/enrolments`,
      jsonRequest('POST', { subjectId, board, tier }, family.parent.headers),
    );
  expect((await enrol('gcse-maths', 'Edexcel', 'higher')).ok).toBe(true);
  expect((await enrol('gcse-history', 'AQA', 'none')).ok).toBe(true);
  return family;
}

const view = async (studentId: string, headers: H) => {
  const res = await ctx.app.request(`/v1/students/${studentId}/target-grades`, { headers });
  expect(res.status).toBe(200);
  return ParentTargetGradesSchema.parse(await res.json()).subjects;
};

const put = (studentId: string, subjectId: string, targetGrade: string | null, headers: H) =>
  ctx.app.request(
    `/v1/students/${studentId}/target-grades/${subjectId}`,
    jsonRequest('PUT', { targetGrade }, headers),
  );

describe('target grades for the parent', () => {
  it('lists each enrolled subject with the grades a target can take', async () => {
    const { studentId, parent } = await setUp();
    expect(await view(studentId, parent.headers)).toEqual([
      {
        subjectId: 'gcse-history',
        name: 'History',
        targetGrade: null,
        grades: null,
      },
      {
        subjectId: 'gcse-maths',
        name: 'Maths',
        targetGrade: null,
        grades: ['9', '8', '7', '6', '5', '4', '3', 'U'],
      },
    ]);
  });

  it('sets and clears a target on the scale', async () => {
    const { studentId, parent } = await setUp();
    const res = await put(studentId, 'gcse-maths', '7', parent.headers);
    expect(res.status).toBe(200);
    expect(
      ParentTargetGradesSchema.parse(await res.json()).subjects.find(
        (s) => s.subjectId === 'gcse-maths',
      )?.targetGrade,
    ).toBe('7');
    expect((await put(studentId, 'gcse-maths', null, parent.headers)).status).toBe(200);
    expect((await view(studentId, parent.headers))[1]!.targetGrade).toBeNull();
  });

  it('refuses a grade off the scale, or any grade where no scale is cited', async () => {
    const { studentId, parent } = await setUp();
    const off = await put(studentId, 'gcse-maths', '2', parent.headers);
    expect(off.status).toBe(422);
    expect(await off.json()).toMatchObject({ error: { code: 'grade_not_on_scale' } });
    const none = await put(studentId, 'gcse-history', '7', parent.headers);
    expect(none.status).toBe(422);
    expect(await none.json()).toMatchObject({ error: { code: 'no_grade_scale' } });
    expect((await put(studentId, 'gcse-maths', '', parent.headers)).status).toBe(400);
  });

  it('keeps other families and unenrolled subjects out', async () => {
    const { studentId, parent } = await setUp();
    const other = await ctx.signInParent();
    expect(
      (await ctx.app.request(`/v1/students/${studentId}/target-grades`, { headers: other.headers }))
        .status,
    ).toBe(404);
    expect((await put(studentId, 'gcse-maths', '7', other.headers)).status).toBe(404);
    expect((await put(studentId, 'gcse-physics', '7', parent.headers)).status).toBe(404);
  });

  it('logs a change by either parent as important for the other', async () => {
    const { studentId, parent } = await setUp();
    const invite = await ctx.app.request(
      '/v1/family/invites',
      jsonRequest('POST', {}, parent.headers),
    );
    const { code } = (await invite.json()) as { code: string };
    const second = await ctx.signInParent();
    await ctx.app.request('/v1/family/join', jsonRequest('POST', { code }, second.headers));
    expect((await put(studentId, 'gcse-maths', '8', second.headers)).status).toBe(200);
    // Refused changes are not logged.
    await put(studentId, 'gcse-maths', '2', second.headers);
    const res = await ctx.app.request('/v1/family/events', { headers: parent.headers });
    const { events } = (await res.json()) as {
      events: { kind: string; by: string; what: string; isNew: boolean }[];
    };
    expect(events.filter((e) => e.kind === 'target_changed')).toEqual([
      expect.objectContaining({
        by: 'Parent 2',
        what: "changed target_kid's target grades",
        isNew: true,
      }),
    ]);
  });
});

describe('target grades for the student', () => {
  it('shows the targets a parent set on My stats, read-only', async () => {
    const { studentId, parent, headers } = await setUp();
    await put(studentId, 'gcse-maths', '7', parent.headers);
    const res = await ctx.app.request('/v1/student/stats', { headers });
    expect(StudentStatsSchema.parse(await res.json()).targets).toEqual([
      { subjectId: 'gcse-maths', name: 'Maths', targetGrade: '7' },
    ]);
    // The student cannot change it.
    const own = await ctx.app.request(
      `/v1/students/${studentId}/target-grades/gcse-maths`,
      jsonRequest('PUT', { targetGrade: '9' }, headers),
    );
    expect(own.status).toBe(401);
  });

  it('gives the dashboard the target and no predicted grade (not built until verified boundaries exist)', async () => {
    const { studentId, parent } = await setUp();
    await put(studentId, 'gcse-maths', '6', parent.headers);
    const grades = targetGradeAdapters({ db: ctx.db }).grades!;
    expect(await grades(studentId, 'gcse-maths')).toEqual({
      predictedGrade: null,
      targetGrade: '6',
    });
    expect(await grades(studentId, 'gcse-history')).toEqual({
      predictedGrade: null,
      targetGrade: null,
    });
  });
});

describe('target grades in the family data download', () => {
  it('includes the target with the child’s courses', async () => {
    const { studentId, parent } = await setUp();
    await put(studentId, 'gcse-maths', '7', parent.headers);
    const res = await ctx.app.request('/v1/export', { headers: parent.headers });
    const data = (await res.json()) as {
      students: { courses: { subjectId: string; targetGrade: string | null }[] }[];
    };
    expect(data.students[0]!.courses).toContainEqual(
      expect.objectContaining({ subjectId: 'gcse-maths', targetGrade: '7' }),
    );
  });
});
