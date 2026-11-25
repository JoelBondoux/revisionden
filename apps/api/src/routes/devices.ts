import { Hono, type MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { and, asc, eq, gt, gte, isNull } from 'drizzle-orm';
import { z } from 'zod';
import {
  CreateLinkTokenRequestSchema,
  DeviceTypeSchema,
  formatLinkCode,
  linkCodeFromBytes,
  LINK_CODE_LENGTH,
  normaliseLinkCode,
  type LinkKind,
  type LinkStatus,
} from '@revisionden/core';
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
import { recordFamilyEvent } from '../family-events';
import { toStudent } from './students';
import { readJson } from '../http';
import type { PasskeyService } from '../passkeys';
import { clientKey, RETRY_AFTER_SECONDS, type Clock, type RateLimiter } from '../rate-limit';
import { hashToken, randomToken } from '../tokens';
import { isId } from '../validation';

export const LINK_TOKEN_TTL_MS = 10 * 60 * 1000;
/** A shared link waits in a message, so it lasts a day (the QR code stays 10 minutes). */
export const SHARE_LINK_TTL_MS = 24 * 60 * 60 * 1000;
const TTL: Record<LinkKind, number> = { qr: LINK_TOKEN_TTL_MS, share: SHARE_LINK_TTL_MS };
export const CHALLENGE_TTL_MS = 5 * 60 * 1000;
export const STUDENT_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const STUDENT_COOKIE = '__Host-rd_student';

export interface DeviceDeps {
  db: Database;
  config: AppConfig;
  clock: Clock;
  passkeys: PasskeyService;
  /** Limits short-code attempts at /link per address (falls back to the sign-in limiter). */
  rateLimiters?: { auth: RateLimiter; linkCode?: RateLimiter };
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
const redeemSchema = z.union([
  z.object({ token: z.string().min(16).max(128), familyId: z.string() }).strict(),
  z.object({ code: z.string().min(1).max(32) }).strict(),
]);
const credentialResponse = z
  .object({ id: z.string().min(1), response: z.object({}).passthrough() })
  .passthrough();
const verifySchema = z.object({ challengeId: z.string(), response: credentialResponse }).strict();
const linkVerifySchema = verifySchema.extend({ deviceType: DeviceTypeSchema.optional() }).strict();

function newLinkCode(): string {
  return linkCodeFromBytes(crypto.getRandomValues(new Uint8Array(LINK_CODE_LENGTH)));
}

/** Reads an optional JSON body: a bare POST (no body) means the defaults. */
async function optionalJson(c: Parameters<MiddlewareHandler<AppEnv>>[0]): Promise<unknown> {
  const text = await c.req.text();
  if (text.trim() === '') return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, 'invalid_json', 'The request body must be JSON');
  }
}
const unlockOptionsSchema = z
  .object({ credentialIds: z.array(z.string()).max(10).optional() })
  .strict();

