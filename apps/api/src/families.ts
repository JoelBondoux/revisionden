import { and, eq } from 'drizzle-orm';
import { families, parents, students, type Database } from '@revisionden/db';
import { notFound } from './errors';
import { isId } from './validation';

export interface ParentContext {
  parentId: string;
  familyId: string;
  authUserId: string;
  /** 1 or 2: "Parent 1" or "Parent 2" in the family activity log. */
  position: number;
}

/** Finds the parent's family, creating it on first sign-in. Safe if two requests race. */
export async function ensureParent(db: Database, authUserId: string): Promise<ParentContext> {
  const existing = await findParent(db, authUserId);
  if (existing) return existing;

  const [family] = await db.insert(families).values({}).returning({ id: families.id });
  const inserted = await db
    .insert(parents)
    .values({ familyId: family!.id, authUserId })
    .onConflictDoNothing()
    .returning({ id: parents.id, familyId: parents.familyId });
  if (inserted[0]) {
    return { parentId: inserted[0].id, familyId: inserted[0].familyId, authUserId, position: 1 };
  }

  // Another request created the parent first: drop our unused family and use theirs.
  await db.delete(families).where(eq(families.id, family!.id));
  return (await findParent(db, authUserId))!;
}

export async function findParent(db: Database, authUserId: string): Promise<ParentContext | undefined> {
  const [row] = await db
    .select({ parentId: parents.id, familyId: parents.familyId, position: parents.position })
    .from(parents)
    .where(eq(parents.authUserId, authUserId));
  return row && { ...row, authUserId };
}

/** The student, only if it belongs to the given family. */
export async function findFamilyStudent(db: Database, familyId: string, studentId: string) {
  const [row] = await db
    .select()
    .from(students)
    .where(and(eq(students.id, studentId), eq(students.familyId, familyId)));
  return row;
}

/** Like findFamilyStudent, but a missing or foreign student is a 404. */
export async function requireFamilyStudent(db: Database, familyId: string, studentId: string) {
  if (!isId(studentId)) throw notFound('Student not found');
  const student = await findFamilyStudent(db, familyId, studentId);
  if (!student) throw notFound('Student not found');
  return student;
}
