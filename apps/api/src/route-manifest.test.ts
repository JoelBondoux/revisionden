import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { listRoutes, ROUTE_MANIFEST_NOTE } from './route-manifest';
import { createTestContext, type TestContext } from './test/helpers';

const manifestPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'routes.json');

describe('listRoutes', () => {
  it('lists each method and path once, sorted, leaving out middleware', () => {
    const app = new Hono();
    app.use('/v1/*', async (_c, next) => next());
    app.post('/v1/b', (c) => c.text('b'));
    app.get('/v1/a/:id', (c) => c.text('a'));
    app.get('/v1/a/:id', (c) => c.text('again'));
    expect(listRoutes(app)).toEqual(['GET /v1/a/:id', 'POST /v1/b']);
  });
});

describe('routes.json (the real API routes, read by the web app tests)', () => {
  let t: TestContext;
  beforeAll(async () => {
    t = await createTestContext();
  });
  afterAll(async () => {
    await t.close();
  });

  it('matches the routes the app really mounts (UPDATE_ROUTES=1 to refresh it)', () => {
    const routes = listRoutes(t.app);
    if (process.env.UPDATE_ROUTES) {
      writeFileSync(
        manifestPath,
        `${JSON.stringify({ note: ROUTE_MANIFEST_NOTE, routes }, null, 2)}\n`,
      );
    }
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { routes: string[] };
    expect(manifest.routes).toEqual(routes);
  });

  it('includes the parent family list the "Who\'s revising?" page reads', () => {
    expect(listRoutes(t.app)).toContain('GET /v1/onboarding/family');
  });
});
