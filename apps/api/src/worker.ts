import { createNeonDatabase } from '@revisionden/db';
import { createApp } from './app';
import { createAuth } from './auth';
import { parseEnv } from './env';
import { errorBody } from './errors';
import { createPasskeyService } from './passkeys';
import { createMemoryRateLimiter } from './rate-limit';

const systemClock = { now: () => new Date() };

type App = ReturnType<typeof createApp>;

/**
 * Builds the app from the Worker environment. Validation runs first, so a missing secret or
 * binding fails on the first request with a clear message instead of deep inside a handler.
 */
export function createWorker(version: string) {
  let cached: { env: unknown; app: App } | undefined;

  function appFor(env: Record<string, unknown>): App {
    if (cached?.env === env) return cached.app;
    const config = parseEnv(env);
    const db = createNeonDatabase(config.databaseUrl);
    const app = createApp({
      version,
      config,
      db,
      auth: createAuth({ db, config }),
      clock: systemClock,
      passkeys: createPasskeyService(config),
      rateLimiters: {
        auth:
          config.raw.AUTH_RATE_LIMITER ??
          createMemoryRateLimiter({ limit: 30, periodMs: 60_000, clock: systemClock }),
        ai:
          config.raw.AI_RATE_LIMITER ??
          createMemoryRateLimiter({ limit: 20, periodMs: 60_000, clock: systemClock }),
      },
    });
    cached = { env, app };
    return app;
  }

  return {
    fetch(request: Request, env: Record<string, unknown>, ctx: ExecutionContext) {
      let app: App;
      try {
        app = appFor(env);
      } catch (err) {
        console.error((err as Error).message);
        return Response.json(
          errorBody('server_misconfigured', 'The server is not configured correctly'),
          { status: 500 },
        );
      }
      return app.fetch(request, env, ctx);
    },
  };
}
