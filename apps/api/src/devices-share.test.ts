import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  DeviceListSchema,
  LinkStatusSchema,
  LinkTokenSchema,
  normaliseLinkCode,
} from '@revisionden/core';
import { familyEvents } from '@revisionden/db';
import { eq } from 'drizzle-orm';
import { describeFamilyEventMessage } from './family-events';
import {
  AVATAR,
  createTestContext,
  jsonRequest,
  TEST_CONFIG,
  type TestContext,
} from './test/helpers';
import { createSoftAuthenticator } from './test/soft-authenticator';

let t: TestContext;

beforeAll(async () => {
  t = await createTestContext({ authLimit: 1000 });
});

afterAll(async () => {
  await t.close();
});

type Headers = Record<string, string>;
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
let n = 0;

async function family() {
  n += 1;
  const parent = await t.signInParent();
  const res = await t.app.request(
    '/v1/students',
    jsonRequest(
      'POST',
      { nickname: `share_kid_${n}`, avatarCode: AVATAR, yearGroup: 11 },
      parent.headers,
    ),
  );
  const { id } = (await res.json()) as { id: string };
  return { headers: parent.headers, studentId: id, nickname: `share_kid_${n}` };
}

async function makeLink(headers: Headers, studentId: string, kind?: 'qr' | 'share') {
  const res = await t.app.request(
    `/v1/students/${studentId}/link-tokens`,
    kind ? jsonRequest('POST', { kind }, headers) : { method: 'POST', headers },
  );
  expect(res.status).toBe(201);
  return LinkTokenSchema.parse(await res.json());
}

const status = async (headers: Headers, studentId: string, tokenId: string) => {
  const res = await t.app.request(`/v1/students/${studentId}/link-tokens/${tokenId}`, { headers });
  return { res, body: res.ok ? LinkStatusSchema.parse(await res.json()) : null };
};

const redeemCode = (code: string, headers: Headers = {}) =>
  t.app.request('/v1/device/link', jsonRequest('POST', { code }, headers));

async function verify(redeemed: Response, deviceType?: string) {
  const body = (await redeemed.json()) as { challengeId: string; options: { challenge: string } };
  const device = createSoftAuthenticator({
    origin: TEST_CONFIG.webOrigin,
    rpId: TEST_CONFIG.passkeyRpId,
  });
  return t.app.request(
    '/v1/device/link/verify',
    jsonRequest('POST', {
      challengeId: body.challengeId,
      response: device.register(body.options),
      ...(deviceType ? { deviceType } : {}),
    }),
  );
}

