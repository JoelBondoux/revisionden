import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { ApiErrorSchema, ErrorRefSchema } from '@revisionden/core';
import { createErrorHandler } from './errors';
import { createTestContext, jsonRequest, type TestContext } from './test/helpers';

type Line = Record<string, unknown>;

describe('error reference codes', () => {
  let t: TestContext;
  const logged: Line[] = [];
  beforeAll(async () => {
    t = await createTestContext({ errorLog: (line) => logged.push(line) });
  });
  afterAll(async () => {
    await t.close();
  });

  it('gives an unknown route a reference code and logs it with a masked path', async () => {
    const res = await t.app.request('/students/3f2b1c9e-1111-4a2b-9c3d-123456789abc/map');
    expect(res.status).toBe(404);
    const body = ApiErrorSchema.parse(await res.json());
    const ref = ErrorRefSchema.parse(body.error.ref);
    expect(logged.at(-1)).toEqual({
      ref,
      status: 404,
      code: 'not_found',
      method: 'GET',
      path: '/students/:id/map',
    });
  });

  it('gives a signed-out parent request a reference code too', async () => {
    const res = await t.app.request('/v1/onboarding/family');
    expect(res.status).toBe(401);
    const body = ApiErrorSchema.parse(await res.json());
    expect(body.error.ref).toBe(logged.at(-1)?.ref);
  });

  it('gives sign-in errors a reference code', async () => {
    const res = await t.app.request(
      '/api/auth/sign-in/social',
      jsonRequest('POST', { provider: 'myspace' }, { origin: 'https://dev.revisionden.test' }),
    );
    const body = ApiErrorSchema.parse(await res.json());
    expect(ErrorRefSchema.safeParse(body.error.ref).success).toBe(true);
    expect(logged.at(-1)).toMatchObject({ ref: body.error.ref, path: '/api/auth/sign-in/social' });
  });

  it('logs a crash with its reference and error type but not its message', async () => {
    const lines: Line[] = [];
    const app = new Hono();
    app.get('/v1/students/:id', () => {
      throw new TypeError('nickname test_kid_7 could not be saved');
    });
    app.onError(createErrorHandler({ random: () => 0, log: (line) => lines.push(line) }));
    const res = await app.request('/v1/students/abc123');
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: { code: 'internal_error', message: 'Something went wrong', ref: 'RD-000000' },
    });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      ref: 'RD-000000',
      status: 500,
      method: 'GET',
      path: '/v1/students/:id',
      error: 'TypeError',
    });
    expect(JSON.stringify(lines)).not.toContain('test_kid_7');
  });
});

describe('POST /v1/client-errors', () => {
  let t: TestContext;
  const logged: Line[] = [];
  beforeAll(async () => {
    t = await createTestContext({ errorLog: (line) => logged.push(line) });
  });
  afterAll(async () => {
    await t.close();
  });

  it('logs a web app error report without signing in', async () => {
    const report = { ref: 'RD-7K2M9Q', kind: 'schema', status: 200, path: '/v1/student/map' };
    const res = await t.app.request('/v1/client-errors', jsonRequest('POST', report));
    expect(res.status).toBe(204);
    expect(logged.at(-1)).toEqual({ source: 'web', ...report });
  });

  it("logs a phone's failed passkey set-up with the browser error name only (E8)", async () => {
    const report = { ref: 'RD-7K2M9Q', kind: 'passkey', path: '/link', code: 'NotAllowedError' };
    const res = await t.app.request('/v1/client-errors', jsonRequest('POST', report));
    expect(res.status).toBe(204);
    expect(logged.at(-1)).toEqual({ source: 'web', ...report });
  });

  it('refuses a report with free text in it', async () => {
    const before = logged.length;
    const res = await t.app.request(
      '/v1/client-errors',
      jsonRequest('POST', { ref: 'RD-7K2M9Q', kind: 'http', path: '/v1/x', note: 'sam' }),
    );
    expect(res.status).toBe(400);
    expect(logged.slice(before).some((line) => line.source === 'web')).toBe(false);
  });
});

describe('client error reports are rate limited', () => {
  it('answers 429 after 30 a minute from one address', async () => {
    const t = await createTestContext({ authLimit: 2, errorLog: () => {} });
    const send = () =>
      t.app.request(
        '/v1/client-errors',
        jsonRequest(
          'POST',
          { ref: 'RD-7K2M9Q', kind: 'http', path: '/v1/x' },
          { 'cf-connecting-ip': '203.0.113.9' },
        ),
      );
    expect((await send()).status).toBe(204);
    expect((await send()).status).toBe(204);
    expect((await send()).status).toBe(429);
    await t.close();
  });
});
