import { Hono } from 'hono';
import { and, asc, eq } from 'drizzle-orm';
import {
  CreateEnrolmentRequestSchema,
  CreateStudentRequestSchema,
  UpdateStudentRequestSchema,
  type Enrolment,
  type Student,
} from '@revisionden/core';
import { enrolments, students, type Database } from '@revisionden/db';
import type { AppEnv } from '../context';
import { ApiError } from '../errors';
import { requireFamilyStudent } from '../families';
import { isUniqueViolation, readJson } from '../http';

type StudentRow = typeof students.$inferSelect;
type EnrolmentRow = typeof enrolments.$inferSelect;

export const toStudent = (s: StudentRow): Student => ({
  id: s.id,
  nickname: s.nickname,
  avatarCode: s.avatarCode,
  yearGroup: s.yearGroup,
});

const toEnrolment = (e: EnrolmentRow): Enrolment => ({
  studentId: e.studentId,
  subjectId: e.subjectId,
  board: e.board as Enrolment['board'],
  tier: e.tier as Enrolment['tier'],
  ...(e.specVersion ? { specVersion: e.specVersion } : {}),
});

const nicknameTaken = () =>
  new ApiError(409, 'nickname_taken', 'Another student in the family has that nickname');

/** Parent routes for student profiles and enrolments. Every query is scoped to the family. */
export function studentRoutes(db: Database) {
  const app = new Hono<AppEnv>();
  const ownStudent = (familyId: string, id: string) => requireFamilyStudent(db, familyId, id);

  app.get('/', async (c) => {
    const rows = await db
      .select()
      .from(students)
      .where(eq(students.familyId, c.var.parent.familyId))
      .orderBy(asc(students.createdAt), asc(students.nickname));
    return c.json({ students: rows.map(toStudent) });
  });

  app.post('/', async (c) => {
    const input = await readJson(c, CreateStudentRequestSchema);
    try {
      const [row] = await db
        .insert(students)
        .values({ ...input, familyId: c.var.parent.familyId })
        .returning();
      return c.json(toStudent(row!), 201);
    } catch (err) {
      if (isUniqueViolation(err, 'students_family_nickname_unique')) throw nicknameTaken();
      throw err;
    }
  });

  app.get('/:id', async (c) => {
    return c.json(toStudent(await ownStudent(c.var.parent.familyId, c.req.param('id'))));
  });

  app.patch('/:id', async (c) => {
    const student = await ownStudent(c.var.parent.familyId, c.req.param('id'));
    const input = await readJson(c, UpdateStudentRequestSchema);
    try {
      const [row] = await db
        .update(students)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(students.id, student.id))
        .returning();
      return c.json(toStudent(row!));
    } catch (err) {
      if (isUniqueViolation(err, 'students_family_nickname_unique')) throw nicknameTaken();
      throw err;
    }
  });

  app.delete('/:id', async (c) => {
    const student = await ownStudent(c.var.parent.familyId, c.req.param('id'));
    await db.delete(students).where(eq(students.id, student.id));
    return c.body(null, 204);
  });

  app.get('/:id/enrolments', async (c) => {
    const student = await ownStudent(c.var.parent.familyId, c.req.param('id'));
    const rows = await db
      .select()
      .from(enrolments)
      .where(eq(enrolments.studentId, student.id))
      .orderBy(asc(enrolments.subjectId));
    return c.json({ enrolments: rows.map(toEnrolment) });
  });

  /** Enrols the student in a subject, or replaces the existing enrolment for that subject. */
  app.post('/:id/enrolments', async (c) => {
    const student = await ownStudent(c.var.parent.familyId, c.req.param('id'));
    const input = await readJson(c, CreateEnrolmentRequestSchema);
    const values = {
      board: input.board,
      tier: input.tier,
      specVersion: input.specVersion ?? null,
    };
    const [row] = await db
      .insert(enrolments)
      .values({ studentId: student.id, subjectId: input.subjectId, ...values })
      .onConflictDoUpdate({ target: [enrolments.studentId, enrolments.subjectId], set: values })
      .returning();
    return c.json(toEnrolment(row!));
  });

  app.delete('/:id/enrolments/:subjectId', async (c) => {
    const student = await ownStudent(c.var.parent.familyId, c.req.param('id'));
    await db
      .delete(enrolments)
      .where(
        and(
          eq(enrolments.studentId, student.id),
          eq(enrolments.subjectId, c.req.param('subjectId')),
        ),
      );
    return c.body(null, 204);
  });

  return app;
}
