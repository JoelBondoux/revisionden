import { Hono, type MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { and, asc, desc, eq, gt, gte, inArray, isNull, lt } from 'drizzle-orm';
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
  deviceMarkers,
  devices,
  passkeyChallenges,
  passkeyNewDeviceClaims,
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
/** A synced passkey makes at most one new device a day (cleared browser storage, I5b). */
export const NEW_DEVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

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
const linkCancelled = () =>
  new ApiError(400, 'link_cancelled', 'This link was cancelled. Ask a parent for a new one.');
const linkAlreadyUsed = () =>
  new ApiError(
    400,
    'link_already_used',
    'This link has already set up a device. Ask a parent for a new one.',
  );
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
    else if (row.linkedAt) status = 'linked';
    else if (!row.usedAt && row.expiresAt <= clock.now()) status = 'expired';
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
    linkTokenId?: string,
  ) {
    const [row] = await db
      .insert(passkeyChallenges)
      .values({
        kind,
        challenge,
        studentId: studentId ?? null,
        linkTokenId: linkTokenId ?? null,
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
        linkTokenId: passkeyChallenges.linkTokenId,
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
   * The device added under today's new-device claim for this passkey (B7). The browser that won
   * the claim may still be adding it, so look again briefly before giving up.
   */
  async function todaysNewDevice(credentialId: string) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const [claim] = await db
        .select({ claimedAt: passkeyNewDeviceClaims.claimedAt })
        .from(passkeyNewDeviceClaims)
        .where(eq(passkeyNewDeviceClaims.credentialId, credentialId));
      if (claim) {
        const [device] = await db
          .select()
          .from(devices)
          .where(
            and(eq(devices.credentialId, credentialId), gte(devices.linkedAt, claim.claimedAt)),
          )
          .orderBy(desc(devices.linkedAt))
          .limit(1);
        if (device) return device;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return undefined;
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
    // One new device a day per passkey (B7). A single conditional upsert claims the day, so two
    // new browsers unlocking at the same moment cannot both add a device and alert the parents.
    const at = now();
    const since = new Date(at.getTime() - NEW_DEVICE_WINDOW_MS);
    const source = rows[0]!;
    const won = await db
      .insert(passkeyNewDeviceClaims)
      .values({ credentialId: source.credentialId, studentId, claimedAt: at })
      .onConflictDoUpdate({
        target: passkeyNewDeviceClaims.credentialId,
        set: { claimedAt: at },
        setWhere: lt(passkeyNewDeviceClaims.claimedAt, since),
      })
      .returning({ credentialId: passkeyNewDeviceClaims.credentialId });
    if (won.length === 0) {
      // Browser storage cleared again today, or another browser won a moment ago: reuse today's
      // new device rather than add another.
      const device = (await todaysNewDevice(source.credentialId)) ?? source;
      return { device, marker: await issueMarker(device.id, studentId) };
    }
    const [device] = await db
      .insert(devices)
      .values({
        studentId,
        credentialId: source.credentialId,
        publicKey: source.publicKey,
        counter: source.counter,
        transports: source.transports,
        linkedAt: at,
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

  /** Refuses a link that is gone, cancelled or already used, each with its own reason code. */
  async function requireLiveLink(linkTokenId: string) {
    const [token] = await db
      .select({ usedAt: deviceLinkTokens.usedAt, cancelledAt: deviceLinkTokens.cancelledAt })
      .from(deviceLinkTokens)
      .where(eq(deviceLinkTokens.id, linkTokenId));
    if (!token) throw invalidLinkToken();
    if (token.cancelledAt) throw linkCancelled();
    if (token.usedAt) throw linkAlreadyUsed();
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
    // Opening the link does not use it up (E8): a reload or a second try gets a fresh passkey
    // challenge while the link is unused, not cancelled and not expired. Finishing the passkey
    // at /link/verify is what uses it, once.
    const [used] = await db
      .select({ id: deviceLinkTokens.id, studentId: deviceLinkTokens.studentId })
      .from(deviceLinkTokens)
      .where(
        and(
          match,
          isNull(deviceLinkTokens.usedAt),
          isNull(deviceLinkTokens.cancelledAt),
          gt(deviceLinkTokens.expiresAt, now()),
        ),
      );
    if (!used) throw invalidLinkToken();

    const [student] = await db.select().from(students).where(eq(students.id, used.studentId));
    const options = await passkeys.registrationOptions({
      userId: student!.id,
      userName: student!.nickname,
    });
    const challengeId = await createChallenge('register', options.challenge, student!.id, used.id);
    return c.json({
      challengeId,
      options,
      student: { nickname: student!.nickname, avatarCode: student!.avatarCode },
    });
  });

  app.post('/link/verify', async (c) => {
    const { challengeId, response, deviceType } = await readJson(c, linkVerifySchema);
    const challenge = await consumeChallenge(challengeId, 'register');
    // A link the parent cancelled, or that another device has already used, stops working even
    // if this set-up had already started. Each refusal has its own code in the error log.
    if (challenge.linkTokenId) await requireLiveLink(challenge.linkTokenId);
    const credential = await passkeys.verifyRegistration({
      response: response as never,
      expectedChallenge: challenge.challenge,
    });
    // A failed check leaves the link unused, so the child can open it and try again.
    if (!credential) throw passkeyNotVerified();
    if (challenge.linkTokenId) {
      // Single use, atomically: only one verify can mark the link used.
      const [claimed] = await db
        .update(deviceLinkTokens)
        .set({ usedAt: now() })
        .where(
          and(
            eq(deviceLinkTokens.id, challenge.linkTokenId),
            isNull(deviceLinkTokens.usedAt),
            isNull(deviceLinkTokens.cancelledAt),
          ),
        )
        .returning({ id: deviceLinkTokens.id });
      if (!claimed) await requireLiveLink(challenge.linkTokenId);
    }
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
    if (challenge.linkTokenId) {
      await db
        .update(deviceLinkTokens)
        .set({ linkedAt: now() })
        .where(eq(deviceLinkTokens.id, challenge.linkTokenId));
    }
    const deviceMarker = await issueMarker(device!.id, challenge.studentId!);
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
    // The counter belongs to the passkey, not the device: keep it the same on every row, so a
    // cloned passkey with an older counter is still refused whichever device unlocked last.
    await db
      .update(devices)
      .set({ counter: result.newCounter })
      .where(eq(devices.credentialId, device.credentialId));
    await db.update(devices).set({ lastUsedAt: now() }).where(eq(devices.id, device.id));
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
