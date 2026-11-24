import { createNeonDatabase } from '@revisionden/db';
import { createApp } from './app';
import { createAuth } from './auth';
import { parseEnv } from './env';
import { errorBody } from './errors';
import { createPasskeyService } from './passkeys';
import { createMemoryRateLimiter } from './rate-limit';
import { runReminders as defaultRunReminders } from './notifications/runner';
import { createWebPushSender } from './notifications/web-push';
import { createProviders } from './ai/providers';

const systemClock = { now: () => new Date() };

type App = ReturnType<typeof createApp>;

/**
 * Builds the app from the Worker environment. Validation runs first, so a missing secret or
 * binding fails on the first request with a clear message instead of deep inside a handler.
 */
export interface WorkerOptions {
  /** Injected in tests; defaults to the real reminder runner. */
  runReminders?: typeof defaultRunReminders;
}

export function createWorker(version: string, options: WorkerOptions = {}) {
  const runReminders = options.runReminders ?? defaultRunReminders;
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
      aiProviders: createProviders(config),
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

    /** Cron trigger (every 15 minutes, see wrangler.toml): sends due reminders. */
    async scheduled(
      controller: Pick<ScheduledController, 'scheduledTime'>,
      env: Record<string, unknown>,
    ): Promise<void> {
      let config: ReturnType<typeof parseEnv>;
      try {
        config = parseEnv(env);
      } catch (err) {
        console.error((err as Error).message);
        return;
      }
      if (!config.push) return;
      const now = new Date(controller.scheduledTime);
      const summary = await runReminders({
        db: createNeonDatabase(config.databaseUrl),
        now,
        sender: createWebPushSender({
          keys: config.push.keys,
          subject: config.webOrigin,
          clock: { now: () => new Date() },
        }),
      });
      console.log('reminders', JSON.stringify(summary));
    },
  };
}
