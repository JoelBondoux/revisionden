/** The API for a deployed web app: https://staging.revisionden.com → https://api-staging.revisionden.com. */
export function apiUrlFor(webUrl: string, override?: string): string {
  if (override) return override.replace(/\/$/, '');
  const url = new URL(webUrl);
  const [first, ...rest] = url.hostname.split('.');
  // Production: the app is on app.revisionden.com and its API on api.revisionden.com.
  const host =
    rest.length === 1
      ? `api.${url.hostname}`
      : first === 'app'
        ? `api.${rest.join('.')}`
        : `api-${first}.${rest.join('.')}`;
  return `${url.protocol}//${host}`;
}
