import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Database } from '@revisionden/db';
import { AUTH_BASE_PATH, type Auth } from './auth';
import type { AppConfig } from './env';
import { handleError, notFound, unauthorized } from './errors';
import type { PasskeyService } from './passkeys';
import type { Clock, RateLimiter } from './rate-limit';

export interface AppDeps {
  version: string;
  config: AppConfig;
  db: Database;
  auth: Auth;
  clock: Clock;
  passkeys: PasskeyService;
  rateLimiters: { auth: RateLimiter; ai: RateLimiter };
}

export function createApp(deps: AppDeps) {
  const app = new Hono();

  app.use(
    '*',
    cors({
      origin: (origin) => (origin === deps.config.webOrigin ? origin : null),
      credentials: true,
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['content-type'],
    }),
  );

  app.on(['GET', 'POST'], `${AUTH_BASE_PATH}/*`, (c) => deps.auth.handler(c.req.raw));

  app.get('/health', (c) => c.json({ status: 'ok', version: deps.version }));

  app.get('/v1/me', async (c) => {
    const session = await deps.auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) throw unauthorized();
    return c.json({ email: session.user.email });
  });

  app.notFound(() => {
    throw notFound();
  });
  app.onError(handleError);
  return app;
}
