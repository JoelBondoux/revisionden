import { Hono, type Context, type Next } from 'hono';
import { cors } from 'hono/cors';
import { eq } from 'drizzle-orm';
import { parentRemovalNotices, type Database } from '@revisionden/db';
import { AUTH_BASE_PATH, type Auth } from './auth';
import type { AppConfig } from './env';
import { ClientErrorReportSchema } from '@revisionden/core';
import { ApiError, createErrorReporting, notFound, unauthorized, type ErrorLog } from './errors';
import { readJson } from './http';
import type { PasskeyService } from './passkeys';
import { clientKey, RETRY_AFTER_SECONDS, type Clock, type RateLimiter } from './rate-limit';
import type { AppEnv } from './context';
import { ensureParent } from './families';
import { studentRoutes } from './routes/students';
import { familyRoutes, recordActivity, studentActivity } from './routes/family';
import { familyExport } from './routes/export';
import { familyParentRoutes, removalNotice, removedFromFamily } from './routes/family-parents';
import { logFamilyChanges } from './family-events';
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
import { studentDailyRoutes } from './routes/daily';
import { studentMapRoutes } from './routes/map';
import { studentRecallRoutes } from './routes/recall';
import { parentRewardRoutes, studentRewardRoutes } from './routes/rewards';
import type { MathsEngine } from './learning/maths-engine';
import {
  adminFeedbackRoutes,
  parentBugHunterRoutes,
  parentFeedbackRoutes,
  studentFeedbackRoutes,
} from './feedback/routes';
import { parentStatsRoutes, studentStatsRoutes } from './stats/routes';
import { parentDailyLimitRoutes, studentDailyLimitRoutes } from './daily-limit/routes';
import { adminErrorReportRoutes, errorReportRoutes } from './feedback/error-reports';
import type { StatsAdapters } from './stats/adapters';
import { OPERATOR_BASE_PATH, operatorRoutes } from './operator/routes';
import { createMemoryRateLimiter } from './rate-limit';

export interface AppDeps {
  version: string;
  config: AppConfig;
  db: Database;
  auth: Auth;
  clock: Clock;
  passkeys: PasskeyService;
  /** `operator` (AppDeck bridge) defaults to 120 a minute in memory when not given. */
  rateLimiters: {
    auth: RateLimiter;
    ai: RateLimiter;
    operator?: RateLimiter;
    /** Short-code attempts at /link; falls back to `auth` with its own key. */
    linkCode?: RateLimiter;
  };
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
  /** Randomness for error reference codes; tests pass a fixed one. */
  random?: () => number;
  /** Where error reference lines go (Workers logs by default). */
  errorLog?: ErrorLog;
}

/** AppDeck operator requests allowed a minute from one address. */
export const OPERATOR_REQUESTS_PER_MINUTE = 120;

