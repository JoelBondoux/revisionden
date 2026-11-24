import { devices, families, students, studentSessions, type Database } from '@revisionden/db';
import { STUDENT_COOKIE } from '../routes/devices';
import { hashToken, randomToken } from '../tokens';
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

/** Starts a student device session directly and returns the cookie header for requests. */
export async function studentCookie(db: Database, studentId: string, deviceId: string) {
  const token = randomToken();
  await db.insert(studentSessions).values({
    tokenHash: await hashToken(token),
    studentId,
    deviceId,
    // Far ahead, so tests can move the test clock forward freely.
    expiresAt: new Date('2100-01-01T00:00:00Z'),
  });
  return { cookie: `${STUDENT_COOKIE}=${token}` };
}
