import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LinkTokenSchema } from '@revisionden/core';
import { devices } from '@revisionden/db';
import { eq } from 'drizzle-orm';
import type { ErrorLogLine } from './errors';
import {
  AVATAR,
  createTestContext,
  jsonRequest,
  TEST_CONFIG,
  type TestContext,
} from './test/helpers';
import { createSoftAuthenticator } from './test/soft-authenticator';

/**
 * E8: opening a link (redeem) no longer uses it up. Each open gets a fresh passkey challenge
 * while the link is unused, not cancelled and not expired; finishing the passkey (verify) is what
 * uses the link, once. Every refused verify is logged with its own reason code.
 */
let t: TestContext;
const log: ErrorLogLine[] = [];

beforeAll(async () => {
  t = await createTestContext({ errorLog: (line) => log.push(line) });
});

afterAll(async () => {
  await t.close();
});

type Headers = Record<string, string>;
const MINUTE = 60 * 1000;
let n = 0;

async function family() {
  n += 1;
  const parent = await t.signInParent();
  const res = await t.app.request(
    '/v1/students',
    jsonRequest(
      'POST',
      { nickname: `retry_kid_${n}`, avatarCode: AVATAR, yearGroup: 11 },
      parent.headers,
    ),
  );
  const { id } = (await res.json()) as { id: string };
  return { headers: parent.headers, studentId: id };
}

async function makeLink(headers: Headers, studentId: string) {
  const res = await t.app.request(`/v1/students/${studentId}/link-tokens`, {
    method: 'POST',
    headers,
  });
  return LinkTokenSchema.parse(await res.json());
}

const redeem = (code: string) => t.app.request('/v1/device/link', jsonRequest('POST', { code }));

async function start(code: string) {
  const res = await redeem(code);
  expect(res.status).toBe(200);
  return (await res.json()) as { challengeId: string; options: { challenge: string } };
}

const softDevice = () =>
  createSoftAuthenticator({ origin: TEST_CONFIG.webOrigin, rpId: TEST_CONFIG.passkeyRpId });

const verify = (
  started: { challengeId: string; options: { challenge: string } },
  origin = TEST_CONFIG.webOrigin,
) =>
  t.app.request(
    '/v1/device/link/verify',
    jsonRequest('POST', {
      challengeId: started.challengeId,
      response: softDevice().register(started.options, { origin }),
    }),
  );

const lastLogged = () => log.at(-1)!;

async function deviceCount(studentId: string) {
  return (await t.db.select().from(devices).where(eq(devices.studentId, studentId))).length;
}

describe('opening a link again before the passkey is set up', () => {
  it('gives a fresh passkey challenge each time, until the device finishes', async () => {
    const { headers, studentId } = await family();
    const link = await makeLink(headers, studentId);
    const first = await start(link.code);
    const second = await start(link.code);
    expect(second.challengeId).not.toBe(first.challengeId);
    expect((await verify(second)).status).toBe(201);
    const after = await redeem(link.code);
    expect(after.status).toBe(400);
    expect(await after.json()).toMatchObject({ error: { code: 'invalid_link_token' } });
  });

  it('lets only one device finish from one link', async () => {
    const { headers, studentId } = await family();
    const link = await makeLink(headers, studentId);
    const a = await start(link.code);
    const b = await start(link.code);
    expect((await verify(a)).status).toBe(201);
    const second = await verify(b);
    expect(second.status).toBe(400);
    expect(await second.json()).toMatchObject({ error: { code: 'link_already_used' } });
    expect(lastLogged()).toMatchObject({ code: 'link_already_used', status: 400 });
    expect(await deviceCount(studentId)).toBe(1);
  });

  it('keeps the link usable when the passkey check fails, so the child can try again', async () => {
    const { headers, studentId } = await family();
    const link = await makeLink(headers, studentId);
    const bad = await verify(await start(link.code), 'https://phish.test');
    expect(bad.status).toBe(400);
    expect(lastLogged()).toMatchObject({ code: 'passkey_not_verified' });
    expect((await verify(await start(link.code))).status).toBe(201);
  });

  it('gives a fresh challenge after the old one expires, while the link is still valid', async () => {
    const { headers, studentId } = await family();
    const link = await makeLink(headers, studentId);
    const old = await start(link.code);
    t.clock.advance(6 * MINUTE);
    const stale = await verify(old);
    expect(stale.status).toBe(400);
    expect(await stale.json()).toMatchObject({ error: { code: 'invalid_challenge' } });
    expect(lastLogged()).toMatchObject({ code: 'invalid_challenge' });
    expect((await verify(await start(link.code))).status).toBe(201);
  });

  it('logs a cancelled link with its own reason code', async () => {
    const { headers, studentId } = await family();
    const link = await makeLink(headers, studentId);
    const started = await start(link.code);
    await t.app.request(`/v1/students/${studentId}/link-tokens/${link.tokenId}`, {
      method: 'DELETE',
      headers,
    });
    const res = await verify(started);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: 'link_cancelled' } });
    expect(lastLogged()).toMatchObject({ code: 'link_cancelled' });
    expect(await deviceCount(studentId)).toBe(0);
  });

  it('shows the link as waiting while it is being opened, and linked once done', async () => {
    const { headers, studentId } = await family();
    const link = await makeLink(headers, studentId);
    const status = async () =>
      (await (
        await t.app.request(`/v1/students/${studentId}/link-tokens/${link.tokenId}`, { headers })
      ).json()) as { status: string };
    const started = await start(link.code);
    expect(await status()).toEqual({ status: 'waiting' });
    await verify(started);
    expect(await status()).toEqual({ status: 'linked' });
  });
});
