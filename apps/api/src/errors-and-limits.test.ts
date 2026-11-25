import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { ApiErrorSchema } from '@revisionden/core';
import { createErrorHandler } from './errors';
import { AVATAR, createTestContext, jsonRequest, type TestContext } from './test/helpers';

describe('consistent JSON errors', () => {
  let t: TestContext;
  beforeAll(async () => {
    t = await createTestContext();
  });
  afterAll(async () => {
    await t.close();
  });

  it('answers malformed JSON with 400 invalid_json', async () => {
    const { headers } = await t.signInParent();
    const res = await t.app.request('/v1/students', {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: '{not json',
    });
    expect(res.status).toBe(400);
    expect(ApiErrorSchema.parse(await res.json())).toMatchObject({
      error: { code: 'invalid_json' },
    });
  });

  it('answers validation failures with 400 and field details', async () => {
    const { headers } = await t.signInParent();
    const res = await t.app.request(
      '/v1/students',
      jsonRequest('POST', { nickname: '!', avatarCode: AVATAR, yearGroup: 10 }, headers),
    );
    const body = ApiErrorSchema.parse(await res.json());
    expect(body.error.code).toBe('invalid_request');
    expect(body.error.details?.some((line) => line.startsWith('nickname:'))).toBe(true);
  });

  it('hides internal errors behind a generic 500', async () => {
    const app = new Hono();
    app.get('/boom', () => {
      throw new Error('database password is hunter2');
    });
    app.onError(createErrorHandler({ log: () => {} }));
    const res = await app.request('/boom');
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(ApiErrorSchema.parse(body)).toEqual({
      error: {
        code: 'internal_error',
        message: 'Something went wrong',
        ref: expect.stringMatching(/^RD-/),
      },
    });
    expect(JSON.stringify(body)).not.toContain('hunter2');
  });

  it('returns sign-in errors in the same shape', async () => {
    const res = await t.app.request(
      '/api/auth/sign-in/social',
      jsonRequest('POST', { provider: 'myspace' }, { origin: 'https://dev.revisionden.test' }),
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    const body = ApiErrorSchema.parse(await res.json());
    expect(body.error.code).toMatch(/^[a-z_]+$/);
  });
});

describe('rate limits', () => {
  let t: TestContext;
  beforeAll(async () => {
    t = await createTestContext({ authLimit: 3, aiLimit: 2 });
  });
  afterAll(async () => {
    await t.close();
  });

  const fromIp = (ip: string) => ({ 'cf-connecting-ip': ip });

  it('answers 429 after too many sign-in requests from one address', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) {
      const res = await t.app.request('/api/auth/get-session', { headers: fromIp('198.51.100.1') });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 3)).not.toContain(429);
    expect(statuses[3]).toBe(429);
  });

  it('uses the shared error shape and a Retry-After header for 429', async () => {
    let res: Response | undefined;
    for (let i = 0; i < 4; i++) {
      res = await t.app.request('/api/auth/get-session', { headers: fromIp('198.51.100.2') });
    }
    expect(res!.status).toBe(429);
    expect(res!.headers.get('retry-after')).toBe('60');
    expect(ApiErrorSchema.parse(await res!.json())).toMatchObject({
      error: { code: 'rate_limited' },
    });
  });

  it('counts each address separately', async () => {
    for (let i = 0; i < 3; i++) {
      await t.app.request('/api/auth/get-session', { headers: fromIp('198.51.100.3') });
    }
    const other = await t.app.request('/api/auth/get-session', {
      headers: fromIp('198.51.100.4'),
    });
    expect(other.status).not.toBe(429);
  });

  it('limits the anonymous device-linking routes too', async () => {
    let last = 0;
    for (let i = 0; i < 4; i++) {
      last = (
        await t.app.request('/v1/device/unlock/options', {
          ...jsonRequest('POST', {}),
          headers: { 'content-type': 'application/json', ...fromIp('198.51.100.5') },
        })
      ).status;
    }
    expect(last).toBe(429);
  });

  it('limits AI routes with their own limit', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 3; i++) {
      statuses.push(
        (await t.app.request('/v1/ai/anything', { headers: fromIp('198.51.100.6') })).status,
      );
    }
    expect(statuses[2]).toBe(429);
  });

  it('opens the window again after a minute', async () => {
    for (let i = 0; i < 4; i++) {
      await t.app.request('/api/auth/get-session', { headers: fromIp('198.51.100.7') });
    }
    t.clock.advance(60_000);
    const res = await t.app.request('/api/auth/get-session', { headers: fromIp('198.51.100.7') });
    expect(res.status).not.toBe(429);
  });
});
