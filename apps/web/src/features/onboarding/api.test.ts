import { DEFAULT_AVATAR, encodeAvatar } from '@revisionden/core';
import { createOnboardingApi, OnboardingApiError } from './api';

const AVATAR = encodeAvatar(DEFAULT_AVATAR);
const STUDENT_ID = '11111111-1111-4111-8111-111111111111';

const LINK = {
  tokenId: 't1',
  kind: 'qr',
  token: 'x'.repeat(32),
  familyId: 'f1',
  studentId: STUDENT_ID,
  expiresAt: '2026-11-24T10:10:00.000Z',
  linkUrl: 'https://dev.revisionden.test/link?token=abc&family=f1',
  code: 'ABCD-EFGH',
};

const child = {
  student: { id: STUDENT_ID, nickname: 'Comet_7', avatarCode: AVATAR, yearGroup: 11 },
  enrolments: [],
  level: 'gcse',
  examSeason: { season: 'summer', year: 2027 },
  toCheckLater: 0,
  linkedDevices: 0,
};

function fakeFetch(status: number, body: unknown) {
  return vi.fn<(url: URL | RequestInfo, init?: RequestInit) => Promise<Response>>(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
  );
}

describe('onboarding API client', () => {
  it('loads the family with cookies sent', async () => {
    const fetch = fakeFetch(200, { children: [child] });
    const api = createOnboardingApi({ baseUrl: 'https://api.test', fetch });
    const family = await api.getFamily();
    expect(family.children[0]!.student.nickname).toBe('Comet_7');
    const [url, init] = fetch.mock.calls[0]!;
    expect(String(url)).toBe('https://api.test/v1/onboarding/family');
    expect(init?.credentials).toBe('include');
  });

  it('adds a child with a JSON body', async () => {
    const fetch = fakeFetch(201, child);
    const api = createOnboardingApi({ baseUrl: 'https://api.test/', fetch });
    const request = { nickname: 'Comet_7', avatarCode: AVATAR, yearGroup: 11, subjects: [] };
    await api.addChild(request);
    const [url, init] = fetch.mock.calls[0]!;
    expect(String(url)).toBe('https://api.test/v1/onboarding/children');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual(request);
  });

  it('creates a one-time link code for a child, as a QR code or a shared link', async () => {
    const fetch = fakeFetch(201, LINK);
    const api = createOnboardingApi({ baseUrl: 'https://api.test', fetch });
    const token = await api.createLinkToken(STUDENT_ID);
    expect(token.linkUrl).toContain('/link?token=');
    expect(String(fetch.mock.calls[0]![0])).toBe(
      `https://api.test/v1/students/${STUDENT_ID}/link-tokens`,
    );
    expect(JSON.parse(String(fetch.mock.calls[0]![1]?.body))).toEqual({ kind: 'qr' });
    await api.createLinkToken(STUDENT_ID, 'share');
    expect(JSON.parse(String(fetch.mock.calls[1]![1]?.body))).toEqual({ kind: 'share' });
  });

  it('checks and cancels a link', async () => {
    const statusFetch = fakeFetch(200, { status: 'waiting' });
    const api = createOnboardingApi({ baseUrl: 'https://api.test', fetch: statusFetch });
    expect(await api.getLinkStatus(STUDENT_ID, 't1')).toBe('waiting');
    expect(String(statusFetch.mock.calls[0]![0])).toBe(
      `https://api.test/v1/students/${STUDENT_ID}/link-tokens/t1`,
    );
    const del = vi.fn(async () => new Response(null, { status: 204 }));
    await createOnboardingApi({ baseUrl: 'https://api.test', fetch: del }).cancelLink(
      STUDENT_ID,
      't1',
    );
    expect((del.mock.calls[0] as unknown as [URL, RequestInit])[1].method).toBe('DELETE');
  });

  it('lists and removes linked devices', async () => {
    const list = fakeFetch(200, {
      devices: [
        { id: 'd1', deviceType: 'phone', linkedAt: '2026-11-24T10:00:00.000Z', lastUsedAt: null },
      ],
    });
    const api = createOnboardingApi({ baseUrl: 'https://api.test', fetch: list });
    expect((await api.listDevices(STUDENT_ID))[0]!.deviceType).toBe('phone');
    const del = vi.fn(async () => new Response(null, { status: 204 }));
    await createOnboardingApi({ baseUrl: 'https://api.test', fetch: del }).removeDevice(
      STUDENT_ID,
      'd1',
    );
    expect(String((del.mock.calls[0] as unknown as [URL])[0])).toBe(
      `https://api.test/v1/students/${STUDENT_ID}/devices/d1`,
    );
  });

  it('redeems a typed short code', async () => {
    const fetch = fakeFetch(200, {
      challengeId: 'c1',
      options: { challenge: 'abc' },
      student: { nickname: 'Comet_7', avatarCode: AVATAR },
    });
    const api = createOnboardingApi({ baseUrl: 'https://api.test', fetch });
    await api.redeemLink({ code: 'ABCD-EFGH' });
    expect(JSON.parse(String(fetch.mock.calls[0]![1]?.body))).toEqual({ code: 'ABCD-EFGH' });
  });

  it('passes on the server’s message and details when a request fails', async () => {
    const fetch = fakeFetch(409, {
      error: { code: 'nickname_taken', message: 'Another student in the family has that nickname' },
    });
    const api = createOnboardingApi({ baseUrl: 'https://api.test', fetch });
    const failure = await api
      .addChild({ nickname: 'Comet_7', avatarCode: AVATAR, yearGroup: 11, subjects: [] })
      .catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(OnboardingApiError);
    expect(failure).toMatchObject({
      status: 409,
      code: 'nickname_taken',
      message: 'Another student in the family has that nickname',
    });
  });

  it('gives a plain message when the network is down', async () => {
    const api = createOnboardingApi({
      baseUrl: 'https://api.test',
      fetch: vi.fn(async () => {
        throw new TypeError('offline');
      }),
    });
    await expect(api.getFamily()).rejects.toMatchObject({
      code: 'network',
      message: 'Could not reach RevisionDen. Check your connection and try again.',
    });
  });

  it('rejects a response that does not match the shared schema', async () => {
    const api = createOnboardingApi({ baseUrl: 'https://api.test', fetch: fakeFetch(200, {}) });
    await expect(api.getFamily()).rejects.toMatchObject({ code: 'schema' });
  });

  it('redeems a link code and confirms the passkey for the student device', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            challengeId: 'c1',
            options: { challenge: 'abc' },
            student: { nickname: 'Comet_7', avatarCode: AVATAR },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ deviceId: 'd1', student: child.student }), { status: 201 }),
      );
    const api = createOnboardingApi({ baseUrl: 'https://api.test', fetch });
    const link = await api.redeemLink({ token: 't'.repeat(32), familyId: 'f1' });
    expect(link.student.nickname).toBe('Comet_7');
    const done = await api.verifyLink({
      challengeId: 'c1',
      response: { id: 'cred', response: {} },
    });
    expect(done.student.id).toBe(STUDENT_ID);
    expect(String(fetch.mock.calls[0]![0])).toBe('https://api.test/v1/device/link');
    expect(String(fetch.mock.calls[1]![0])).toBe('https://api.test/v1/device/link/verify');
  });

  it('sets a child board or tier with PATCH', async () => {
    const fetch = fakeFetch(200, {
      studentId: STUDENT_ID,
      subjectId: 'gcse-maths',
      board: 'AQA',
      tier: 'higher',
    });
    const api = createOnboardingApi({ baseUrl: 'https://api.test', fetch });
    const saved = await api.updateChildSubject(STUDENT_ID, 'gcse-maths', { board: 'AQA' });
    expect(saved.board).toBe('AQA');
    const [url, init] = fetch.mock.calls[0]!;
    expect(String(url)).toBe(`https://api.test/v1/students/${STUDENT_ID}/enrolments/gcse-maths`);
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(String(init?.body))).toEqual({ board: 'AQA' });
  });

  it('reads and updates the student device subjects', async () => {
    const list = fakeFetch(200, { enrolments: [], toCheckLater: 0 });
    const api = createOnboardingApi({ baseUrl: 'https://api.test', fetch: list });
    expect(await api.getMySubjects()).toEqual({ enrolments: [], toCheckLater: 0 });
    expect(String(list.mock.calls[0]![0])).toBe('https://api.test/v1/student/subjects');

    const patch = fakeFetch(200, {
      studentId: STUDENT_ID,
      subjectId: 'gcse-maths',
      board: 'OCR',
      tier: 'none',
    });
    const api2 = createOnboardingApi({ baseUrl: 'https://api.test', fetch: patch });
    await api2.updateMySubject('gcse-maths', { board: 'OCR' });
    expect(String(patch.mock.calls[0]![0])).toBe('https://api.test/v1/student/subjects/gcse-maths');
    expect(patch.mock.calls[0]![1]?.method).toBe('PATCH');
  });

  it('reads and saves the student device avatar', async () => {
    const read = fakeFetch(200, { avatarCode: AVATAR, earnedRewardIds: [] });
    const api = createOnboardingApi({ baseUrl: 'https://api.test', fetch: read });
    expect(await api.getMyAvatar()).toEqual({ avatarCode: AVATAR, earnedRewardIds: [] });

    const save = fakeFetch(200, child.student);
    const api2 = createOnboardingApi({ baseUrl: 'https://api.test', fetch: save });
    await api2.saveMyAvatar(AVATAR);
    expect(String(save.mock.calls[0]![0])).toBe('https://api.test/v1/student/avatar');
    expect(save.mock.calls[0]![1]?.method).toBe('PUT');
  });

  it('unlocks a student device with a passkey already on it', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ challengeId: 'c2', options: { challenge: 'xyz' } }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ student: child.student }), { status: 200 }),
      );
    const api = createOnboardingApi({ baseUrl: 'https://api.test', fetch });
    const start = await api.unlockOptions();
    expect(start).toEqual({ challengeId: 'c2', options: { challenge: 'xyz' } });
    const done = await api.unlockVerify({
      challengeId: 'c2',
      response: { id: 'cred', response: {} },
    });
    expect(done.student.id).toBe(STUDENT_ID);
    const [optionsUrl, optionsInit] = fetch.mock.calls[0]!;
    expect(String(optionsUrl)).toBe('https://api.test/v1/device/unlock/options');
    // No credential ids: the browser offers any RevisionDen passkey on this device.
    expect(optionsInit.body).toBe('{}');
    expect(optionsInit.credentials).toBe('include');
    expect(String(fetch.mock.calls[1]![0])).toBe('https://api.test/v1/device/unlock/verify');
  });
});