describe('share links and short codes', () => {
  it('makes a QR link for 10 minutes, with a short code', async () => {
    const { headers, studentId } = await family();
    const link = await makeLink(headers, studentId);
    expect(link.kind).toBe('qr');
    expect(Date.parse(link.expiresAt) - t.clock.now().getTime()).toBe(10 * MINUTE);
    expect(link.code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(normaliseLinkCode(link.code)).not.toBeNull();
  });

  it('makes a shared link that lasts 24 hours', async () => {
    const { headers, studentId } = await family();
    const link = await makeLink(headers, studentId, 'share');
    expect(link.kind).toBe('share');
    expect(Date.parse(link.expiresAt) - t.clock.now().getTime()).toBe(24 * HOUR);
  });

  it('never puts the nickname in the link', async () => {
    const { headers, studentId, nickname } = await family();
    const link = await makeLink(headers, studentId, 'share');
    expect(link.linkUrl).not.toContain(nickname);
  });

  it('links a device with the short code, typed any way, once only', async () => {
    const { headers, studentId } = await family();
    const link = await makeLink(headers, studentId, 'share');
    const typed = link.code.toLowerCase().replace('-', ' ');
    const first = await redeemCode(typed);
    expect(first.status).toBe(200);
    expect(
      ((await first.clone().json()) as { student: { nickname: string } }).student.nickname,
    ).toMatch(/^share_kid_/);
    expect((await verify(first, 'phone')).status).toBe(201);
    expect((await redeemCode(link.code)).status).toBe(400);
  });

  it('refuses a code that does not exist, or is not a code at all', async () => {
    expect((await redeemCode('ABCD-EFGH')).status).toBe(400);
    expect((await redeemCode('nope')).status).toBe(400);
  });

  it('refuses a code once the link has expired', async () => {
    const { headers, studentId } = await family();
    const link = await makeLink(headers, studentId);
    t.clock.advance(11 * MINUTE);
    expect((await redeemCode(link.code)).status).toBe(400);
  });

  it('rate-limits code attempts per address', async () => {
    const limited = await createTestContext({ authLimit: 1000, linkCodeLimit: 3 });
    try {
      const attempt = () =>
        limited.app.request(
          '/v1/device/link',
          jsonRequest('POST', { code: 'ABCD-EFGH' }, { 'cf-connecting-ip': '203.0.113.9' }),
        );
      for (let i = 0; i < 3; i += 1) expect((await attempt()).status).toBe(400);
      expect((await attempt()).status).toBe(429);
    } finally {
      await limited.close();
    }
  });
});

describe('waiting for the device, and cancelling', () => {
  it('shows waiting, then linked once the device is set up', async () => {
    const { headers, studentId } = await family();
    const link = await makeLink(headers, studentId, 'share');
    expect((await status(headers, studentId, link.tokenId)).body).toEqual({ status: 'waiting' });
    const redeemed = await redeemCode(link.code);
    expect((await status(headers, studentId, link.tokenId)).body).toEqual({ status: 'waiting' });
    expect((await verify(redeemed, 'phone')).status).toBe(201);
    expect((await status(headers, studentId, link.tokenId)).body).toEqual({ status: 'linked' });
  });

  it('shows expired after the time runs out', async () => {
    const { headers, studentId } = await family();
    const link = await makeLink(headers, studentId);
    t.clock.advance(11 * MINUTE);
    expect((await status(headers, studentId, link.tokenId)).body).toEqual({ status: 'expired' });
  });

  it('cancels a link so it can no longer be used', async () => {
    const { headers, studentId } = await family();
    const link = await makeLink(headers, studentId, 'share');
    const res = await t.app.request(`/v1/students/${studentId}/link-tokens/${link.tokenId}`, {
      method: 'DELETE',
      headers,
    });
    expect(res.status).toBe(204);
    expect((await status(headers, studentId, link.tokenId)).body).toEqual({ status: 'cancelled' });
    expect((await redeemCode(link.code)).status).toBe(400);
    expect(
      (
        await t.app.request(
          '/v1/device/link',
          jsonRequest('POST', { token: link.token, familyId: link.familyId }),
        )
      ).status,
    ).toBe(400);
  });

  it('stops a set-up that had already started when the link is cancelled', async () => {
    const { headers, studentId } = await family();
    const link = await makeLink(headers, studentId, 'share');
    const redeemed = await redeemCode(link.code);
    expect(redeemed.status).toBe(200);
    await t.app.request(`/v1/students/${studentId}/link-tokens/${link.tokenId}`, {
      method: 'DELETE',
      headers,
    });
    const verified = await verify(redeemed, 'phone');
    expect(verified.status).toBe(400);
    expect(verified.headers.getSetCookie().some((c) => c.startsWith('__Host-rd_student='))).toBe(
      false,
    );
    const list = DeviceListSchema.parse(
      await (await t.app.request(`/v1/students/${studentId}/devices`, { headers })).json(),
    );
    expect(list.devices).toHaveLength(0);
  });

  it('shows linked only for the link whose device finished setting up', async () => {
    const { headers, studentId } = await family();
    const abandoned = await makeLink(headers, studentId, 'share');
    const used = await makeLink(headers, studentId);
    expect((await redeemCode(abandoned.code)).status).toBe(200);
    expect((await verify(await redeemCode(used.code), 'phone')).status).toBe(201);
    expect((await status(headers, studentId, used.tokenId)).body).toEqual({ status: 'linked' });
    expect((await status(headers, studentId, abandoned.tokenId)).body).toEqual({
      status: 'waiting',
    });
  });

  it('keeps other families out', async () => {
    const { headers, studentId } = await family();
    const other = await family();
    const link = await makeLink(headers, studentId);
    expect((await status(other.headers, studentId, link.tokenId)).res.status).toBe(404);
    expect((await status(other.headers, other.studentId, link.tokenId)).res.status).toBe(404);
    const del = await t.app.request(`/v1/students/${other.studentId}/link-tokens/${link.tokenId}`, {
      method: 'DELETE',
      headers: other.headers,
    });
    expect(del.status).toBe(404);
  });

  it('says not found for a link id that is not an id', async () => {
    const { headers, studentId } = await family();
    expect((await status(headers, studentId, 'nope')).res.status).toBe(404);
  });
});

describe('linked devices in the parent area', () => {
  it('lists each device with its type and date linked, and removing it ends its session', async () => {
    const { headers, studentId } = await family();
    const link = await makeLink(headers, studentId, 'share');
    const verified = await verify(await redeemCode(link.code), 'tablet');
    const cookie = verified.headers.getSetCookie().find((c) => c.startsWith('__Host-rd_student='))!;
    const list = DeviceListSchema.parse(
      await (await t.app.request(`/v1/students/${studentId}/devices`, { headers })).json(),
    );
    expect(list.devices).toHaveLength(1);
    expect(list.devices[0]).toMatchObject({ deviceType: 'tablet' });
    expect(list.devices[0]!.linkedAt).toBe(t.clock.now().toISOString());

    const studentHeaders = { cookie: cookie.split(';')[0]! };
    expect((await t.app.request('/v1/student/me', { headers: studentHeaders })).status).toBe(200);
    const removed = await t.app.request(
      `/v1/students/${studentId}/devices/${list.devices[0]!.id}`,
      {
        method: 'DELETE',
        headers,
      },
    );
    expect(removed.status).toBe(204);
    expect((await t.app.request('/v1/student/me', { headers: studentHeaders })).status).toBe(401);
  });

  it('shows an unknown device type when the device did not say', async () => {
    const { headers, studentId } = await family();
    const link = await makeLink(headers, studentId);
    await verify(await redeemCode(link.code));
    const list = DeviceListSchema.parse(
      await (await t.app.request(`/v1/students/${studentId}/devices`, { headers })).json(),
    );
    expect(list.devices[0]!.deviceType).toBeNull();
  });

  it('refuses a device type that is not phone, tablet or computer', async () => {
    const { headers, studentId } = await family();
    const link = await makeLink(headers, studentId);
    expect((await verify(await redeemCode(link.code), 'toaster')).status).toBe(400);
  });
});

describe('telling the parent', () => {
  it('records "<nickname>\'s device is set up" for the parents to be pushed', async () => {
    const { headers, studentId, nickname } = await family();
    const link = await makeLink(headers, studentId, 'share');
    await verify(await redeemCode(link.code), 'phone');
    const rows = await t.db
      .select()
      .from(familyEvents)
      .where(eq(familyEvents.studentId, studentId));
    const linked = rows.find((r) => r.kind === 'device_linked');
    expect(linked).toMatchObject({ important: true, actorPosition: null });
    expect(describeFamilyEventMessage('device_linked', null, nickname)).toBe(
      `${nickname}'s device is set up`,
    );
  });
});
