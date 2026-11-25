import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { createTestDb } from '@revisionden/db/testing';
import {
  authAccounts,
  authSessions,
  authUsers,
  authVerifications,
  deviceLinkTokens,
  devices,
  families,
  parents,
  operatorAuditLog,
  passkeyChallenges,
  studentSessions,
  students,
  type Database,
} from '@revisionden/db';
import type { PGlite } from '@electric-sql/pglite';
import { cleanUpExpiredData, INACTIVE_WARNING_AFTER_MONTHS, monthsBefore } from './cleanup';

const NOW = new Date('2026-11-25T12:00:00Z');
const minutes = (n: number) => new Date(NOW.getTime() + n * 60_000);

let db: Database;
let client: PGlite;
let counter = 0;

beforeAll(async () => {
  const test = await createTestDb();
  db = test.db as unknown as Database;
  client = test.client;
});

afterAll(async () => {
  await client.close();
});

/** A family with one parent sign-in and one student with a linked device. */
async function family(lastActiveAt: Date) {
  counter += 1;
  const [fam] = await db.insert(families).values({ lastActiveAt }).returning();
  const userId = `cleanup-parent-${counter}`;
  await db.insert(authUsers).values({ id: userId, email: `cleanup${counter}@example.com` });
  await db
    .insert(authAccounts)
    .values({ id: `acct-${counter}`, accountId: `p-${counter}`, providerId: 'google', userId });
  await db.insert(parents).values({ familyId: fam!.id, authUserId: userId });
  const [student] = await db
    .insert(students)
    .values({ familyId: fam!.id, nickname: `kid_${counter}`, avatarCode: 'a1', yearGroup: 10 })
    .returning();
  const [device] = await db
    .insert(devices)
    .values({ studentId: student!.id, credentialId: `cred-${counter}`, publicKey: 'test' })
    .returning();
  return { familyId: fam!.id, userId, studentId: student!.id, deviceId: device!.id };
}

describe('monthsBefore', () => {
  it('goes back whole calendar months', () => {
    expect(monthsBefore(NOW, 12)).toEqual(new Date('2025-11-25T12:00:00Z'));
    expect(monthsBefore(NOW, 11)).toEqual(new Date('2025-12-25T12:00:00Z'));
  });

  it('warns from 11 months', () => {
    expect(INACTIVE_WARNING_AFTER_MONTHS).toBe(11);
  });
});

describe('scheduled clean-up', () => {
  it('deletes expired device link codes and keeps ones still valid', async () => {
    const f = await family(NOW);
    await db.insert(deviceLinkTokens).values([
      {
        tokenHash: 'expired-link',
        familyId: f.familyId,
        studentId: f.studentId,
        expiresAt: minutes(-1),
      },
      {
        tokenHash: 'live-link',
        familyId: f.familyId,
        studentId: f.studentId,
        expiresAt: minutes(5),
      },
    ]);
    const result = await cleanUpExpiredData({ db, now: NOW });
    expect(result.linkTokensDeleted).toBe(1);
    const left = await db.select().from(deviceLinkTokens);
    expect(left.map((r) => r.tokenHash)).toEqual(['live-link']);
  });

  it('deletes expired student sessions and keeps live ones', async () => {
    const f = await family(NOW);
    await db.insert(studentSessions).values([
      {
        tokenHash: 'old-session',
        studentId: f.studentId,
        deviceId: f.deviceId,
        expiresAt: minutes(-1),
      },
      {
        tokenHash: 'live-session',
        studentId: f.studentId,
        deviceId: f.deviceId,
        expiresAt: minutes(60),
      },
    ]);
    const result = await cleanUpExpiredData({ db, now: NOW });
    expect(result.studentSessionsDeleted).toBe(1);
    const left = await db
      .select()
      .from(studentSessions)
      .where(eq(studentSessions.studentId, f.studentId));
    expect(left.map((r) => r.tokenHash)).toEqual(['live-session']);
  });

  it('deletes expired parent sessions and keeps live ones', async () => {
    const f = await family(NOW);
    await db.insert(authSessions).values([
      { id: 'old-parent-session', token: 'old-t', userId: f.userId, expiresAt: minutes(-1) },
      { id: 'live-parent-session', token: 'live-t', userId: f.userId, expiresAt: minutes(60) },
    ]);
    const result = await cleanUpExpiredData({ db, now: NOW });
    expect(result.parentSessionsDeleted).toBe(1);
    const left = await db.select().from(authSessions).where(eq(authSessions.userId, f.userId));
    expect(left.map((r) => r.id)).toEqual(['live-parent-session']);
  });

  it('deletes expired passkey challenges and sign-in checks', async () => {
    await db.insert(passkeyChallenges).values([
      { kind: 'unlock', challenge: 'old-challenge', expiresAt: minutes(-1) },
      { kind: 'unlock', challenge: 'live-challenge', expiresAt: minutes(5) },
    ]);
    await db.insert(authVerifications).values([
      { id: 'old-check', identifier: 'state', value: 'x', expiresAt: minutes(-1) },
      { id: 'live-check', identifier: 'state', value: 'y', expiresAt: minutes(5) },
    ]);
    const result = await cleanUpExpiredData({ db, now: NOW });
    expect(result.challengesDeleted).toBe(1);
    expect(result.verificationsDeleted).toBe(1);
    expect((await db.select().from(passkeyChallenges)).map((r) => r.challenge)).toEqual([
      'live-challenge',
    ]);
    expect((await db.select().from(authVerifications)).map((r) => r.id)).toEqual(['live-check']);
  });
});

