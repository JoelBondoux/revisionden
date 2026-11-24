import { eq } from 'drizzle-orm';
import type { Database } from './client';
import { authUsers, families, items, parents, students, topics } from './schema';

/** Made-up seed data for local development. Never put real people's details here. */
export const SEED_PARENT = {
  id: 'seed-parent-1',
  email: 'parent@example.com',
} as const;

export const SEED_STUDENTS = [
  { nickname: 'quiz_fox', avatarCode: 'fx01', yearGroup: 11 },
  { nickname: 'brainy_owl', avatarCode: 'ow02', yearGroup: 13 },
] as const;

const SEED_TOPICS = [
  { id: 'seed-maths-algebra', subjectId: 'gcse-maths', board: 'aqa', title: 'Algebra' },
  {
    id: 'seed-maths-linear-equations',
    subjectId: 'gcse-maths',
    board: 'aqa',
    title: 'Linear equations',
    parentTopicId: 'seed-maths-algebra',
  },
];

const SEED_ITEMS = [
  {
    id: 'seed-item-solve-1',
    topicId: 'seed-maths-linear-equations',
    type: 'short_answer',
    body: { prompt: 'Solve 2x + 3 = 11' },
    answer: { value: '4' },
    sourceRef: 'seed',
    checkedBy: 'seed',
  },
];

export interface SeedResult {
  familyId: string;
  students: { id: string; nickname: string }[];
}

/** Inserts one family with two students and a tiny topic tree. Safe to run more than once. */
export async function seed(db: Database): Promise<SeedResult> {
  await db.insert(authUsers).values(SEED_PARENT).onConflictDoNothing();

  const existing = await db
    .select({ familyId: parents.familyId })
    .from(parents)
    .where(eq(parents.authUserId, SEED_PARENT.id));

  let familyId = existing[0]?.familyId;
  if (!familyId) {
    const [family] = await db.insert(families).values({}).returning({ id: families.id });
    familyId = family!.id;
    await db.insert(parents).values({ familyId, authUserId: SEED_PARENT.id });
  }

  await db
    .insert(students)
    .values(SEED_STUDENTS.map((s) => ({ ...s, familyId })))
    .onConflictDoNothing();

  await db.insert(topics).values(SEED_TOPICS).onConflictDoNothing();
  await db.insert(items).values(SEED_ITEMS).onConflictDoNothing();

  const rows = await db
    .select({ id: students.id, nickname: students.nickname })
    .from(students)
    .where(eq(students.familyId, familyId));
  return { familyId, students: rows };
}
