import { apiUrlFor } from '../../smoke/apiUrl';

/**
 * The origins a whole-session test may talk to: the web app, and, against a deployed site
 * (E2E_BASE_URL), its API, which lives on its own host there (VITE_API_URL for that build; the
 * deployed smoke test finds it the same way). Locally the API is served on the web origin (/api).
 */
export function allowedOrigins(
  webUrl: string,
  env: { E2E_BASE_URL?: string; E2E_API_URL?: string } = process.env,
): string[] {
  const web = new URL(webUrl).origin;
  if (!env.E2E_BASE_URL) return [web];
  const api = new URL(apiUrlFor(webUrl, env.E2E_API_URL)).origin;
  return api === web ? [web] : [web, api];
}

/** True when a request goes anywhere but the allowed origins (data: URLs never leave the page). */
export function isElsewhere(url: string, allowed: readonly string[]): boolean {
  const parsed = new URL(url);
  return parsed.protocol !== 'data:' && !allowed.includes(parsed.origin);
}
