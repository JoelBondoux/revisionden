import { Hono } from 'hono';
import type { Database } from '@revisionden/db';
import type { AppEnv } from '../context';
import type { AppConfig } from '../env';
import type { Clock, RateLimiter } from '../rate-limit';
import { ok, operatorAuth } from './bridge';

export interface OperatorRouteDeps {
  version: string;
  db: Database;
  clock: Clock;
  config: AppConfig;
  rateLimiter: RateLimiter;
}

/** `/operator/appdeck/*`: the signed bridge AppDeck calls (`docs/OPERATOR_CONSOLE.md`). */
export function operatorRoutes(deps: OperatorRouteDeps) {
  const app = new Hono<AppEnv>();
  app.use('*', operatorAuth(deps));

  // Connection check for AppDeck: which environment and build it reached, and as whom.
  app.get('/health', (c) =>
    ok(c, {
      status: 'ok',
      environment: deps.config.environment,
      version: deps.version,
      operator: { email: c.var.operator.email, role: c.var.operator.role },
    }),
  );

  return app;
}
