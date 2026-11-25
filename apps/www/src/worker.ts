/**
 * The revisionden-www Worker: sends www.revisionden.com to the apex domain and serves the
 * prebuilt pages with strict security headers. No other server code (decision 0005).
 */
interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

const CANONICAL_HOST = 'revisionden.com';
const REDIRECT_HOSTS = new Set(['www.revisionden.com']);

/** Only this site's own files may load: no fonts, scripts, analytics or embeds from elsewhere. */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'none'",
  "style-src 'self'",
  "img-src 'self'",
  "font-src 'self'",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

const SECURITY_HEADERS: Record<string, string> = {
  'content-security-policy': CONTENT_SECURITY_POLICY,
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-content-type-options': 'nosniff',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  'strict-transport-security': 'max-age=31536000',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (REDIRECT_HOSTS.has(url.hostname)) {
      url.hostname = CANONICAL_HOST;
      return Response.redirect(url.toString(), 301);
    }
    const asset = await env.ASSETS.fetch(request);
    const response = new Response(asset.body, asset);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) response.headers.set(name, value);
    if (url.hostname !== CANONICAL_HOST) response.headers.set('x-robots-tag', 'noindex, nofollow');
    return response;
  },
};
