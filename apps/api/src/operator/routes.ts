import { Hono } from 'hono';
import type { Database } from '@revisionden/db';
import type { AppEnv } from '../context';
import type { AppConfig } from '../env';
import type { Clock, RateLimiter } from '../rate-limit';
import { operatorAuth } from './bridge';
import { OPERATOR_READ_POSTS, operatorReadRoutes } from './reads';
import { operatorActionRoutes } from './actions';
import { operatorDataRequestRoutes } from './data-requests';
import { operatorDiscountCodeRoutes } from './discount-codes';

export interface OperatorRouteDeps {
  version: string;
  db: Database;
  clock: Clock;
  config: AppConfig;
  rateLimiter: RateLimiter;
}

/** Where the bridge is mounted (`app.ts`). */
export const OPERATOR_BASE_PATH = '/operator/appdeck';

/** `/operator/appdeck/*`: the signed bridge AppDeck calls (`docs/OPERATOR_CONSOLE.md`). */
export function operatorRoutes(deps: OperatorRouteDeps) {
  const app = new Hono<AppEnv>();
  app.use(
    '*',
    operatorAuth({
      ...deps,
      readPosts: OPERATOR_READ_POSTS.map((p) => `${OPERATOR_BASE_PATH}${p}`),
    }),
  );

  app.route('/', operatorReadRoutes(deps));
  app.route('/', operatorActionRoutes(deps));
  app.route('/', operatorDataRequestRoutes(deps));
  app.route('/', operatorDiscountCodeRoutes(deps));

  return app;
}
