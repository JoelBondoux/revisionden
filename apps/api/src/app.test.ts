import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { errorBodySchema } from './errors';
import { createTestContext, type TestContext } from './test/helpers';

let t: TestContext;

beforeAll(async () => {
  t = await createTestContext();
});

afterAll(async () => {
  await t.close();
});

describe('API', () => {
  it('reports health with the running version', async () => {
    const res = await t.app.request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', version: '00.01.000' });
  });

  it('returns a JSON 404 in the shared error shape for unknown routes', async () => {
    const res = await t.app.request('/nope');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(errorBodySchema.parse(body)).toEqual({ error: 'not_found', message: 'Not found' });
  });

  it('rejects anonymous requests to parent routes with 401', async () => {
    const res = await t.app.request('/v1/me');
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'unauthorized' });
  });

  it('lets the web app call the API with cookies (CORS for the web origin only)', async () => {
    const res = await t.app.request('/health', {
      headers: { origin: 'https://dev.revisionden.test' },
    });
    expect(res.headers.get('access-control-allow-origin')).toBe('https://dev.revisionden.test');
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');

    const other = await t.app.request('/health', { headers: { origin: 'https://evil.test' } });
    expect(other.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('routing', () => {
  it('answers 404, not 401, for unknown routes under /v1', async () => {
    const res = await t.app.request('/v1/unknown');
    expect(res.status).toBe(404);
  });
});
