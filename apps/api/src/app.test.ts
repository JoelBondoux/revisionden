import { describe, expect, it } from 'vitest';
import { createApp } from './app';

describe('API', () => {
  it('reports health with the running version', async () => {
    const res = await createApp({ version: '00.01.000' }).request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', version: '00.01.000' });
  });

  it('returns JSON 404 for unknown routes', async () => {
    const res = await createApp({ version: '00.01.000' }).request('/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });
});
