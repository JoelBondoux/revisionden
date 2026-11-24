import { and, eq } from 'drizzle-orm';
import { families, parents, students, type Database } from '@revisionden/db';

export interface ParentContext {
  parentId: string;
  familyId: string;
  authUserId: string;
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
  if (inserted[0]) return { parentId: inserted[0].id, familyId: inserted[0].familyId, authUserId };

  // Another request created the parent first: drop our unused family and use theirs.
  await db.delete(families).where(eq(families.id, family!.id));
  return (await findParent(db, authUserId))!;
}

async function findParent(db: Database, authUserId: string): Promise<ParentContext | undefined> {
  const [row] = await db
    .select({ parentId: parents.id, familyId: parents.familyId })
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
