import { Hono, type MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { z } from 'zod';
import {
  deviceLinkTokens,
  devices,
  passkeyChallenges,
  students,
  studentSessions,
  type Database,
} from '@revisionden/db';
import type { AppEnv } from '../context';
import type { AppConfig } from '../env';
import { ApiError, notFound, unauthorized } from '../errors';
import { requireFamilyStudent } from '../families';
import { readJson } from '../http';
import type { PasskeyService } from '../passkeys';
import type { Clock } from '../rate-limit';
import { hashToken, randomToken } from '../tokens';
import { uuidSchema } from '../validation';

export const LINK_TOKEN_TTL_MS = 10 * 60 * 1000;
export const CHALLENGE_TTL_MS = 5 * 60 * 1000;
export const STUDENT_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const STUDENT_COOKIE = '__Host-rd_student';

export interface DeviceDeps {
  db: Database;
  config: AppConfig;
  clock: Clock;
  passkeys: PasskeyService;
}

const invalidLinkToken = () =>
  new ApiError(
    400,
    'invalid_link_token',
    'This code has expired or was already used. Ask a parent for a new one.',
  );
const invalidChallenge = () =>
  new ApiError(400, 'invalid_challenge', 'This sign-in attempt has expired. Please start again.');
const passkeyNotVerified = () =>
  new ApiError(400, 'passkey_not_verified', 'The passkey could not be checked.');

const toStudent = (s: typeof students.$inferSelect) => ({
  id: s.id,
  nickname: s.nickname,
  avatarCode: s.avatarCode,
  yearGroup: s.yearGroup,
});

const redeemSchema = z.strictObject({ token: z.string().min(16).max(128), familyId: z.string() });
const credentialResponse = z.looseObject({ id: z.string().min(1), response: z.looseObject({}) });
const verifySchema = z.strictObject({ challengeId: z.string(), response: credentialResponse });
const unlockOptionsSchema = z.strictObject({
  credentialIds: z.array(z.string()).max(10).optional(),
});

/** Parent routes under /v1/students: create link tokens, list and unlink devices. */
export function parentDeviceRoutes({ db, config, clock }: DeviceDeps) {
  const app = new Hono<AppEnv>();

  app.post('/:id/link-tokens', async (c) => {
    const { familyId } = c.var.parent;
    const student = await requireFamilyStudent(db, familyId, c.req.param('id'));
    const token = randomToken();
    const expiresAt = new Date(clock.now().getTime() + LINK_TOKEN_TTL_MS);
    await db.insert(deviceLinkTokens).values({
      tokenHash: await hashToken(token),
      familyId,
      studentId: student.id,
      expiresAt,
    });
    const linkUrl = new URL('/link', config.webOrigin);
    linkUrl.searchParams.set('token', token);
    linkUrl.searchParams.set('family', familyId);
    return c.json(
      {
        token,
        familyId,
        studentId: student.id,
        expiresAt: expiresAt.toISOString(),
        linkUrl: linkUrl.toString(),
      },
      201,
    );
  });

  app.get('/:id/devices', async (c) => {
    const student = await requireFamilyStudent(db, c.var.parent.familyId, c.req.param('id'));
    const rows = await db
      .select({ id: devices.id, linkedAt: devices.linkedAt, lastUsedAt: devices.lastUsedAt })
      .from(devices)
      .where(eq(devices.studentId, student.id));
    return c.json(rows);
  });

  app.delete('/:id/devices/:deviceId', async (c) => {
    const student = await requireFamilyStudent(db, c.var.parent.familyId, c.req.param('id'));
    const deviceId = c.req.param('deviceId');
    if (!uuidSchema.safeParse(deviceId).success) throw notFound('Device not found');
    const deleted = await db
      .delete(devices)
      .where(and(eq(devices.id, deviceId), eq(devices.studentId, student.id)))
      .returning({ id: devices.id });
    if (deleted.length === 0) throw notFound('Device not found');
    return c.body(null, 204);
  });

  return app;
}

/** Anonymous routes under /v1/device: redeem a link token, register a passkey, unlock. */
export function deviceRoutes({ db, clock, passkeys }: DeviceDeps) {
  const app = new Hono<AppEnv>();
  const now = () => clock.now();

  async function createChallenge(
    kind: 'register' | 'unlock',
    challenge: string,
    studentId?: string,
  ) {
    const [row] = await db
      .insert(passkeyChallenges)
      .values({
        kind,
        challenge,
        studentId: studentId ?? null,
        expiresAt: new Date(now().getTime() + CHALLENGE_TTL_MS),
      })
      .returning({ id: passkeyChallenges.id });
    return row!.id;
  }

  /** Marks a challenge used, once, if it is still valid. */
  async function consumeChallenge(id: string, kind: 'register' | 'unlock') {
    if (!uuidSchema.safeParse(id).success) throw invalidChallenge();
    const [row] = await db
      .update(passkeyChallenges)
      .set({ usedAt: now() })
      .where(
        and(
          eq(passkeyChallenges.id, id),
          eq(passkeyChallenges.kind, kind),
          isNull(passkeyChallenges.usedAt),
          gt(passkeyChallenges.expiresAt, now()),
        ),
      )
      .returning({
        challenge: passkeyChallenges.challenge,
        studentId: passkeyChallenges.studentId,
      });
    if (!row) throw invalidChallenge();
    return row;
  }

  async function startSession(
    c: Parameters<MiddlewareHandler<AppEnv>>[0],
    studentId: string,
    deviceId: string,
  ) {
    const token = randomToken();
    const expiresAt = new Date(now().getTime() + STUDENT_SESSION_TTL_MS);
    await db
      .insert(studentSessions)
      .values({ tokenHash: await hashToken(token), studentId, deviceId, expiresAt });
    setCookie(c, STUDENT_COOKIE, token, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      expires: expiresAt,
    });
  }

  app.post('/link', async (c) => {
    const { token, familyId } = await readJson(c, redeemSchema);
    if (!uuidSchema.safeParse(familyId).success) throw invalidLinkToken();
    // Single use: the update succeeds only once, only before expiry, only for this family.
    const [used] = await db
      .update(deviceLinkTokens)
      .set({ usedAt: now() })
      .where(
        and(
          eq(deviceLinkTokens.tokenHash, await hashToken(token)),
          eq(deviceLinkTokens.familyId, familyId),
          isNull(deviceLinkTokens.usedAt),
          gt(deviceLinkTokens.expiresAt, now()),
        ),
      )
      .returning({ studentId: deviceLinkTokens.studentId });
    if (!used) throw invalidLinkToken();

    const [student] = await db.select().from(students).where(eq(students.id, used.studentId));
    const options = await passkeys.registrationOptions({
      userId: student!.id,
      userName: student!.nickname,
    });
    const challengeId = await createChallenge('register', options.challenge, student!.id);
    return c.json({
      challengeId,
      options,
      student: { nickname: student!.nickname, avatarCode: student!.avatarCode },
    });
  });

  app.post('/link/verify', async (c) => {
    const { challengeId, response } = await readJson(c, verifySchema);
    const challenge = await consumeChallenge(challengeId, 'register');
    const credential = await passkeys.verifyRegistration({
      response: response as never,
      expectedChallenge: challenge.challenge,
    });
    if (!credential) throw passkeyNotVerified();
    const [device] = await db
      .insert(devices)
      .values({
        studentId: challenge.studentId!,
        credentialId: credential.credentialId,
        publicKey: credential.publicKey,
        counter: credential.counter,
        transports: credential.transports ?? null,
        linkedAt: now(),
      })
      .returning({ id: devices.id });
    await startSession(c, challenge.studentId!, device!.id);
    const [student] = await db.select().from(students).where(eq(students.id, challenge.studentId!));
    return c.json({ deviceId: device!.id, student: toStudent(student!) }, 201);
  });

  app.post('/unlock/options', async (c) => {
    const { credentialIds } = await readJson(c, unlockOptionsSchema);
    const options = await passkeys.authenticationOptions({ credentialIds });
    const challengeId = await createChallenge('unlock', options.challenge);
    return c.json({ challengeId, options });
  });

  app.post('/unlock/verify', async (c) => {
    const { challengeId, response } = await readJson(c, verifySchema);
    const challenge = await consumeChallenge(challengeId, 'unlock');
    const [device] = await db.select().from(devices).where(eq(devices.credentialId, response.id));
    if (!device) throw passkeyNotVerified();
    const result = await passkeys.verifyAuthentication({
      response: response as never,
      expectedChallenge: challenge.challenge,
      credential: device,
    });
    if (!result) throw passkeyNotVerified();
    await db
      .update(devices)
      .set({ counter: result.newCounter, lastUsedAt: now() })
      .where(eq(devices.id, device.id));
    await startSession(c, device.studentId, device.id);
    const [student] = await db.select().from(students).where(eq(students.id, device.studentId));
    return c.json({ student: toStudent(student!) });
  });

  return app;
}