/** Parent routes under /v1/students: create link tokens, list and unlink devices. */
export function parentDeviceRoutes({ db, config, clock }: DeviceDeps) {
  const app = new Hono<AppEnv>();

  app.post('/:id/link-tokens', async (c) => {
    const { familyId } = c.var.parent;
    const student = await requireFamilyStudent(db, familyId, c.req.param('id'));
    const { kind } = CreateLinkTokenRequestSchema.parse(await optionalJson(c));
    const token = randomToken();
    const code = newLinkCode();
    const expiresAt = new Date(clock.now().getTime() + TTL[kind]);
    const [row] = await db
      .insert(deviceLinkTokens)
      .values({
        tokenHash: await hashToken(token),
        codeHash: await hashToken(code),
        kind,
        familyId,
        studentId: student.id,
        expiresAt,
      })
      .returning({ id: deviceLinkTokens.id });
    // No nickname or other personal data in the link: only the token and the family id.
    const linkUrl = new URL('/link', config.webOrigin);
    linkUrl.searchParams.set('token', token);
    linkUrl.searchParams.set('family', familyId);
    return c.json(
      {
        tokenId: row!.id,
        kind,
        token,
        familyId,
        studentId: student.id,
        expiresAt: expiresAt.toISOString(),
        linkUrl: linkUrl.toString(),
        code: formatLinkCode(code),
      },
      201,
    );
  });

  async function ownToken(familyId: string, studentId: string, tokenId: string) {
    const student = await requireFamilyStudent(db, familyId, studentId);
    if (!isId(tokenId)) throw notFound('Link not found');
    const [row] = await db
      .select()
      .from(deviceLinkTokens)
      .where(and(eq(deviceLinkTokens.id, tokenId), eq(deviceLinkTokens.studentId, student.id)));
    if (!row) throw notFound('Link not found');
    return row;
  }

  /** Waiting until the child's device has used the link and set up its passkey. */
  app.get('/:id/link-tokens/:tokenId', async (c) => {
    const row = await ownToken(c.var.parent.familyId, c.req.param('id'), c.req.param('tokenId'));
    let status: LinkStatus = 'waiting';
    if (row.cancelledAt) status = 'cancelled';
    else if (row.usedAt) {
      const [device] = await db
        .select({ id: devices.id })
        .from(devices)
        .where(and(eq(devices.studentId, row.studentId), gte(devices.linkedAt, row.usedAt)))
        .limit(1);
      status = device ? 'linked' : 'waiting';
    } else if (row.expiresAt <= clock.now()) status = 'expired';
    return c.json({ status });
  });

  app.delete('/:id/link-tokens/:tokenId', async (c) => {
    const row = await ownToken(c.var.parent.familyId, c.req.param('id'), c.req.param('tokenId'));
    await db
      .update(deviceLinkTokens)
      .set({ cancelledAt: clock.now() })
      .where(eq(deviceLinkTokens.id, row.id));
    return c.body(null, 204);
  });

  app.get('/:id/devices', async (c) => {
    const student = await requireFamilyStudent(db, c.var.parent.familyId, c.req.param('id'));
    const rows = await db
      .select({
        id: devices.id,
        deviceType: devices.deviceType,
        linkedAt: devices.linkedAt,
        lastUsedAt: devices.lastUsedAt,
      })
      .from(devices)
      .where(eq(devices.studentId, student.id))
      .orderBy(asc(devices.linkedAt));
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
export function deviceRoutes({ db, clock, passkeys, rateLimiters }: DeviceDeps) {
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

  /** Short-code attempts have their own budget per address, so codes cannot be guessed. */
  async function limitCodeAttempts(c: Parameters<MiddlewareHandler<AppEnv>>[0]) {
    const limiter = rateLimiters?.linkCode ?? rateLimiters?.auth;
    if (!limiter) return;
    const { success } = await limiter.limit({ key: `link-code:${clientKey(c.req.raw.headers)}` });
    if (!success) {
      c.header('Retry-After', String(RETRY_AFTER_SECONDS));
      throw new ApiError(429, 'rate_limited', 'Too many tries. Please wait a minute.');
    }
  }

  app.post('/link', async (c) => {
    const body = await readJson(c, redeemSchema);
    let match;
    if ('code' in body) {
      await limitCodeAttempts(c);
      const code = normaliseLinkCode(body.code);
      if (!code) throw invalidLinkToken();
      match = eq(deviceLinkTokens.codeHash, await hashToken(code));
    } else {
      if (!isId(body.familyId)) throw invalidLinkToken();
      match = and(
        eq(deviceLinkTokens.tokenHash, await hashToken(body.token)),
        eq(deviceLinkTokens.familyId, body.familyId),
      );
    }
    // Single use: the update succeeds only once, only before expiry, never once cancelled.
    const [used] = await db
      .update(deviceLinkTokens)
      .set({ usedAt: now() })
      .where(
        and(
          match,
          isNull(deviceLinkTokens.usedAt),
          isNull(deviceLinkTokens.cancelledAt),
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
    const { challengeId, response, deviceType } = await readJson(c, linkVerifySchema);
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
        deviceType: deviceType ?? null,
        linkedAt: now(),
      })
      .returning({ id: devices.id });
    await startSession(c, challenge.studentId!, device!.id);
    const [student] = await db.select().from(students).where(eq(students.id, challenge.studentId!));
    // Both parents hear "<nickname>'s device is set up" (pushed if they turned push on).
    await recordFamilyEvent(db, {
      familyId: student!.familyId,
      actorPosition: null,
      kind: 'device_linked',
      studentId: student!.id,
      now: now(),
    });
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
