/**
 * Target grades (workstream K8, docs/PRODUCT_RULES.md "Target grades").
 * - Parent (either parent of the family): GET /v1/students/:id/target-grades lists each enrolled
 *   subject with its target and the grades it can take; PUT .../target-grades/:subjectId sets
 *   ({ targetGrade: "7" }) or clears ({ targetGrade: null }) one. The grade must be on the
 *   subject's cited grade scale (packages/core/src/target-grades.ts). B3's activity log records
 *   each change (apps/api/src/family-events.ts, LOGGED_CHANGES).
 * - The student sees their targets, read-only, on My stats; the parent dashboard shows them per
 *   subject. Predicted grades stay "Not set up yet" until verified grade boundaries exist.
 */
import { Hono } from 'hono';
import { and, asc, eq } from 'drizzle-orm';
import {
  TargetGradeRequestSchema,
  findSubject,
  gradeScaleFor,
  type ParentTargetGrades,
  type StudentStats,
} from '@revisionden/core';
import { enrolments, type Database } from '@revisionden/db';
import type { AppEnv } from '../context';
import { ApiError } from '../errors';
import { requireFamilyStudent } from '../families';
import { readJson } from '../http';
import type { StatsAdapters } from './adapters';

const subjectName = (subjectId: string) => findSubject(subjectId)?.name ?? subjectId;

async function enrolled(db: Database, studentId: string) {
  return db
    .select()
    .from(enrolments)
    .where(eq(enrolments.studentId, studentId))
    .orderBy(asc(enrolments.subjectId));
}

export async function parentTargetGrades(
  db: Database,
  studentId: string,
): Promise<ParentTargetGrades> {
  const rows = await enrolled(db, studentId);
  return {
    subjects: rows.map((e) => {
      const scale = gradeScaleFor(e);
      return {
        subjectId: e.subjectId,
        name: subjectName(e.subjectId),
        targetGrade: e.targetGrade,
        grades: scale ? [...scale] : null,
      };
    }),
  };
}

/** The student's targets for My stats: only subjects with a target set. */
export async function studentTargets(
  db: Database,
  studentId: string,
): Promise<StudentStats['targets']> {
  const rows = await enrolled(db, studentId);
  return rows.flatMap((e) =>
    e.targetGrade === null
      ? []
      : [{ subjectId: e.subjectId, name: subjectName(e.subjectId), targetGrade: e.targetGrade }],
  );
}

/** The dashboard's grades panel: the target; no predicted grade until boundaries are verified. */
export function targetGradeAdapters({ db }: { db: Database }): Pick<StatsAdapters, 'grades'> {
  return {
    grades: async (studentId, subjectId) => {
      const [row] = await db
        .select({ targetGrade: enrolments.targetGrade })
        .from(enrolments)
        .where(and(eq(enrolments.studentId, studentId), eq(enrolments.subjectId, subjectId)));
      return { predictedGrade: null, targetGrade: row?.targetGrade ?? null };
    },
  };
}

/** Mounted under /v1/students, after the parent session check. */
export function parentTargetGradeRoutes({ db }: { db: Database }) {
  const app = new Hono<AppEnv>();
  const own = (familyId: string, id: string) => requireFamilyStudent(db, familyId, id);

  app.get('/:id/target-grades', async (c) => {
    const student = await own(c.var.parent.familyId, c.req.param('id'));
    return c.json(await parentTargetGrades(db, student.id));
  });

  app.put('/:id/target-grades/:subjectId', async (c) => {
    const student = await own(c.var.parent.familyId, c.req.param('id'));
    const subjectId = c.req.param('subjectId');
    const { targetGrade } = await readJson(c, TargetGradeRequestSchema);
    const where = and(eq(enrolments.studentId, student.id), eq(enrolments.subjectId, subjectId));
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
    await db.update(enrolments).set({ targetGrade }).where(where);
    return c.json(await parentTargetGrades(db, student.id));
  });

  return app;
}
