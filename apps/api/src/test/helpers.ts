import { createTestDb } from '@revisionden/db/testing';
import { authSessions, authUsers, devices, studentSessions } from '@revisionden/db';
import type { Database } from '@revisionden/db';
import { makeSignature } from 'better-auth/crypto';
import { DEFAULT_AVATAR, encodeAvatar } from '@revisionden/core';
import { createApp } from '../app';
import type { ErrorLog } from '../errors';
import { createAuth } from '../auth';
import type { AppConfig } from '../env';
import { createMemoryRateLimiter } from '../rate-limit';
import { createPasskeyService } from '../passkeys';
import type { VerificationDeps } from '../routes/review';
import type { AiProvider, ProviderName } from '../ai/types';
import type { MathsEngine } from '../learning/maths-engine';
import { STUDENT_COOKIE } from '../routes/devices';
import { hashToken, randomToken } from '../tokens';

export const TEST_CONFIG: AppConfig = {
  environment: 'development',
  databaseUrl: 'pglite://memory',
  authSecret: 'test-secret-that-is-at-least-32-characters-long',
  apiOrigin: 'https://api-dev.revisionden.test',
  webOrigin: 'https://dev.revisionden.test',
  google: { clientId: 'test-google-id', clientSecret: 'test-google-secret' },
  microsoft: { clientId: 'test-ms-id', clientSecret: 'test-ms-secret' },
  signInProviders: ['google', 'microsoft'],
  aiGatewayUrl: 'https://gateway.example.com/v1/test',
  passkeyRpId: 'dev.revisionden.test',
  serveDraftContent: false,
  push: null,
  operatorEmails: [],
  ai: {
    anthropicApiKey: undefined,
    openaiApiKey: undefined,
    gatewayToken: undefined,
    monthlyCapMicroUsd: 2_500_000,
    checker: undefined,
  },
};

/** A valid avatar code (core format). */
export const AVATAR = encodeAvatar(DEFAULT_AVATAR);
export const AVATAR_2 = encodeAvatar({ ...DEFAULT_AVATAR, skin: 2, eyes: 1 });

export interface TestClock {
  now(): Date;
  advance(ms: number): void;
}

export function createTestClock(start = new Date('2026-11-24T10:00:00Z')): TestClock {
  let t = start.getTime();
  return { now: () => new Date(t), advance: (ms) => void (t += ms) };
}

export interface TestContextOptions {
  authLimit?: number;
  aiLimit?: number;
  /** Operator bridge (AppDeck) requests a minute. */
  operatorLimit?: number;
  /** Short-code attempts at /link a minute (defaults to the sign-in limit). */
  linkCodeLimit?: number;
  verification?: VerificationDeps;
  config?: Partial<AppConfig>;
  aiProviders?: Partial<Record<ProviderName, AiProvider>>;
  serveDraftContent?: boolean;
  mathsEngine?: MathsEngine;
  /** Collects error reference log lines; by default they are dropped to keep test output quiet. */
  errorLog?: ErrorLog;
}

export async function createTestContext(options: TestContextOptions = {}) {
  const { db: pglite, client } = await createTestDb();
  const db = pglite as unknown as Database;
  const clock = createTestClock();
  const config: AppConfig = {
    ...TEST_CONFIG,
    serveDraftContent: options.serveDraftContent ?? false,
    ...options.config,
  };
  const auth = createAuth({ db, config });
  const app = createApp({
    version: '00.01.000',
    config,
    db,
    auth,
    clock,
    passkeys: createPasskeyService(TEST_CONFIG),
    aiProviders: options.aiProviders ?? {},
    sleep: async () => undefined,
    rateLimiters: {
      auth: createMemoryRateLimiter({ limit: options.authLimit ?? 1000, periodMs: 60_000, clock }),
      ai: createMemoryRateLimiter({ limit: options.aiLimit ?? 1000, periodMs: 60_000, clock }),
      operator: createMemoryRateLimiter({
        limit: options.operatorLimit ?? 1000,
        periodMs: 60_000,
        clock,
      }),
      ...(options.linkCodeLimit === undefined
        ? {}
        : {
            linkCode: createMemoryRateLimiter({
              limit: options.linkCodeLimit,
              periodMs: 60_000,
              clock,
            }),
          }),
    },
    verification: options.verification,
    errorLog: options.errorLog ?? (() => {}),
    ...(options.mathsEngine ? { mathsEngine: options.mathsEngine } : {}),
  });

  let parentCount = 0;

  /** Creates a parent user with a live Better Auth session and returns request headers. */
  async function signInParent(): Promise<{ userId: string; headers: Record<string, string> }> {
    parentCount += 1;
    const userId = `test-parent-${parentCount}`;
    const token = `test-session-token-${parentCount}-${crypto.randomUUID()}`;
    await db.insert(authUsers).values({ id: userId, email: `parent${parentCount}@example.com` });
    await db.insert(authSessions).values({
      id: `test-session-${parentCount}`,
      token,
      userId,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    const ctx = await auth.$context;
    const signed = `${token}.${await makeSignature(token, ctx.secret)}`;
    return {
      userId,
      headers: { cookie: `${ctx.authCookies.sessionToken.name}=${encodeURIComponent(signed)}` },
    };
  }

  /** Gives a student a linked device and an unlocked session; returns the cookie header. */
  async function signInStudent(studentId: string): Promise<Record<string, string>> {
    const [device] = await db
      .insert(devices)
      .values({ studentId, credentialId: `test-credential-${randomToken()}`, publicKey: 'test' })
      .returning({ id: devices.id });
    const token = randomToken();
    await db.insert(studentSessions).values({
      tokenHash: await hashToken(token),
      studentId,
      deviceId: device!.id,
      expiresAt: new Date(clock.now().getTime() + 12 * 60 * 60 * 1000),
    });
    return { cookie: `${STUDENT_COOKIE}=${token}` };
  }

  /** A parent with one student signed in on a device, enrolled in the given subjects. */
  async function familyStudent(nickname = 'test_kid', subjectIds: string[] = []) {
    const parent = await signInParent();
    const res = await app.request(
      '/v1/students',
      jsonRequest('POST', { nickname, avatarCode: AVATAR, yearGroup: 11 }, parent.headers),
    );
    const { id } = (await res.json()) as { id: string };
    for (const subjectId of subjectIds) {
      await app.request(
        `/v1/students/${id}/enrolments`,
        jsonRequest('POST', { subjectId, board: 'not_sure', tier: 'none' }, parent.headers),
      );
    }
    return { studentId: id, parent, headers: await signInStudent(id) };
  }

  return {
    app,
    db,
    client,
    clock,
    config,
    auth,
    signInParent,
    signInStudent,
    familyStudent,
    close: () => client.close(),
  };
}

export type TestContext = Awaited<ReturnType<typeof createTestContext>>;

export function jsonRequest(
  method: string,
  body: unknown,
  headers: Record<string, string> = {},
): RequestInit {
  return {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  };
}
