import { afterEach, describe, expect, it } from 'vitest';
import { createTestContext } from './test/helpers';

type Ctx = Awaited<ReturnType<typeof createTestContext>>;
let t: Ctx | undefined;
afterEach(async () => {
  await t?.close?.();
  t = undefined;
});

const startSignIn = (ctx: Ctx, provider: string) =>
  ctx.app.request('/api/auth/sign-in/social', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://dev.revisionden.test' },
    body: JSON.stringify({ provider, callbackURL: 'https://dev.revisionden.test/family' }),
  });

describe('configured sign-in providers', () => {
  it('lists both providers for anyone, signed in or not', async () => {
    t = await createTestContext();
    const res = await t.app.request('/v1/auth/providers');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ providers: ['google', 'microsoft'] });
  });

  it('lists and allows only Google when Microsoft is not set up', async () => {
    t = await createTestContext({
      config: { microsoft: undefined, signInProviders: ['google'] },
    });
    expect(await (await t.app.request('/v1/auth/providers')).json()).toEqual({
      providers: ['google'],
    });
    expect((await startSignIn(t, 'google')).status).toBe(200);
    expect((await startSignIn(t, 'microsoft')).status).not.toBe(200);
  });
});
