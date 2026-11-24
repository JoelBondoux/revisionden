import { Hono, type Context, type Next } from 'hono';
import { cors } from 'hono/cors';
import type { Database } from '@revisionden/db';
import { AUTH_BASE_PATH, type Auth } from './auth';
import type { AppConfig } from './env';
import { handleError, notFound, unauthorized } from './errors';
import type { PasskeyService } from './passkeys';
import type { Clock, RateLimiter } from './rate-limit';
import type { AppEnv } from './context';
import { ensureParent } from './families';
import { studentRoutes } from './routes/students';
import { deviceRoutes, parentDeviceRoutes, studentSessionRoutes } from './routes/devices';

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
  const app = new Hono<AppEnv>();

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

  // Parent routes: a Better Auth session is required, and the family is created on first use.
  const parent = new Hono<AppEnv>();
  parent.use('/me', requireParent);
  parent.use('/students/*', requireParent);
  async function requireParent(c: Context<AppEnv>, next: Next) {
    const session = await deps.auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) throw unauthorized();
    c.set('parent', await ensureParent(deps.db, session.user.id));
    c.set('parentEmail', session.user.email);
    await next();
  }
  parent.get('/me', (c) => c.json({ familyId: c.var.parent.familyId, email: c.var.parentEmail }));
  parent.route('/students', studentRoutes(deps.db));
  parent.route('/students', parentDeviceRoutes(deps));

  app.route('/v1/device', deviceRoutes(deps));
  app.route('/v1/student', studentSessionRoutes(deps));
  app.route('/v1', parent);

  app.notFound(() => {
    throw notFound();
  });
  app.onError(handleError);
  return app;
}