describe('inactive accounts', () => {
  it('deletes operator audit entries older than 2 years (AppDeck bridge)', async () => {
    await db.insert(operatorAuditLog).values({
      operatorEmail: 'agent@example.com',
      operatorRole: 'agent',
      action: 'family.view',
      requestId: 'cleanup-old',
      outcome: 'ok',
      createdAt: new Date('2024-11-25T11:59:00Z'),
    });
    const result = await cleanUpExpiredData({ db, now: NOW });
    expect(result.operatorAuditDeleted).toBe(1);
  });

  it('deletes a family unused for more than 12 months, with its students and parent sign-in', async () => {
    const old = await family(new Date('2025-11-25T11:59:59Z'));
    const result = await cleanUpExpiredData({ db, now: NOW });
    expect(result.inactiveFamiliesDeleted).toBeGreaterThanOrEqual(1);
    expect(await db.select().from(families).where(eq(families.id, old.familyId))).toEqual([]);
    expect(await db.select().from(students).where(eq(students.id, old.studentId))).toEqual([]);
    expect(await db.select().from(authUsers).where(eq(authUsers.id, old.userId))).toEqual([]);
    expect(await db.select().from(authAccounts).where(eq(authAccounts.userId, old.userId))).toEqual(
      [],
    );
  });

  it('keeps a family used exactly 12 months ago or more recently', async () => {
    const edge = await family(new Date('2025-11-25T12:00:00Z'));
    const recent = await family(new Date('2026-06-01T00:00:00Z'));
    await cleanUpExpiredData({ db, now: NOW });
    const left = await db
      .select({ id: families.id })
      .from(families)
      .where(inArray(families.id, [edge.familyId, recent.familyId]));
    expect(left).toHaveLength(2);
    expect(await db.select().from(authUsers).where(eq(authUsers.id, edge.userId))).toHaveLength(1);
  });

  it('deletes a sign-in that never became a family once it is 12 months old', async () => {
    await db.insert(authUsers).values([
      {
        id: 'lonely-old',
        email: 'lonely-old@example.com',
        createdAt: new Date('2025-11-01T00:00:00Z'),
      },
      {
        id: 'lonely-new',
        email: 'lonely-new@example.com',
        createdAt: new Date('2026-11-01T00:00:00Z'),
      },
    ]);
    await cleanUpExpiredData({ db, now: NOW });
    const ids = (
      await db
        .select({ id: authUsers.id })
        .from(authUsers)
        .where(inArray(authUsers.id, ['lonely-old', 'lonely-new']))
    ).map((r) => r.id);
    expect(ids).toEqual(['lonely-new']);
  });
});
