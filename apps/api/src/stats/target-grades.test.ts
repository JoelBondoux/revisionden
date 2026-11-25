import { afterEach, describe, expect, it } from 'vitest';
import { StudentStatsSchema, TargetGradesSchema } from '@revisionden/core';
import { targetGradeAdapters } from './target-grades';
import { createTestContext, jsonRequest, type TestContext } from '../test/helpers';

let ctx: TestContext;
afterEach(async () => ctx?.close());

type H = Record<string, string>;
const HIGHER = ['9', '8', '7', '6', '5', '4', '3', 'U'];

/** A child with Maths (Edexcel, higher: a cited scale) and History (AQA: no cited scale). */
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

const parentView = async (studentId: string, headers: H) => {
  const res = await ctx.app.request(`/v1/students/${studentId}/target-grades`, { headers });
  expect(res.status).toBe(200);
  return TargetGradesSchema.parse(await res.json()).subjects;
};

const studentTargets = async (headers: H) => {
  const res = await ctx.app.request('/v1/student/stats', { headers });
  expect(res.status).toBe(200);
  return StudentStatsSchema.parse(await res.json()).targets;
};

const setParent = (studentId: string, subjectId: string, targetGrade: string | null, headers: H) =>
  ctx.app.request(
    `/v1/students/${studentId}/target-grades/${subjectId}`,
    jsonRequest('PUT', { targetGrade }, headers),
  );

const setOwn = (subjectId: string, targetGrade: string | null, headers: H) =>
  ctx.app.request(
    `/v1/student/target-grades/${subjectId}`,
    jsonRequest('PUT', { targetGrade }, headers),
  );

const mathsOf = <T extends { subjectId: string }>(rows: T[]) =>
  rows.find((r) => r.subjectId === 'gcse-maths')!;

const NO_TARGETS = { parentTarget: null, studentTarget: null };

