/**
 * Target grades (workstream K8, docs/PRODUCT_RULES.md "Statistics dashboards", Target grades).
 * Each enrolled subject has two targets, both checked against the subject's cited grade scale
 * (packages/core/src/target-grades.ts):
 * - the parent's target, set or cleared by either parent: GET /v1/students/:id/target-grades and
 *   PUT .../target-grades/:subjectId ({ targetGrade: "7" }, or null to clear). B3's activity log
 *   records each change (apps/api/src/family-events.ts, LOGGED_CHANGES);
 * - the child's own target, set or cleared by the child: PUT /v1/student/target-grades/:subjectId.
 *   It is not logged as a change for the parents.
 * Both show on My stats (`targets`) and on the parent dashboard. Predicted grades stay "Not set
 * up yet" until verified grade boundaries exist.
 */
import { Hono } from 'hono';
import { and, asc, eq } from 'drizzle-orm';
import {
  TargetGradeRequestSchema,
  findSubject,
  gradeScaleFor,
  type TargetGrades,
} from '@revisionden/core';
import { enrolments, type Database } from '@revisionden/db';
import type { AppEnv } from '../context';
import { ApiError } from '../errors';
import { requireFamilyStudent } from '../families';
import { readJson } from '../http';
import type { StatsAdapters } from './adapters';

const subjectName = (subjectId: string) => findSubject(subjectId)?.name ?? subjectId;

/**
 * A saved target only counts while it is on the course's current scale: if a parent changes the
 * board or tier (for example higher to foundation), a saved 9 is treated as not set.
 */
const onScale = (grade: string | null, scale: readonly string[] | null) =>
  grade !== null && scale?.includes(grade) ? grade : null;

/** Both targets for each enrolled subject, with the grades they can take. */
export async function targetGrades(db: Database, studentId: string): Promise<TargetGrades> {
  const rows = await db
    .select()
    .from(enrolments)
    .where(eq(enrolments.studentId, studentId))
    .orderBy(asc(enrolments.subjectId));
  return {
    subjects: rows.map((e) => {
      const scale = gradeScaleFor(e);
      return {
        subjectId: e.subjectId,
        name: subjectName(e.subjectId),
        parentTarget: onScale(e.parentTargetGrade, scale),
        studentTarget: onScale(e.studentTargetGrade, scale),
        grades: scale ? [...scale] : null,
      };
    }),
  };
}

/** The dashboard's grades panel: the parent's target; no predicted grade until boundaries are verified. */
export function targetGradeAdapters({ db }: { db: Database }): Pick<StatsAdapters, 'grades'> {
  return {
    grades: async (studentId, subjectId) => {
      const [row] = await db
        .select()
        .from(enrolments)
        .where(and(eq(enrolments.studentId, studentId), eq(enrolments.subjectId, subjectId)));
      const target = row ? onScale(row.parentTargetGrade, gradeScaleFor(row)) : null;
      return { predictedGrade: null, targetGrade: target };
    },
  };
}

/** Checks a target against the subject's scale and saves it in the given column. */
async function saveTarget(
  db: Database,
  studentId: string,
  subjectId: string,
  targetGrade: string | null,
  column: 'parentTargetGrade' | 'studentTargetGrade',
) {
  const where = and(eq(enrolments.studentId, studentId), eq(enrolments.subjectId, subjectId));
  const [row] = await db.select().from(enrolments).where(where);
  if (!row) throw new ApiError(404, 'not_found', 'That subject is not one of the child’s');
  if (targetGrade !== null) {
    const scale = gradeScaleFor(row);
    if (!scale) {
      throw new ApiError(
        422,
        'no_grade_scale',
        'Target grades are not available for this subject yet',
      );
    }
    if (!scale.includes(targetGrade)) {
      throw new ApiError(422, 'grade_not_on_scale', 'That grade is not on this subject’s scale');
    }
  }
  await db
    .update(enrolments)
    .set({ [column]: targetGrade })
    .where(where);
  return targetGrades(db, studentId);
}

/** Mounted under /v1/students, after the parent session check. */
export function parentTargetGradeRoutes({ db }: { db: Database }) {
  const app = new Hono<AppEnv>();
  const own = (familyId: string, id: string) => requireFamilyStudent(db, familyId, id);

  app.get('/:id/target-grades', async (c) => {
    const student = await own(c.var.parent.familyId, c.req.param('id'));
    return c.json(await targetGrades(db, student.id));
  });

  app.put('/:id/target-grades/:subjectId', async (c) => {
    const student = await own(c.var.parent.familyId, c.req.param('id'));
    const { targetGrade } = await readJson(c, TargetGradeRequestSchema);
    return c.json(
      await saveTarget(db, student.id, c.req.param('subjectId'), targetGrade, 'parentTargetGrade'),
    );
  });

  return app;
}

/** Mounted under /v1/student, after the student session check: the child's own target. */
export function studentTargetGradeRoutes({ db }: { db: Database }) {
  const app = new Hono<AppEnv>();
  app.put('/target-grades/:subjectId', async (c) => {
    const { targetGrade } = await readJson(c, TargetGradeRequestSchema);
    const studentId = c.var.student.studentId;
    return c.json(
      await saveTarget(db, studentId, c.req.param('subjectId'), targetGrade, 'studentTargetGrade'),
    );
  });
  return app;
}
