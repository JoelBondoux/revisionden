import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestContext, jsonRequest, TEST_CONFIG, type TestContext } from './test/helpers';
import { createSoftAuthenticator } from './test/soft-authenticator';

let t: TestContext;

beforeAll(async () => {
  t = await createTestContext();
});

afterAll(async () => {
  await t.close();
});

type Headers = Record<string, string>;
const TEN_MINUTES = 10 * 60 * 1000;

interface LinkToken {
  token: string;
  familyId: string;
  studentId: string;
  expiresAt: string;
  linkUrl: string;
}

async function familyWithStudent(nickname = 'quiz_fox') {
  const parent = await t.signInParent();
  const res = await t.app.request(
    '/v1/students',
    jsonRequest('POST', { nickname, avatarCode: 'fx01', yearGroup: 11 }, parent.headers),
  );
  const student = (await res.json()) as { id: string };
  return { ...parent, studentId: student.id };
}

async function createLinkToken(headers: Headers, studentId: string) {
  return t.app.request(`/v1/students/${studentId}/link-tokens`, { method: 'POST', headers });
}

async function newToken(headers: Headers, studentId: string): Promise<LinkToken> {
  return (await (await createLinkToken(headers, studentId)).json()) as LinkToken;
}

function redeem(token: string, familyId: string) {
  return t.app.request('/v1/device/link', jsonRequest('POST', { token, familyId }));
}

function softDevice() {
  return createSoftAuthenticator({ origin: TEST_CONFIG.webOrigin, rpId: TEST_CONFIG.passkeyRpId });
}

function studentCookie(res: Response): string {
  const set = res.headers.getSetCookie().find((c) => c.startsWith('__Host-rd_student='));
  return set ? set.split(';')[0]! : '';
}

/** Full happy path: token, redeem, register passkey. Returns the device and its cookie. */
async function linkDevice(headers: Headers, studentId: string) {
  const { token, familyId } = await newToken(headers, studentId);
  const redeemed = (await (await redeem(token, familyId)).json()) as {
    challengeId: string;
    options: { challenge: string };
  };
  const device = softDevice();
  const verify = await t.app.request(
    '/v1/device/link/verify',
    jsonRequest('POST', {
      challengeId: redeemed.challengeId,
      response: device.register(redeemed.options),
    }),
  );
  return { device, verify, cookie: studentCookie(verify) };
}

describe('device link tokens', () => {
  it('gives the parent a one-time token valid for 10 minutes, with a link for the QR code', async () => {
    const { headers, studentId } = await familyWithStudent();
    const res = await createLinkToken(headers, studentId);
    expect(res.status).toBe(201);
    const body = (await res.json()) as LinkToken;
    expect(body.token.length).toBeGreaterThanOrEqual(32);
    expect(body.studentId).toBe(studentId);
    expect(new Date(body.expiresAt).getTime() - t.clock.now().getTime()).toBe(TEN_MINUTES);
    const link = new URL(body.linkUrl);
    expect(link.origin).toBe(TEST_CONFIG.webOrigin);
    expect(link.searchParams.get('token')).toBe(body.token);
    expect(link.searchParams.get('family')).toBe(body.familyId);
  });

  it('will not create a token for another family student', async () => {
    const a = await familyWithStudent();
    const b = await t.signInParent();
    expect((await createLinkToken(b.headers, a.studentId)).status).toBe(404);
  });

  it('lets a device redeem the token once and returns passkey registration options', async () => {
    const { headers, studentId } = await familyWithStudent('owl_link');
    const { token, familyId } = await newToken(headers, studentId);
    const res = await redeem(token, familyId);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      challengeId: string;
      options: { rp: { id: string }; user: { name: string } };
      student: { nickname: string };
    };
    expect(body.options.rp.id).toBe(TEST_CONFIG.passkeyRpId);
    expect(body.student.nickname).toBe('owl_link');
  });

  it('expires the token after 10 minutes', async () => {
    const { headers, studentId } = await familyWithStudent();
    const { token, familyId } = await newToken(headers, studentId);
    t.clock.advance(TEN_MINUTES + 1000);
    const res = await redeem(token, familyId);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid_link_token' });
  });

  it('cannot be reused', async () => {
    const { headers, studentId } = await familyWithStudent();
    const { token, familyId } = await newToken(headers, studentId);
    expect((await redeem(token, familyId)).status).toBe(200);
    const again = await redeem(token, familyId);
    expect(again.status).toBe(400);
    expect(await again.json()).toMatchObject({ error: 'invalid_link_token' });
  });

  it('cannot be redeemed for the wrong family, and the attempt does not use it up', async () => {
    const a = await familyWithStudent();
    const b = await familyWithStudent();
    const { token, familyId } = await newToken(a.headers, a.studentId);
    const bFamily = (await newToken(b.headers, b.studentId)).familyId;

    const wrong = await redeem(token, bFamily);
    expect(wrong.status).toBe(400);
    expect(await wrong.json()).toMatchObject({ error: 'invalid_link_token' });
    expect((await redeem(token, familyId)).status).toBe(200);
  });

  it('rejects a made-up token', async () => {
    const { headers, studentId } = await familyWithStudent();
    const { familyId } = await newToken(headers, studentId);
    expect((await redeem('not-a-real-token-at-all-0000000000', familyId)).status).toBe(400);
  });
});

