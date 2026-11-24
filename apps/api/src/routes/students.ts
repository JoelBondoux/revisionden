import { Hono } from 'hono';
import { and, asc, eq } from 'drizzle-orm';
import { enrolments, students, type Database } from '@revisionden/db';
import type { AppEnv } from '../context';
import { ApiError } from '../errors';
import { requireFamilyStudent } from '../families';
import { isUniqueViolation, readJson } from '../http';
import {
  createStudentSchema,
  enrolmentSchema,
  subjectIdSchema,
  updateStudentSchema,
} from '../validation';

type StudentRow = typeof students.$inferSelect;

const toStudent = (s: StudentRow) => ({
  id: s.id,
  nickname: s.nickname,
  avatarCode: s.avatarCode,
  yearGroup: s.yearGroup,
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
    return c.json(rows.map(toStudent));
  });

  app.post('/', async (c) => {
    const input = await readJson(c, createStudentSchema);
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
    const input = await readJson(c, updateStudentSchema);
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
      .select({
        subjectId: enrolments.subjectId,
        board: enrolments.board,
        tier: enrolments.tier,
        specVersion: enrolments.specVersion,
      })
      .from(enrolments)
      .where(eq(enrolments.studentId, student.id))
      .orderBy(asc(enrolments.subjectId));
    return c.json(rows);
  });

  app.put('/:id/enrolments/:subjectId', async (c) => {
    const student = await ownStudent(c.var.parent.familyId, c.req.param('id'));
    const subjectId = subjectIdSchema.parse(c.req.param('subjectId'));
    const input = await readJson(c, enrolmentSchema);
    const values = {
      board: input.board,
      tier: input.tier ?? null,
      specVersion: input.specVersion ?? null,
    };
    await db
      .insert(enrolments)
      .values({ studentId: student.id, subjectId, ...values })
      .onConflictDoUpdate({ target: [enrolments.studentId, enrolments.subjectId], set: values });
    return c.json({ subjectId, ...values });
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
