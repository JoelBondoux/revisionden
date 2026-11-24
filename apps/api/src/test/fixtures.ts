import { devices, families, students, type Database } from '@revisionden/db';
import { AVATAR } from './helpers';

let counter = 0;

/** A made-up family with one student and one linked device. No real personal data. */
export async function makeStudentWithDevice(db: Database, nickname?: string) {
  counter += 1;
  const [family] = await db.insert(families).values({}).returning();
  const [student] = await db
    .insert(students)
    .values({
      familyId: family!.id,
      nickname: nickname ?? `test_kid_${counter}`,
      avatarCode: AVATAR,
      yearGroup: 10,
    })
    .returning();
  const [device] = await db
    .insert(devices)
    .values({
      studentId: student!.id,
      credentialId: `cred-${counter}-${crypto.randomUUID()}`,
      publicKey: 'test-public-key',
    })
    .returning();
  return { family: family!, student: student!, device: device! };
}
