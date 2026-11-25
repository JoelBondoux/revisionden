import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { authAccounts, authUsers } from '@revisionden/db';
import { eq } from 'drizzle-orm';
import { createTestContext, jsonRequest, type TestContext } from './test/helpers';

let t: TestContext;

beforeAll(async () => {
  t = await createTestContext();
});

afterAll(async () => {
  await t.close();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const b64url = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url');
const fakeIdToken = (claims: object) =>
  `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url(claims)}.sig`;

/** Answers the provider's token endpoint; every other request fails loudly. */
function stubProvider(tokenEndpoint: string, claims: object) {
  const realFetch = globalThis.fetch;
  const calls: string[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push(url);
    if (url.startsWith(tokenEndpoint)) {
      return Response.json({
        access_token: 'provider-access-token',
        refresh_token: 'provider-refresh-token',
        id_token: fakeIdToken(claims),
        token_type: 'Bearer',
        expires_in: 3600,
      });
    }
    if (url.startsWith('http://localhost') || url.startsWith('https://api-dev.revisionden.test')) {
      return realFetch(input, init);
    }
    throw new Error(`Unexpected outbound request in test: ${url}`);
  });
  return calls;
}

function cookiesFrom(res: Response): string[] {
  return res.headers.getSetCookie();
}

function cookieHeader(setCookies: string[]): string {
  return setCookies.map((c) => c.split(';')[0]).join('; ');
}

async function signInWith(
  provider: 'google' | 'microsoft',
  tokenEndpoint: string,
  claims: object,
  ctx: TestContext = t,
) {
  const start = await ctx.app.request(
    '/api/auth/sign-in/social',
    jsonRequest(
      'POST',
      { provider, callbackURL: 'https://dev.revisionden.test/family' },
      { origin: 'https://dev.revisionden.test' },
    ),
  );
  expect(start.status).toBe(200);
  const { url } = (await start.json()) as { url: string };
  const state = new URL(url).searchParams.get('state');
  expect(state).toBeTruthy();

  const calls = stubProvider(tokenEndpoint, claims);
  const callback = await ctx.app.request(
    `/api/auth/callback/${provider}?code=test-code&state=${state}`,
    { headers: { cookie: cookieHeader(cookiesFrom(start)) } },
  );
  return { callback, calls };
}

describe('parent sign-in', () => {
  it('signs in with Google and sets an HttpOnly, Secure, SameSite=Lax session cookie', async () => {
    const { callback } = await signInWith('google', 'https://oauth2.googleapis.com/token', {
      sub: 'google-user-1',
      email: 'parent.google@example.com',
      email_verified: true,
      name: 'Made Up Person',
      picture: 'https://example.com/photo.jpg',
    });
    expect(callback.status).toBe(302);
    expect(callback.headers.get('location')).toBe('https://dev.revisionden.test/family');

    const session = cookiesFrom(callback).find((c) => c.includes('session_token='));
    expect(session).toBeDefined();
    expect(session).toMatch(/HttpOnly/i);
    expect(session).toMatch(/Secure/i);
    expect(session).toMatch(/SameSite=Lax/i);
  });

  it('keeps only the sign-in email: the provider name and picture are not stored', async () => {
    const [user] = await t.db
      .select()
      .from(authUsers)
      .where(eq(authUsers.email, 'parent.google@example.com'));
    expect(user).toMatchObject({ name: '', image: null });
  });

  it('keeps no Google tokens after sign-in: access, refresh and ID tokens are all blank', async () => {
    const [user] = await t.db
      .select()
      .from(authUsers)
      .where(eq(authUsers.email, 'parent.google@example.com'));
    const accounts = await t.db
      .select()
      .from(authAccounts)
      .where(eq(authAccounts.userId, user!.id));
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({
      providerId: 'google',
      accountId: 'google-user-1',
      accessToken: null,
      refreshToken: null,
      idToken: null,
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
      password: null,
    });
  });

  it('signs in again with Google and still keeps no tokens', async () => {
    const { callback } = await signInWith('google', 'https://oauth2.googleapis.com/token', {
      sub: 'google-user-1',
      email: 'parent.google@example.com',
      email_verified: true,
      name: 'Made Up Person',
    });
    expect(callback.status).toBe(302);
    expect(callback.headers.get('location')).toBe('https://dev.revisionden.test/family');
    const rows = await t.db
      .select()
      .from(authAccounts)
      .where(eq(authAccounts.accountId, 'google-user-1'));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ accessToken: null, refreshToken: null, idToken: null });
  });

  it('signs in with Microsoft without fetching the profile photo', async () => {
    const { callback, calls } = await signInWith(
      'microsoft',
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      {
        sub: 'ms-user-1',
        oid: 'ms-user-1',
        email: 'parent.microsoft@example.com',
        email_verified: true,
        name: 'Another Made Up Person',
      },
    );
    expect(callback.status).toBe(302);
    expect(calls.some((u) => u.includes('graph.microsoft.com'))).toBe(false);
    const [user] = await t.db
      .select()
      .from(authUsers)
      .where(eq(authUsers.email, 'parent.microsoft@example.com'));
    expect(user).toMatchObject({ name: '', image: null });
    const [account] = await t.db
      .select()
      .from(authAccounts)
      .where(eq(authAccounts.userId, user!.id));
    expect(account).toMatchObject({ accessToken: null, refreshToken: null, idToken: null });
  });

  it('signs out: the session stops working', async () => {
    const { headers } = await t.signInParent();
    expect((await t.app.request('/v1/me', { headers })).status).toBe(200);

    const out = await t.app.request(
      '/api/auth/sign-out',
      jsonRequest('POST', {}, { ...headers, origin: 'https://dev.revisionden.test' }),
    );
    expect(out.status).toBe(200);
    expect((await t.app.request('/v1/me', { headers })).status).toBe(401);
  });
});

describe('parent sign-in with only one provider configured', () => {
  it('keeps no tokens when Microsoft is the only provider', async () => {
    const solo = await createTestContext({
      config: { google: undefined, signInProviders: ['microsoft'] },
    });
    try {
      const { callback } = await signInWith(
        'microsoft',
        'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        { sub: 'ms-solo-1', oid: 'ms-solo-1', email: 'solo@example.com', email_verified: true },
        solo,
      );
      expect(callback.status).toBe(302);
      const rows = await solo.db
        .select()
        .from(authAccounts)
        .where(eq(authAccounts.accountId, 'ms-solo-1'));
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        providerId: 'microsoft',
        accessToken: null,
        refreshToken: null,
        idToken: null,
      });
    } finally {
      await solo.close();
    }
  });
});