describe('passkey registration and unlock', () => {
  it('registers the passkey, links the device and signs the student in', async () => {
    const { headers, studentId } = await familyWithStudent('linked_1');
    const { verify, cookie } = await linkDevice(headers, studentId);
    expect(verify.status).toBe(201);
    expect(cookie).not.toBe('');
    const set = verify.headers.getSetCookie().find((c) => c.startsWith('__Host-rd_student='))!;
    expect(set).toMatch(/HttpOnly/i);
    expect(set).toMatch(/Secure/i);
    expect(set).toMatch(/SameSite=Lax/i);

    const me = await t.app.request('/v1/student/me', { headers: { cookie } });
    expect(me.status).toBe(200);
    expect(await me.json()).toEqual({
      id: studentId,
      nickname: 'linked_1',
      avatarCode: 'fx01',
      yearGroup: 11,
    });

    const devices = await t.app.request(`/v1/students/${studentId}/devices`, { headers });
    expect(((await devices.json()) as unknown[]).length).toBe(1);
  });

  it('will not accept the same registration challenge twice', async () => {
    const { headers, studentId } = await familyWithStudent();
    const { token, familyId } = await newToken(headers, studentId);
    const redeemed = (await (await redeem(token, familyId)).json()) as {
      challengeId: string;
      options: { challenge: string };
    };
    const send = () =>
      t.app.request(
        '/v1/device/link/verify',
        jsonRequest('POST', {
          challengeId: redeemed.challengeId,
          response: softDevice().register(redeemed.options),
        }),
      );
    expect((await send()).status).toBe(201);
    const again = await send();
    expect(again.status).toBe(400);
    expect(await again.json()).toMatchObject({ error: 'invalid_challenge' });
  });

  it('rejects a passkey registration that fails verification', async () => {
    const { headers, studentId } = await familyWithStudent();
    const { token, familyId } = await newToken(headers, studentId);
    const redeemed = (await (await redeem(token, familyId)).json()) as {
      challengeId: string;
      options: { challenge: string };
    };
    const res = await t.app.request(
      '/v1/device/link/verify',
      jsonRequest('POST', {
        challengeId: redeemed.challengeId,
        response: softDevice().register(redeemed.options, { origin: 'https://phish.test' }),
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'passkey_not_verified' });
  });

  it('unlocks a linked device later with its passkey', async () => {
    const { headers, studentId } = await familyWithStudent('unlock_1');
    const { device } = await linkDevice(headers, studentId);

    const optionsRes = await t.app.request('/v1/device/unlock/options', jsonRequest('POST', {}));
    expect(optionsRes.status).toBe(200);
    const { challengeId, options } = (await optionsRes.json()) as {
      challengeId: string;
      options: { challenge: string };
    };
    const verify = await t.app.request(
      '/v1/device/unlock/verify',
      jsonRequest('POST', { challengeId, response: device.authenticate(options) }),
    );
    expect(verify.status).toBe(200);
    expect(await verify.json()).toMatchObject({ student: { nickname: 'unlock_1' } });
    const cookie = studentCookie(verify);
    expect((await t.app.request('/v1/student/me', { headers: { cookie } })).status).toBe(200);
  });

  it('refuses to unlock with a passkey that was never linked', async () => {
    const optionsRes = await t.app.request('/v1/device/unlock/options', jsonRequest('POST', {}));
    const { challengeId, options } = (await optionsRes.json()) as {
      challengeId: string;
      options: { challenge: string };
    };
    const res = await t.app.request(
      '/v1/device/unlock/verify',
      jsonRequest('POST', { challengeId, response: softDevice().authenticate(options) }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'passkey_not_verified' });
  });

  it('refuses an unlock challenge that has expired', async () => {
    const { headers, studentId } = await familyWithStudent();
    const { device } = await linkDevice(headers, studentId);
    const { challengeId, options } = (await (
      await t.app.request('/v1/device/unlock/options', jsonRequest('POST', {}))
    ).json()) as { challengeId: string; options: { challenge: string } };
    t.clock.advance(6 * 60 * 1000);
    const res = await t.app.request(
      '/v1/device/unlock/verify',
      jsonRequest('POST', { challengeId, response: device.authenticate(options) }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid_challenge' });
  });

  it('locks the device: the student session stops working', async () => {
    const { headers, studentId } = await familyWithStudent();
    const { cookie } = await linkDevice(headers, studentId);
    const lock = await t.app.request('/v1/student/lock', { method: 'POST', headers: { cookie } });
    expect(lock.status).toBe(204);
    expect((await t.app.request('/v1/student/me', { headers: { cookie } })).status).toBe(401);
  });

  it('expires a student session after 12 hours', async () => {
    const { headers, studentId } = await familyWithStudent();
    const { cookie } = await linkDevice(headers, studentId);
    t.clock.advance(12 * 60 * 60 * 1000 + 1000);
    expect((await t.app.request('/v1/student/me', { headers: { cookie } })).status).toBe(401);
  });

  it('rejects student routes without a session', async () => {
    expect((await t.app.request('/v1/student/me')).status).toBe(401);
    expect(
      (await t.app.request('/v1/student/me', { headers: { cookie: '__Host-rd_student=nope' } }))
        .status,
    ).toBe(401);
  });

  it('lets the parent unlink a device, which ends its session', async () => {
    const { headers, studentId } = await familyWithStudent();
    const { cookie } = await linkDevice(headers, studentId);
    const [device] = (await (
      await t.app.request(`/v1/students/${studentId}/devices`, { headers })
    ).json()) as { id: string }[];

    const other = await t.signInParent();
    expect(
      (
        await t.app.request(`/v1/students/${studentId}/devices/${device!.id}`, {
          method: 'DELETE',
          headers: other.headers,
        })
      ).status,
    ).toBe(404);

    const del = await t.app.request(`/v1/students/${studentId}/devices/${device!.id}`, {
      method: 'DELETE',
      headers,
    });
    expect(del.status).toBe(204);
    expect((await t.app.request('/v1/student/me', { headers: { cookie } })).status).toBe(401);
  });
});
