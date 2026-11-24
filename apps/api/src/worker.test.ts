import { describe, expect, it } from 'vitest';
import { createWorker } from './worker';

const ctx = { waitUntil: () => undefined, passThroughOnException: () => undefined } as never;

describe('worker entry', () => {
  it('fails fast with a JSON 500 when bindings are missing', async () => {
    const worker = createWorker('00.01.000');
    const res = await worker.fetch(new Request('https://api.test/health'), {}, ctx);
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: { code: 'server_misconfigured' } });
  });

  it('serves health once the environment is complete', async () => {
    const worker = createWorker('00.01.000');
    const env = {
      ENVIRONMENT: 'development',
      DATABASE_URL: 'postgres://user:pass@db.example.com/revisionden',
      BETTER_AUTH_SECRET: 'x'.repeat(32),
      API_ORIGIN: 'https://api-dev.revisionden.test',
      WEB_ORIGIN: 'https://dev.revisionden.test',
      GOOGLE_CLIENT_ID: 'g',
      GOOGLE_CLIENT_SECRET: 'g',
      MICROSOFT_CLIENT_ID: 'm',
      MICROSOFT_CLIENT_SECRET: 'm',
      AI_GATEWAY_URL: 'https://gateway.example.com/v1/x',
      UPLOADS: {},
    };
    const res = await worker.fetch(new Request('https://api.test/health'), env, ctx);
    expect(await res.json()).toEqual({ status: 'ok', version: '00.01.000' });
    // Same env object: the app is reused rather than rebuilt.
    const again = await worker.fetch(new Request('https://api.test/health'), env, ctx);
    expect(again.status).toBe(200);
  });
});
