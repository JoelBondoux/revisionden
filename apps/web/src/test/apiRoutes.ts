import { HttpHandler, type RequestHandler } from 'msw';
import manifest from '../../../api/routes.json';

/**
 * The real API routes ("METHOD /path"), generated from the Hono app in `apps/api`
 * (`apps/api/src/route-manifest.test.ts`). Mock handlers must use these exact paths, so a web
 * test can never pass against a route the API does not have.
 */
export const REAL_API_ROUTES: readonly string[] = manifest.routes;

/**
 * Routes another workstream has agreed but not merged yet. Workstream F2 adds the topic map and
 * cards-due endpoints for the student device. Remove a line as soon as the route is real.
 */
export const PENDING_ROUTES: readonly string[] = [
  'GET /v1/student/map',
  'GET /v1/student/cards/due',
];

const segments = (path: string) =>
  path
    .split('/')
    .filter(Boolean)
    .map((s) => (s.startsWith(':') ? ':' : s));

function pathMatches(mockPath: string, routePath: string): boolean {
  const mock = segments(mockPath);
  const route = segments(routePath);
  if (route.at(-1) === '*') {
    const prefix = route.slice(0, -1);
    return mock.length > prefix.length && prefix.every((s, i) => s === ':' || s === mock[i]);
  }
  // A route parameter matches any segment, so a mock may use a concrete id.
  return mock.length === route.length && route.every((s, i) => s === ':' || s === mock[i]);
}

/** True when "METHOD /path" is one of the routes (parameter names may differ). */
export function isRealRoute(route: string, routes: readonly string[]): boolean {
  const [method, path = ''] = route.split(' ');
  return routes.some((real) => {
    const [realMethod, realPath = ''] = real.split(' ');
    return realMethod === method && pathMatches(path, realPath);
  });
}

/** "METHOD /path" for an MSW handler, without its `*` or host prefix. */
export function mockRoute(handler: RequestHandler): string {
  const info = handler.info as { method?: unknown; path?: unknown };
  const method = String(info.method);
  const raw = info.path;
  if (typeof raw !== 'string') return `${method} ${String(raw)}`;
  const path = raw.startsWith('*')
    ? raw.slice(1)
    : /^https?:\/\//.test(raw)
      ? new URL(raw).pathname
      : raw;
  return `${method} ${path}`;
}

/** The handlers whose route is neither a real API route nor waiting to be built. */
export function findFakeMockRoutes(handlers: readonly unknown[]): string[] {
  const allowed = [...REAL_API_ROUTES, ...PENDING_ROUTES];
  return handlers
    .filter((handler): handler is RequestHandler => handler instanceof HttpHandler)
    .map(mockRoute)
    .filter((route) => !isRealRoute(route, allowed));
}
