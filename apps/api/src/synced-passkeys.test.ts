import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { deviceMarkers, devices } from '@revisionden/db';
import {
  AVATAR,
  createTestContext,
  jsonRequest,
  TEST_CONFIG,
  type TestContext,
} from './test/helpers';
import { createSoftAuthenticator } from './test/soft-authenticator';

/**
 * Synced passkeys (I5b, owner decision: allow, and tell the parents). A passkey synced to the
 * child's other device unlocks there as a new device of its own, and both parents are told.
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

async function unlock(passkey: Passkey, deviceMarker?: string) {
  const { challengeId, options } = (await (
    await t.app.request('/v1/device/unlock/options', jsonRequest('POST', {}))
  ).json()) as { challengeId: string; options: { challenge: string } };
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

describe('synced passkeys', () => {
  it('gives a newly linked device a marker to keep, storing only its hash', async () => {
    const { headers, studentId } = await family('Comet_7');
    const { deviceId, marker } = await link(headers, studentId);
    expect(marker).toMatch(/^[A-Za-z0-9_-]{32,}$/);
    const rows = await t.db
      .select()
      .from(deviceMarkers)
      .where(eq(deviceMarkers.deviceId, deviceId));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.markerHash).not.toBe(marker);
  });

  it('unlocks the same device again with its marker, adding no device and telling no one', async () => {
    const { headers, studentId } = await family('Nova_2');
    const { passkey, marker } = await link(headers, studentId);
    const { res, body } = await unlock(passkey, marker);
    expect(res.status).toBe(200);
    expect(body.deviceMarker).toBeUndefined();
    expect(await deviceIds(headers, studentId)).toHaveLength(1);
    expect((await events(headers)).map((e) => e.kind)).not.toContain('passkey_new_device');
  });

  it('treats a synced passkey on another device as a new device, and tells both parents', async () => {
    const { headers, studentId } = await family('Orbit_3');
    const { passkey } = await link(headers, studentId);
    // The same passkey, synced to the child's laptop: no marker there.
    const { res, body } = await unlock(passkey);
    expect(res.status).toBe(200);
    expect(body.deviceMarker).toMatch(/^[A-Za-z0-9_-]{32,}$/);
    expect(await deviceIds(headers, studentId)).toHaveLength(2);
    const [latest] = await events(headers);
    expect(latest).toMatchObject({
      kind: 'passkey_new_device',
      by: 'RevisionDen',
      what: "noticed Orbit_3's passkey being used on a new device",
      important: true,
    });
    // The laptop then unlocks as itself.
    const again = await unlock(passkey, body.deviceMarker);
    expect(again.res.status).toBe(200);
    expect(await deviceIds(headers, studentId)).toHaveLength(2);
  });

  it('counts cleared browser storage as at most one new device a day per passkey', async () => {
    const { headers, studentId } = await family('Pulse_4');
    const { passkey } = await link(headers, studentId);
    await unlock(passkey);
    const second = await unlock(passkey);
    const third = await unlock(passkey, 'made-up-marker-made-up-marker-000');
    expect(second.res.status).toBe(200);
    expect(third.res.status).toBe(200);
    expect(second.body.deviceMarker).toBeDefined();
    expect(await deviceIds(headers, studentId)).toHaveLength(2);
    expect((await events(headers)).filter((e) => e.kind === 'passkey_new_device')).toHaveLength(1);
    t.clock.advance(25 * 60 * 60 * 1000);
    await unlock(passkey);
    expect(await deviceIds(headers, studentId)).toHaveLength(3);
  });

  it('adopts a device linked before markers existed, without telling the parents', async () => {
    const { headers, studentId } = await family('Quasar_5');
    const { passkey, deviceId } = await link(headers, studentId);
    await t.db.delete(deviceMarkers).where(eq(deviceMarkers.deviceId, deviceId));
    const { res, body } = await unlock(passkey);
    expect(res.status).toBe(200);
    expect(body.deviceMarker).toBeDefined();
    expect(await deviceIds(headers, studentId)).toEqual([deviceId]);
    expect((await events(headers)).map((e) => e.kind)).not.toContain('passkey_new_device');
  });

  it('refuses a browser whose device a parent unlinked, while the other device still works', async () => {
    const { headers, studentId } = await family('Rocket_6');
    const { passkey, deviceId, marker } = await link(headers, studentId);
    const laptop = await unlock(passkey);
    await t.app.request(`/v1/students/${studentId}/devices/${deviceId}`, {
      method: 'DELETE',
      headers,
    });
    const refused = await unlock(passkey, marker);
    expect(refused.res.status).toBe(400);
    expect(refused.body.error?.code).toBe('passkey_not_verified');
    expect((await unlock(passkey, laptop.body.deviceMarker)).res.status).toBe(200);
  });

  it('keeps each device of a synced passkey separate, so a parent can unlink just one', async () => {
    const { headers, studentId } = await family('Saturn_8');
    const { passkey, marker } = await link(headers, studentId);
    const laptop = await unlock(passkey);
    expect(await deviceIds(headers, studentId)).toHaveLength(2);
    const rows = await t.db.select().from(devices).where(eq(devices.studentId, studentId));
    expect(new Set(rows.map((r) => r.credentialId)).size).toBe(1);
    expect((await unlock(passkey, marker)).res.status).toBe(200);
    expect((await unlock(passkey, laptop.body.deviceMarker)).res.status).toBe(200);
  });

  it('keeps one signature counter for a synced passkey, so a cloned passkey is still caught', async () => {
    const { headers, studentId } = await family('Titan_9');
    const { passkey, marker } = await link(headers, studentId);
    await unlock(passkey); // the laptop: a second row for the same passkey
    await unlock(passkey, marker); // then the phone again
    const rows = await t.db.select().from(devices).where(eq(devices.studentId, studentId));
    expect(rows).toHaveLength(2);
    // Every row holds the newest counter, whichever device unlocked last.
    expect(new Set(rows.map((r) => r.counter)).size).toBe(1);
    expect(rows[0]!.counter).toBeGreaterThan(0);
  });
});
