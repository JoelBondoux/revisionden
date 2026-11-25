export const ROUTE_MANIFEST_NOTE =
  'Generated from the Hono app by src/route-manifest.test.ts (UPDATE_ROUTES=1 pnpm --filter @revisionden/api test). ' +
  'The web app tests fail if an MSW mock handler is not one of these routes.';

/** Every real route as "METHOD /path" (Hono patterns), sorted, without middleware. */
export function listRoutes(app: { routes: { method: string; path: string }[] }): string[] {
  const routes = app.routes
    .filter((route) => route.method !== 'ALL')
    .map((route) => `${route.method} ${route.path}`);
  return [...new Set(routes)].sort();
}