export function createApp(deps: AppDeps) {
  const app = new Hono<AppEnv>();
  const reporting = createErrorReporting({ random: deps.random, log: deps.errorLog });
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
  // Joining a family with a code is rate-limited like sign-in, so codes cannot be guessed.
  app.use('/v1/family/join', limit('auth', deps.rateLimiters.auth));
  app.use('/v1/ai/*', limit('ai', deps.rateLimiters.ai));
  app.use('/v1/client-errors', limit('auth', deps.rateLimiters.auth));
  app.use('/v1/error-reports', limit('auth', deps.rateLimiters.auth));

  app.on(['GET', 'POST'], `${AUTH_BASE_PATH}/*`, async (c) =>
    reporting.toSharedErrorShape(await deps.auth.handler(c.req.raw), c),
  );

  app.get('/health', (c) => c.json({ status: 'ok', version: deps.version }));
  // Public: which sign-in buttons the web app should show.
  app.get('/v1/auth/providers', (c) => c.json({ providers: deps.config.signInProviders }));
  // Public: the web app reports an error it showed with a reference code (no personal data).
  app.post('/v1/client-errors', async (c) => {
    const report = await readJson(c, ClientErrorReportSchema);
    (deps.errorLog ?? ((line) => console.warn(JSON.stringify(line))))({ source: 'web', ...report });
    return c.body(null, 204);
  });

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
  parent.use('/family/*', requireParent);
  parent.use('/export', requireParent);
  async function requireParent(c: Context<AppEnv>, next: Next) {
    const session = await deps.auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) throw unauthorized();
    // A parent the other parent removed loses access at once (routes/family-parents.ts).
    const removed = await removalNotice(deps.db, session.user.id);
    if (removed) throw removedFromFamily(removed.removedAt);
    const ctx = await ensureParent(deps.db, session.user.id);
    // Keeps the account from being deleted as unused (routes/family.ts).
    await recordActivity(deps.db, ctx.familyId, deps.clock.now());
    c.set('parent', ctx);
    c.set('parentEmail', session.user.email);
    await next();
  }
  // Logs every successful family change for the activity log (runs after the guard above).
  parent.use('*', logFamilyChanges(deps));
  // The notice a removed parent sees once; only a sign-in is needed, not a family.
  parent.get('/removal-notice', async (c) => {
    const session = await deps.auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) throw unauthorized();
    const notice = await removalNotice(deps.db, session.user.id);
    return c.json(
      notice ? { removed: true, removedAt: notice.removedAt.toISOString() } : { removed: false },
    );
  });
  parent.post('/removal-notice/seen', async (c) => {
    const session = await deps.auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) throw unauthorized();
    await deps.db
      .delete(parentRemovalNotices)
      .where(eq(parentRemovalNotices.authUserId, session.user.id));
    return c.body(null, 204);
  });
  parent.get('/me', (c) => c.json({ familyId: c.var.parent.familyId, email: c.var.parentEmail }));
  parent.route('/students', studentRoutes(deps.db));
  parent.route('/students', parentDeviceRoutes(deps));
  parent.route('/students', parentReminderRoutes(deps));
  parent.route('/students', parentAiUsageRoutes({ ...deps, gateway }));
  parent.route('/students', avatarRoutes(deps));
  parent.route('/students', parentRewardRoutes(deps));
  parent.route('/students', parentStatsRoutes(deps));
  parent.route('/students', parentDailyLimitRoutes(deps));
  parent.route('/onboarding', onboardingRoutes(deps));
  parent.route('/', reportRoutes(deps.db, 'parent'));
  parent.route('/', parentFeedbackRoutes(deps));
  parent.route('/students', parentBugHunterRoutes(deps));
  parent.route('/family', familyRoutes(deps));
  parent.route('/family', familyParentRoutes(deps));
  parent.route('/', familyExport(deps));
  parent.route('/admin', adminFeedbackRoutes(deps));
  parent.route('/admin', adminErrorReportRoutes(deps));
  parent.route('/parent', parentNotificationRoutes(deps));
  parent.route(
    '/review',
    reviewRoutes(deps.db, { ...deps.verification, now: () => deps.clock.now() }),
  );

  app.route('/v1/error-reports', errorReportRoutes(deps));
  // Operator bridge (AppDeck): signed requests only; 404 when no shared secret is set.
  app.route(
    OPERATOR_BASE_PATH,
    operatorRoutes({
      ...deps,
      rateLimiter:
        deps.rateLimiters.operator ??
        createMemoryRateLimiter({
          limit: OPERATOR_REQUESTS_PER_MINUTE,
          periodMs: 60_000,
          clock: deps.clock,
        }),
    }),
  );
  app.route('/v1/device', deviceRoutes(deps));
  app.route('/v1/notifications', pushKeyRoutes(deps));
  // Student routes: the session middleware runs before every /v1/student route below.
  app.use('/v1/student/*', studentAuth(deps));
  app.use('/v1/student/*', studentActivity(deps));
  app.route('/v1/student', studentNotificationRoutes(deps));
  app.route('/v1/student', studentSessionRoutes(deps));
  // Mounted after the student routes, so their session check runs first.
  app.route('/v1/student/learn', learnRoutes(deps));
  app.route('/v1/student/flashcards', flashcardRoutes(deps));
  app.route('/v1/student', studentMapRoutes(deps));
  app.route('/v1/student', studentDailyRoutes(deps));
  app.route('/v1/student', studentRecallRoutes(deps));
  app.route('/v1/student', reportRoutes(deps.db, 'student'));
  app.route('/v1/student/rewards', studentRewardRoutes(deps));
  app.route('/v1/student', studentFeedbackRoutes(deps));
  app.route('/v1/student', studentStatsRoutes(deps));
  app.route('/v1/student', studentDailyLimitRoutes(deps));
  app.use('/v1/ai/*', studentAuth(deps));
  app.route('/v1/ai', aiRoutes({ ...deps, gateway }));
  app.route('/v1', parent);

  app.notFound(() => {
    throw notFound();
  });
  app.onError(reporting.onError);
  return app;
}
