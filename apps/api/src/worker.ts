import { createNeonDatabase, type Database } from '@revisionden/db';
import { createApp } from './app';
import { createAuth } from './auth';
import { parseEnv } from './env';
import { makeErrorRef } from '@revisionden/core';
import { errorBody } from './errors';
import { createPasskeyService } from './passkeys';
import { createMathsEngineClient } from './learning/maths-engine';
import { createMemoryRateLimiter } from './rate-limit';
import { runReminders as defaultRunReminders } from './notifications/runner';
import { runParentRewardNotifications as defaultRunParentRewards } from './notifications/parent-rewards';
import { createWebPushSender } from './notifications/web-push';
import { runFamilyEventNotifications as defaultRunFamilyEvents } from './family-events';
import { createProviders } from './ai/providers';
import { cleanUpExpiredData as defaultCleanUp } from './cleanup';
import { CLEANUP_CRON, REMINDER_CRONS } from './crons';

const systemClock = { now: () => new Date() };

type App = ReturnType<typeof createApp>;

/**
 * Builds the app from the Worker environment. Validation runs first, so a missing secret or
 * binding fails on the first request with a clear message instead of deep inside a handler.
 */
export interface WorkerOptions {
  /** Injected in tests; defaults to the real reminder runner. */
  runReminders?: typeof defaultRunReminders;
  /** Injected in tests; defaults to telling parents about met parent-set reward targets. */
  runParentRewardNotifications?: typeof defaultRunParentRewards;
  /** Injected in tests; defaults to telling a parent about the other parent's important changes. */
  runFamilyEventNotifications?: typeof defaultRunFamilyEvents;
  /** Injected in tests; defaults to deleting data past its retention period (cleanup.ts). */
  cleanUp?: (deps: { db: Database; now: Date }) => Promise<Record<string, number>>;
}

export function createWorker(version: string, options: WorkerOptions = {}) {
  const runReminders = options.runReminders ?? defaultRunReminders;
  const runParentRewards = options.runParentRewardNotifications ?? defaultRunParentRewards;
  const runFamilyEvents = options.runFamilyEventNotifications ?? defaultRunFamilyEvents;
  const cleanUp = options.cleanUp ?? defaultCleanUp;
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
      ...(config.mathsEngineUrl
        ? { mathsEngine: createMathsEngineClient(config.mathsEngineUrl) }
        : {}),
      rateLimiters: {
        auth:
          config.raw.AUTH_RATE_LIMITER ??
          createMemoryRateLimiter({ limit: 30, periodMs: 60_000, clock: systemClock }),
        ai:
          config.raw.AI_RATE_LIMITER ??
          createMemoryRateLimiter({ limit: 20, periodMs: 60_000, clock: systemClock }),
        ...(config.raw.OPERATOR_RATE_LIMITER ? { operator: config.raw.OPERATOR_RATE_LIMITER } : {}),
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
        const ref = makeErrorRef(Math.random);
        // The message names missing settings only, never a value.
        console.error(JSON.stringify({ ref, status: 500, code: 'server_misconfigured' }));
        console.error((err as Error).message);
        // The deploy check reads the version even before every secret is set.
        if (new URL(request.url).pathname === '/health') {
          return Response.json({ status: 'misconfigured', version }, { status: 503 });
        }
        return Response.json(
          errorBody(
            'server_misconfigured',
            'The server is not configured correctly',
            undefined,
            ref,
          ),
          { status: 500 },
        );
      }
      return app.fetch(request, env, ctx);
    },

    /**
     * Cron trigger (schedules in crons.ts and wrangler.toml; all UTC).
     * - The daily clean-up tick deletes data past its retention period (expired link codes,
     *   sessions and challenges; feedback 12 months after closing; families unused for 12
     *   months) and does nothing else.
     * - A reminder tick sends due reminders, then tells parents about parent-set reward targets
     *   met and about the other parent's important changes. Until web push is configured it
     *   returns without opening the database.
     * - An unknown schedule (for example wrangler dev --test-scheduled) does everything.
     * Neon suspends an idle database after 5 minutes, so each tick that opens it wakes it.
     */
    async scheduled(
      controller: Pick<ScheduledController, 'scheduledTime'> & { cron?: string },
      env: Record<string, unknown>,
    ): Promise<void> {
      let config: ReturnType<typeof parseEnv>;
      try {
        config = parseEnv(env);
      } catch (err) {
        console.error((err as Error).message);
        return;
      }
      const now = new Date(controller.scheduledTime);
      const isCleanUpTick = controller.cron === CLEANUP_CRON;
      const isReminderTick = (REMINDER_CRONS as readonly (string | undefined)[]).includes(
        controller.cron,
      );
      const doCleanUp = isCleanUpTick || !isReminderTick;
      const doReminders = (isReminderTick || !isCleanUpTick) && config.push !== null;
      if (!doCleanUp && !doReminders) return;
      const db = createNeonDatabase(config.databaseUrl);
      if (doCleanUp) console.log('clean-up', JSON.stringify(await cleanUp({ db, now })));
      if (!config.push || !doReminders) return;
      const sender = createWebPushSender({
        keys: config.push.keys,
        subject: config.webOrigin,
        clock: { now: () => new Date() },
      });
      const summary = await runReminders({ db, now, sender });
      console.log('reminders', JSON.stringify(summary));
      // Parent news (H2) is separate from the child reminders and their 2-a-day limit.
      console.log('parent-rewards', JSON.stringify(await runParentRewards({ db, now, sender })));
      // Two parents (B3): important changes by one parent are pushed to the other.
      console.log('family-events', JSON.stringify(await runFamilyEvents({ db, now, sender })));
    },
  };
}
