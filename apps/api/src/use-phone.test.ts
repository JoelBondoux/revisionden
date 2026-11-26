import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  AVATAR,
  createTestContext,
  jsonRequest,
  TEST_CONFIG,
  type TestContext,
} from './test/helpers';
import { createSoftAuthenticator } from './test/soft-authenticator';

/**
 * E10, "Use my phone instead" (owner decision 2026-11-26, decision 0007): a computer that cannot
 * hold the child's passkey signs in with the passkey on their phone (WebAuthn hybrid: the browser
 * shows a QR code). To the server this is the phone's passkey on a new device, so the computer
 * becomes a linked device of its own, the parents are told, and the one-new-device-a-day limit
 * applies, as for synced passkeys.
 */
let t: TestContext;

beforeAll(async () => {
  t = await createTestContext();
});
afterAll(async () => {
  await t.close();
});

type Headers = Record<string, string>;
type Passkey = ReturnType<typeof createSoftAuthenticator>;

async function family(nickname: string) {
  const parent = await t.signInParent();
  const res = await t.app.request(
    '/v1/students',
    jsonRequest('POST', { nickname, avatarCode: AVATAR, yearGroup: 11 }, parent.headers),
  );
  const { id } = (await res.json()) as { id: string };
  return { headers: parent.headers, studentId: id };
}

async function link(headers: Headers, studentId: string) {
  const tokenRes = await t.app.request(`/v1/students/${studentId}/link-tokens`, {
    method: 'POST',
    headers,
  });
  const { token, familyId } = (await tokenRes.json()) as { token: string; familyId: string };
  const redeemed = (await (
    await t.app.request('/v1/device/link', jsonRequest('POST', { token, familyId }))
  ).json()) as { challengeId: string; options: { challenge: string } };
  const passkey = createSoftAuthenticator({
    origin: TEST_CONFIG.webOrigin,
    rpId: TEST_CONFIG.passkeyRpId,
  });
  const res = await t.app.request(
    '/v1/device/link/verify',
    jsonRequest('POST', {
      challengeId: redeemed.challengeId,
      response: passkey.register(redeemed.options),
    }),
  );
  const body = (await res.json()) as { deviceId: string; deviceMarker?: string };
  return { passkey, deviceId: body.deviceId, marker: body.deviceMarker };
}

const optionsFor = async (body: Record<string, unknown>) => {
  const res = await t.app.request('/v1/device/unlock/options', jsonRequest('POST', body));
  return { status: res.status, body: (await res.json()) as UnlockStart };
};

interface UnlockStart {
  challengeId: string;
  options: {
    challenge: string;
    allowCredentials?: unknown[];
    hints?: string[];
    userVerification?: string;
  };
}

/** Unlock from the phone (hybrid): the "Use my phone instead" options, then verify. */
async function unlock(passkey: Passkey, deviceMarker?: string) {
  const { challengeId, options } = (await optionsFor({ usePhone: true })).body;
  const res = await t.app.request(
    '/v1/device/unlock/verify',
    jsonRequest('POST', {
      challengeId,
      response: passkey.authenticate(options),
      ...(deviceMarker === undefined ? {} : { deviceMarker }),
    }),
  );
  return { res, body: (await res.json()) as { deviceMarker?: string; error?: { code: string } } };
}

const deviceIds = async (headers: Headers, studentId: string) =>
  (
    (await (await t.app.request(`/v1/students/${studentId}/devices`, { headers })).json()) as {
      devices: { id: string }[];
    }
  ).devices.map((d) => d.id);

const events = async (headers: Headers) =>
  (
    (await (await t.app.request('/v1/family/events', { headers })).json()) as {
      events: { kind: string; by: string | null; what: string; important: boolean }[];
    }
  ).events;

describe('Use my phone instead (E10)', () => {
  it('leaves the normal unlock as it was: any passkey can answer, no hints', async () => {
    const { status, body } = await optionsFor({});
    expect(status).toBe(200);
    expect(body.options.allowCredentials ?? []).toEqual([]);
    expect(body.options.hints).toBeUndefined();
    expect(body.options.userVerification).toBe('required');
  });

  it('asks the browser for the phone (hybrid) only on the Use my phone path', async () => {
    const { status, body } = await optionsFor({ usePhone: true });
    expect(status).toBe(200);
    expect(body.options.hints).toEqual(['hybrid']);
    // No credential list, so no transports filter can leave out the phone.
    expect(body.options.allowCredentials ?? []).toEqual([]);
    expect(body.options.userVerification).toBe('required');
  });

  it('refuses anything else in the options request', async () => {
    expect((await optionsFor({ usePhone: 'yes' })).status).toBe(400);
    expect((await optionsFor({ hints: ['hybrid'] })).status).toBe(400);
  });

  it('makes the computer a new linked device and tells the parents', async () => {
    const { headers, studentId } = await family('Laptop_1');
    const { passkey } = await link(headers, studentId);
    // The phone's passkey, used on a computer that has never seen RevisionDen: no marker.
    const { res, body } = await unlock(passkey);
    expect(res.status).toBe(200);
    expect(body.deviceMarker).toMatch(/^[A-Za-z0-9_-]{32,}$/);
    expect(await deviceIds(headers, studentId)).toHaveLength(2);
    const [latest] = await events(headers);
    expect(latest).toMatchObject({ kind: 'passkey_new_device', important: true });
    // Next time the computer signs in as itself: no new device, no new alert.
    const again = await unlock(passkey, body.deviceMarker);
    expect(again.res.status).toBe(200);
    expect(again.body.deviceMarker).toBeUndefined();
    expect(await deviceIds(headers, studentId)).toHaveLength(2);
    expect((await events(headers)).filter((e) => e.kind === 'passkey_new_device')).toHaveLength(1);
  });

  it('adds at most one new device a day from the phone', async () => {
    const { headers, studentId } = await family('Laptop_2');
    const { passkey } = await link(headers, studentId);
    await unlock(passkey); // a school computer
    await unlock(passkey); // another computer the same day
    expect(await deviceIds(headers, studentId)).toHaveLength(2);
    expect((await events(headers)).filter((e) => e.kind === 'passkey_new_device')).toHaveLength(1);
    t.clock.advance(25 * 60 * 60 * 1000);
    await unlock(passkey);
    expect(await deviceIds(headers, studentId)).toHaveLength(3);
  });

  it('refuses a phone passkey that was never linked', async () => {
    const stranger = createSoftAuthenticator({
      origin: TEST_CONFIG.webOrigin,
      rpId: TEST_CONFIG.passkeyRpId,
    });
    stranger.register({
      challenge: 'x',
      rp: { id: TEST_CONFIG.passkeyRpId, name: 'RevisionDen' },
      user: { id: 'dXNlcg', name: 'u', displayName: 'u' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
    } as never);
    const { res, body } = await unlock(stranger);
    expect(res.status).toBe(400);
    expect(body.error?.code).toBe('passkey_not_verified');
  });
});