describe('the parent’s target', () => {
  it('lists each enrolled subject with both targets and the grades they can take', async () => {
    const { studentId, parent } = await setUp();
    expect(await parentView(studentId, parent.headers)).toEqual([
      { subjectId: 'gcse-history', name: 'History', ...NO_TARGETS, grades: null },
      { subjectId: 'gcse-maths', name: 'Maths', ...NO_TARGETS, grades: HIGHER },
    ]);
  });

  it('sets and clears the parent’s target on the scale', async () => {
    const { studentId, parent } = await setUp();
    const res = await setParent(studentId, 'gcse-maths', '7', parent.headers);
    expect(res.status).toBe(200);
    expect(mathsOf(TargetGradesSchema.parse(await res.json()).subjects).parentTarget).toBe('7');
    expect((await setParent(studentId, 'gcse-maths', null, parent.headers)).status).toBe(200);
    expect(mathsOf(await parentView(studentId, parent.headers)).parentTarget).toBeNull();
  });

  it('refuses a grade off the scale, or any grade where no scale is cited', async () => {
    const { studentId, parent } = await setUp();
    const off = await setParent(studentId, 'gcse-maths', '2', parent.headers);
    expect(off.status).toBe(422);
    expect(await off.json()).toMatchObject({ error: { code: 'grade_not_on_scale' } });
    const none = await setParent(studentId, 'gcse-history', '7', parent.headers);
    expect(none.status).toBe(422);
    expect(await none.json()).toMatchObject({ error: { code: 'no_grade_scale' } });
    expect((await setParent(studentId, 'gcse-maths', '', parent.headers)).status).toBe(400);
  });

  it('keeps other families and unenrolled subjects out', async () => {
    const { studentId, parent } = await setUp();
    const other = await ctx.signInParent();
    const theirs = await ctx.app.request(`/v1/students/${studentId}/target-grades`, {
      headers: other.headers,
    });
    expect(theirs.status).toBe(404);
    expect((await setParent(studentId, 'gcse-maths', '7', other.headers)).status).toBe(404);
    expect((await setParent(studentId, 'gcse-physics', '7', parent.headers)).status).toBe(404);
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
    expect((await setParent(studentId, 'gcse-maths', '8', second.headers)).status).toBe(200);
    // Refused changes are not logged.
    await setParent(studentId, 'gcse-maths', '2', second.headers);
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

describe('the child’s own target', () => {
  it('shows both targets for every enrolled subject on My stats', async () => {
    const { studentId, parent, headers } = await setUp();
    await setParent(studentId, 'gcse-maths', '7', parent.headers);
    expect(await studentTargets(headers)).toEqual([
      { subjectId: 'gcse-history', name: 'History', ...NO_TARGETS, grades: null },
      {
        subjectId: 'gcse-maths',
        name: 'Maths',
        parentTarget: '7',
        studentTarget: null,
        grades: HIGHER,
      },
    ]);
  });

  it('lets the child set and clear their own target, which the parent then sees', async () => {
    const { studentId, parent, headers } = await setUp();
    await setParent(studentId, 'gcse-maths', '6', parent.headers);
    const res = await setOwn('gcse-maths', '8', headers);
    expect(res.status).toBe(200);
    expect(mathsOf(TargetGradesSchema.parse(await res.json()).subjects)).toMatchObject({
      parentTarget: '6',
      studentTarget: '8',
    });
    expect(mathsOf(await parentView(studentId, parent.headers)).studentTarget).toBe('8');
    expect((await setOwn('gcse-maths', null, headers)).status).toBe(200);
    expect(mathsOf(await studentTargets(headers))).toMatchObject({
      parentTarget: '6',
      studentTarget: null,
    });
  });

  it('checks the child’s target against the same scale', async () => {
    const { headers } = await setUp();
    expect((await setOwn('gcse-maths', '2', headers)).status).toBe(422);
    expect((await setOwn('gcse-history', '7', headers)).status).toBe(422);
    expect((await setOwn('gcse-physics', '7', headers)).status).toBe(404);
    const signedOut = await ctx.app.request(
      '/v1/student/target-grades/gcse-maths',
      jsonRequest('PUT', { targetGrade: '7' }, {}),
    );
    expect(signedOut.status).toBe(401);
  });

  it('keeps the child off the parent’s target', async () => {
    const { studentId, headers } = await setUp();
    expect((await setParent(studentId, 'gcse-maths', '9', headers)).status).toBe(401);
  });

  it('does not log the child’s own target as a change for the parents', async () => {
    const { parent, headers } = await setUp();
    expect((await setOwn('gcse-maths', '8', headers)).status).toBe(200);
    const res = await ctx.app.request('/v1/family/events', { headers: parent.headers });
    const { events } = (await res.json()) as { events: { kind: string }[] };
    expect(events.filter((e) => e.kind === 'target_changed')).toEqual([]);
  });
});

describe('targets after the course changes', () => {
  it('treats a target that is no longer on the scale as not set', async () => {
    const { studentId, parent, headers } = await setUp();
    await setParent(studentId, 'gcse-maths', '9', parent.headers);
    await setOwn('gcse-maths', '4', headers);
    // The parent moves the child to the foundation tier, whose grades stop at 5.
    const moved = await ctx.app.request(
      `/v1/students/${studentId}/enrolments`,
      jsonRequest(
        'POST',
        { subjectId: 'gcse-maths', board: 'Edexcel', tier: 'foundation' },
        parent.headers,
      ),
    );
    expect(moved.ok).toBe(true);
    expect(mathsOf(await parentView(studentId, parent.headers))).toMatchObject({
      parentTarget: null,
      studentTarget: '4',
      grades: ['5', '4', '3', '2', '1', 'U'],
    });
    expect(mathsOf(await studentTargets(headers)).parentTarget).toBeNull();
    const grades = targetGradeAdapters({ db: ctx.db }).grades!;
    expect((await grades(studentId, 'gcse-maths')).targetGrade).toBeNull();
  });
});

describe('target grades elsewhere', () => {
  it('gives the dashboard the parent’s target and no predicted grade yet', async () => {
    // Predicted grades are not built until verified grade boundaries exist.
    const { studentId, parent, headers } = await setUp();
    await setParent(studentId, 'gcse-maths', '6', parent.headers);
    await setOwn('gcse-maths', '7', headers);
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

  it('includes both targets with the child’s courses in the family data download', async () => {
    const { studentId, parent, headers } = await setUp();
    await setParent(studentId, 'gcse-maths', '7', parent.headers);
    await setOwn('gcse-maths', '8', headers);
    const res = await ctx.app.request('/v1/export', { headers: parent.headers });
    const data = (await res.json()) as { students: { courses: Record<string, unknown>[] }[] };
    expect(data.students[0]!.courses).toContainEqual(
      expect.objectContaining({
        subjectId: 'gcse-maths',
        parentTargetGrade: '7',
        studentTargetGrade: '8',
      }),
    );
  });
});
