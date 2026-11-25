import { Hono, type Context, type Next } from 'hono';
import { cors } from 'hono/cors';
import type { Database } from '@revisionden/db';
import { AUTH_BASE_PATH, type Auth } from './auth';
import type { AppConfig } from './env';
import { ApiError, handleError, notFound, toSharedErrorShape, unauthorized } from './errors';
import type { PasskeyService } from './passkeys';
import { clientKey, RETRY_AFTER_SECONDS, type Clock, type RateLimiter } from './rate-limit';
import type { AppEnv } from './context';
import { ensureParent } from './families';
import { studentRoutes } from './routes/students';
import {
  deviceRoutes,
  parentDeviceRoutes,
  studentAuth,
  studentSessionRoutes,
} from './routes/devices';
import {
  parentNotificationRoutes,
  parentReminderRoutes,
  pushKeyRoutes,
  studentNotificationRoutes,
} from './notifications/routes';
import { createAiGateway } from './ai/gateway';
import { aiRoutes, parentAiUsageRoutes } from './ai/routes';
import type { AiProvider, ProviderName } from './ai/types';
import { reportRoutes } from './routes/quarantine';
import { reviewRoutes, type VerificationDeps } from './routes/review';
import { avatarRoutes, onboardingRoutes } from './routes/onboarding';
import { learnRoutes } from './routes/learn';
import { flashcardRoutes } from './routes/flashcards';
import { parentRewardRoutes, studentRewardRoutes } from './routes/rewards';
import type { MathsEngine } from './learning/maths-engine';
import {
  adminFeedbackRoutes,
  parentFeedbackRoutes,
  studentFeedbackRoutes,
} from './feedback/routes';
import { parentStatsRoutes, studentStatsRoutes } from './stats/routes';
import type { StatsAdapters } from './stats/adapters';

export interface AppDeps {
  version: string;
  config: AppConfig;
  db: Database;
  auth: Auth;
  clock: Clock;
  passkeys: PasskeyService;
  rateLimiters: { auth: RateLimiter; ai: RateLimiter };
  /** Review queue and quarantine hooks (workstream V). */
  verification?: VerificationDeps;
  /** AI providers that are configured (see ai/providers.ts). */
  aiProviders: Partial<Record<ProviderName, AiProvider>>;
  /** Backoff wait between AI retries; tests pass one that returns at once. */
  sleep?: (ms: number) => Promise<void>;
  /** Checks worked maths answers; without it, those answers get a 503. */
  mathsEngine?: MathsEngine;
  /** Sources for dashboard panels owned by other workstreams; unset ones show "Not set up yet". */
  statsAdapters?: Partial<StatsAdapters>;
}

export function createApp(deps: AppDeps) {
  const app = new Hono<AppEnv>();
  const gateway = createAiGateway({
    db: deps.db,
    clock: deps.clock,
    config: deps.config.ai,
    providers: deps.aiProviders,
    sleep: deps.sleep,
  });

  app.use(
    '*',
    cors({
      origin: (origin) => (origin === deps.config.webOrigin ? origin : null),
      credentials: true,
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['content-type'],
    }),
  );

  const limit = (scope: string, limiter: RateLimiter) => async (c: Context, next: Next) => {
    const { success } = await limiter.limit({ key: `${scope}:${clientKey(c.req.raw.headers)}` });
    if (!success) {
      c.header('Retry-After', String(RETRY_AFTER_SECONDS));
      throw new ApiError(429, 'rate_limited', 'Too many requests. Please wait a minute.');
    }
    await next();
  };
  app.use(`${AUTH_BASE_PATH}/*`, limit('auth', deps.rateLimiters.auth));
  app.use('/v1/device/*', limit('auth', deps.rateLimiters.auth));
  app.use('/v1/ai/*', limit('ai', deps.rateLimiters.ai));

  app.on(['GET', 'POST'], `${AUTH_BASE_PATH}/*`, async (c) =>
    toSharedErrorShape(await deps.auth.handler(c.req.raw)),
  );

  app.get('/health', (c) => c.json({ status: 'ok', version: deps.version }));

  // Parent routes: a Better Auth session is required, and the family is created on first use.
  const parent = new Hono<AppEnv>();
  parent.use('/me', requireParent);
  parent.use('/students/*', requireParent);
  parent.use('/items/*', requireParent);
  parent.use('/review/*', requireParent);
  parent.use('/onboarding/*', requireParent);
  parent.use('/feedback', requireParent);
  parent.use('/policy-acceptances', requireParent);
  parent.use('/admin/*', requireParent);
  parent.use('/parent/*', requireParent);
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
  parent.route('/students', parentReminderRoutes(deps));
  parent.route('/students', parentAiUsageRoutes({ ...deps, gateway }));
  parent.route('/students', avatarRoutes(deps));
  parent.route('/students', parentRewardRoutes(deps));
  parent.route('/students', parentStatsRoutes(deps));
  parent.route('/onboarding', onboardingRoutes(deps));
  parent.route('/', reportRoutes(deps.db, 'parent'));
  parent.route('/', parentFeedbackRoutes(deps));
  parent.route('/admin', adminFeedbackRoutes(deps));
  parent.route('/parent', parentNotificationRoutes(deps));
  parent.route(
    '/review',
    reviewRoutes(deps.db, { ...deps.verification, now: () => deps.clock.now() }),
  );

  app.route('/v1/device', deviceRoutes(deps));
  app.route('/v1/notifications', pushKeyRoutes(deps));
  // Student routes: the session middleware runs before every /v1/student route below.
  app.use('/v1/student/*', studentAuth(deps));
  app.route('/v1/student', studentNotificationRoutes(deps));
  app.route('/v1/student', studentSessionRoutes(deps));
  // Mounted after the student routes, so their session check runs first.
  app.route('/v1/student/learn', learnRoutes(deps));
  app.route('/v1/student/flashcards', flashcardRoutes(deps));
  app.route('/v1/student', reportRoutes(deps.db, 'student'));
  app.route('/v1/student/rewards', studentRewardRoutes(deps));
  app.route('/v1/student', studentFeedbackRoutes(deps));
  app.route('/v1/student', studentStatsRoutes(deps));
  app.use('/v1/ai/*', studentAuth(deps));
  app.route('/v1/ai', aiRoutes({ ...deps, gateway }));
  app.route('/v1', parent);

  app.notFound(() => {
    throw notFound();
  });
  app.onError(handleError);
  return app;
}
