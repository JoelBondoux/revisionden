import { DEFAULT_AVATAR, encodeAvatar } from '@revisionden/core';
import { createOnboardingApi, OnboardingApiError } from './api';

const AVATAR = encodeAvatar(DEFAULT_AVATAR);
const STUDENT_ID = '11111111-1111-4111-8111-111111111111';

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

  it('creates a one-time link code for a child', async () => {
    const fetch = fakeFetch(201, {
      token: 'x'.repeat(32),
      familyId: 'f1',
      studentId: STUDENT_ID,
      expiresAt: '2026-11-24T10:10:00.000Z',
      linkUrl: 'https://dev.revisionden.test/link?token=abc&family=f1',
    });
    const api = createOnboardingApi({ baseUrl: 'https://api.test', fetch });
    const token = await api.createLinkToken(STUDENT_ID);
    expect(token.linkUrl).toContain('/link?token=');
    expect(String(fetch.mock.calls[0]![0])).toBe(
      `https://api.test/v1/students/${STUDENT_ID}/link-tokens`,
    );
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
});