/** Routes for a signed-in student device under /v1/student. */
export function studentSessionRoutes({ db, clock }: DeviceDeps) {
  const app = new Hono<AppEnv>();

  app.use('*', async (c, next) => {
    const token = getCookie(c, STUDENT_COOKIE);
    if (!token) throw unauthorized();
    const [session] = await db
      .select({
        studentId: studentSessions.studentId,
        deviceId: studentSessions.deviceId,
        familyId: students.familyId,
      })
      .from(studentSessions)
      .innerJoin(students, eq(students.id, studentSessions.studentId))
      .where(
        and(
          eq(studentSessions.tokenHash, await hashToken(token)),
          gt(studentSessions.expiresAt, clock.now()),
        ),
      );
    if (!session) throw unauthorized();
    c.set('student', session);
    await next();
  });

  app.get('/me', async (c) => {
    const [student] = await db
      .select()
      .from(students)
      .where(eq(students.id, c.var.student.studentId));
    return c.json(toStudent(student!));
  });

  app.post('/lock', async (c) => {
    const token = getCookie(c, STUDENT_COOKIE)!;
    await db.delete(studentSessions).where(eq(studentSessions.tokenHash, await hashToken(token)));
    deleteCookie(c, STUDENT_COOKIE, { path: '/', secure: true });
    return c.body(null, 204);
  });

  return app;
}
