import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, jsonRequest, type TestContext } from '../test/helpers';

let t: TestContext;

beforeEach(async () => {
  t = await createTestContext();
});

afterEach(async () => {
  await t.close();
});

const put = (headers: Record<string, string>, body: unknown) =>
  t.app.request('/v1/policy-acceptances', jsonRequest('PUT', body, headers));

describe('policy acceptance', () => {
  it('starts empty, then stores the versions a parent confirmed', async () => {
    const parent = await t.signInParent();
    const empty = await t.app.request('/v1/policy-acceptances', { headers: parent.headers });
    expect(await empty.json()).toEqual({ acceptances: [] });

    const res = await put(parent.headers, {
      acceptances: [
        { policy: 'privacy-notice', version: '1.0' },
        { policy: 'terms-of-use', version: '1.0' },
      ],
    });
    expect(res.status).toBe(200);
    const list = (await res.json()) as { acceptances: Record<string, unknown>[] };
    expect(list.acceptances).toEqual([
      { policy: 'privacy-notice', version: '1.0', acceptedAt: t.clock.now().toISOString() },
      { policy: 'terms-of-use', version: '1.0', acceptedAt: t.clock.now().toISOString() },
    ]);
  });

  it('replaces the stored version when a newer one is confirmed', async () => {
    const parent = await t.signInParent();
    await put(parent.headers, { acceptances: [{ policy: 'terms-of-use', version: '1.0' }] });
    t.clock.advance(1000);
    await put(parent.headers, { acceptances: [{ policy: 'terms-of-use', version: '1.1' }] });
    const res = await t.app.request('/v1/policy-acceptances', { headers: parent.headers });
    expect(await res.json()).toEqual({
      acceptances: [
        { policy: 'terms-of-use', version: '1.1', acceptedAt: t.clock.now().toISOString() },
      ],
    });
  });

  it('refuses unknown policies and badly formed versions', async () => {
    const parent = await t.signInParent();
    expect(
      (await put(parent.headers, { acceptances: [{ policy: 'cookies', version: '1.0' }] })).status,
    ).toBe(400);
    expect(
      (await put(parent.headers, { acceptances: [{ policy: 'terms-of-use', version: 'v1' }] }))
        .status,
    ).toBe(400);
  });

  it("keeps each parent's acceptances to themselves", async () => {
    const one = await t.signInParent();
    const two = await t.signInParent();
    await put(one.headers, { acceptances: [{ policy: 'terms-of-use', version: '1.0' }] });
    const res = await t.app.request('/v1/policy-acceptances', { headers: two.headers });
    expect(await res.json()).toEqual({ acceptances: [] });
  });

  it('needs a signed-in parent', async () => {
    expect((await t.app.request('/v1/policy-acceptances')).status).toBe(401);
  });
});
