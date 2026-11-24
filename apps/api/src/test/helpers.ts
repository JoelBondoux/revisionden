import { createTestDb } from '@revisionden/db/testing';
import { authSessions, authUsers } from '@revisionden/db';
import type { Database } from '@revisionden/db';
import { makeSignature } from 'better-auth/crypto';
import { DEFAULT_AVATAR, encodeAvatar } from '@revisionden/core';
import { createApp } from '../app';
import { createAuth } from '../auth';
import type { AppConfig } from '../env';
import { createMemoryRateLimiter } from '../rate-limit';
import { createPasskeyService } from '../passkeys';
import type { VerificationDeps } from '../routes/review';

export const TEST_CONFIG: AppConfig = {
  environment: 'development',
  databaseUrl: 'pglite://memory',
  authSecret: 'test-secret-that-is-at-least-32-characters-long',
  apiOrigin: 'https://api-dev.revisionden.test',
  webOrigin: 'https://dev.revisionden.test',
  google: { clientId: 'test-google-id', clientSecret: 'test-google-secret' },
  microsoft: { clientId: 'test-ms-id', clientSecret: 'test-ms-secret' },
  aiGatewayUrl: 'https://gateway.example.com/v1/test',
  passkeyRpId: 'dev.revisionden.test',
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
  verification?: VerificationDeps;
}

export async function createTestContext(options: TestContextOptions = {}) {
  const { db: pglite, client } = await createTestDb();
  const db = pglite as unknown as Database;
  const clock = createTestClock();
  const auth = createAuth({ db, config: TEST_CONFIG });
  const app = createApp({
    version: '00.01.000',
    config: TEST_CONFIG,
    db,
    auth,
    clock,
    passkeys: createPasskeyService(TEST_CONFIG),
    rateLimiters: {
      auth: createMemoryRateLimiter({ limit: options.authLimit ?? 1000, periodMs: 60_000, clock }),
      ai: createMemoryRateLimiter({ limit: options.aiLimit ?? 1000, periodMs: 60_000, clock }),
    },
    verification: options.verification,
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

  return { app, db, client, clock, auth, signInParent, close: () => client.close() };
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
