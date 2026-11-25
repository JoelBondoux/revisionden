import { Hono, type MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { and, desc, eq, gt, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import {
  deviceLinkTokens,
  deviceMarkers,
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
import { toStudent } from './students';
import { readJson } from '../http';
import type { PasskeyService } from '../passkeys';
import type { Clock } from '../rate-limit';
import { hashToken, randomToken } from '../tokens';
import { isId } from '../validation';
import { recordFamilyEvent } from '../family-events';

export const LINK_TOKEN_TTL_MS = 10 * 60 * 1000;
export const CHALLENGE_TTL_MS = 5 * 60 * 1000;
export const STUDENT_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const STUDENT_COOKIE = '__Host-rd_student';
/** A synced passkey makes at most one new device a day (cleared browser storage, I5b). */
export const NEW_DEVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

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

// TODO(workstream C): move these device-linking request schemas into packages/core.
const redeemSchema = z
  .object({ token: z.string().min(16).max(128), familyId: z.string() })
  .strict();
const credentialResponse = z
  .object({ id: z.string().min(1), response: z.object({}).passthrough() })
  .passthrough();
const verifySchema = z.object({ challengeId: z.string(), response: credentialResponse }).strict();
const unlockVerifySchema = z
  .object({
    challengeId: z.string(),
    response: credentialResponse,
    /** The marker this browser keeps for its device (I5b); missing on a new device. */
    deviceMarker: z.string().min(16).max(128).optional(),
  })
  .strict();
const unlockOptionsSchema = z
  .object({ credentialIds: z.array(z.string()).max(10).optional() })
  .strict();

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
    return c.json({ devices: rows });
  });

  app.delete('/:id/devices/:deviceId', async (c) => {
    const student = await requireFamilyStudent(db, c.var.parent.familyId, c.req.param('id'));
    const deviceId = c.req.param('deviceId');
    if (!isId(deviceId)) throw notFound('Device not found');
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
    if (!isId(id)) throw invalidChallenge();
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

  /** Gives a device a new marker for its browser to keep; only the hash is stored. */
  async function issueMarker(deviceId: string, studentId: string): Promise<string> {
    const marker = randomToken();
    await db
      .insert(deviceMarkers)
      .values({ markerHash: await hashToken(marker), deviceId, studentId, createdAt: now() });
    return marker;
  }

  /**
   * Which device a verified passkey is being used on (I5b, synced passkeys: allow, and tell the
   * parents). `rows` are the student's devices with this passkey. Returns the device and, when
   * this browser needs one, a new marker; throws if a parent unlinked this browser's device.
   */
  async function deviceForUnlock(
    rows: (typeof devices.$inferSelect)[],
    markerToken: string | undefined,
  ): Promise<{ device: typeof devices.$inferSelect; marker?: string }> {
    const studentId = rows[0]!.studentId;
    const ids = rows.map((r) => r.id);
    if (markerToken) {
      const [known] = await db
        .select()
        .from(deviceMarkers)
        .where(
          and(
            eq(deviceMarkers.markerHash, await hashToken(markerToken)),
            eq(deviceMarkers.studentId, studentId),
          ),
        );
      // A parent unlinked this browser's device: it needs linking again.
      if (known && known.deviceId === null) throw passkeyNotVerified();
      const device = rows.find((r) => r.id === known?.deviceId);
      if (device) return { device };
    }
    const markers = await db
      .select({ deviceId: deviceMarkers.deviceId })
      .from(deviceMarkers)
      .where(inArray(deviceMarkers.deviceId, ids));
    // Linked before markers existed: this is that device; no news for the parents.
    if (markers.length === 0 && rows.length === 1) {
      return { device: rows[0]!, marker: await issueMarker(rows[0]!.id, studentId) };
    }
    // Browser storage cleared again today: reuse today's new device rather than add another.
    const since = new Date(now().getTime() - NEW_DEVICE_WINDOW_MS);
    const [recent] = rows
      .filter((r) => r.linkedAt > since)
      .sort((a, b) => b.linkedAt.getTime() - a.linkedAt.getTime());
    if (recent && rows.length > 1) {
      return { device: recent, marker: await issueMarker(recent.id, studentId) };
    }
    const source = rows[0]!;
    const [device] = await db
      .insert(devices)
      .values({
        studentId,
        credentialId: source.credentialId,
        publicKey: source.publicKey,
        counter: source.counter,
        transports: source.transports,
        linkedAt: now(),
      })
      .returning();
    const [student] = await db
      .select({ familyId: students.familyId })
      .from(students)
      .where(eq(students.id, studentId));
    await recordFamilyEvent(db, {
      familyId: student!.familyId,
      actorPosition: null,
      kind: 'passkey_new_device',
      studentId,
      now: now(),
    });
    return { device: device!, marker: await issueMarker(device!.id, studentId) };
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
    if (!isId(familyId)) throw invalidLinkToken();
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
    const deviceMarker = await issueMarker(device!.id, challenge.studentId!);
    await startSession(c, challenge.studentId!, device!.id);
    const [student] = await db.select().from(students).where(eq(students.id, challenge.studentId!));
    return c.json({ deviceId: device!.id, deviceMarker, student: toStudent(student!) }, 201);
  });

  app.post('/unlock/options', async (c) => {
    const { credentialIds } = await readJson(c, unlockOptionsSchema);
    const options = await passkeys.authenticationOptions({ credentialIds });
    const challengeId = await createChallenge('unlock', options.challenge);
    return c.json({ challengeId, options });
  });

  app.post('/unlock/verify', async (c) => {
    const { challengeId, response, deviceMarker } = await readJson(c, unlockVerifySchema);
    const challenge = await consumeChallenge(challengeId, 'unlock');
    // A synced passkey has one row per device; all hold the same public key.
    const rows = await db
      .select()
      .from(devices)
      .where(eq(devices.credentialId, response.id))
      .orderBy(desc(devices.linkedAt));
    if (rows.length === 0) throw passkeyNotVerified();
    const result = await passkeys.verifyAuthentication({
      response: response as never,
      expectedChallenge: challenge.challenge,
      credential: rows[0]!,
    });
    if (!result) throw passkeyNotVerified();
    const { device, marker } = await deviceForUnlock(rows, deviceMarker);
    await db
      .update(devices)
      .set({ counter: result.newCounter, lastUsedAt: now() })
      .where(eq(devices.id, device.id));
    await startSession(c, device.studentId, device.id);
    const [student] = await db.select().from(students).where(eq(students.id, device.studentId));
    return c.json({ student: toStudent(student!), ...(marker ? { deviceMarker: marker } : {}) });
  });

  return app;
}

/**
 * Requires an unlocked student device (the student session cookie) and sets `c.var.student`.
 * Reused by other student routes (reminders, AI marking); skips the lookup if already done.
 */
export function studentAuth({
  db,
  clock,
}: Pick<DeviceDeps, 'db' | 'clock'>): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (c.get('student')) return next();
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
  };
}

/** Routes for a signed-in student device under /v1/student. */
export function studentSessionRoutes({ db, clock }: DeviceDeps) {
  const app = new Hono<AppEnv>();

  app.use('*', studentAuth({ db, clock }));

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
