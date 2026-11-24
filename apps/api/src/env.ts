import { z } from 'zod';

/** Rate limiter shape shared by our in-memory limiter and Cloudflare's rate limiting binding. */
export interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

const url = z.url();
const secret = z.string().min(1);
const binding = z.custom<object>((v) => typeof v === 'object' && v !== null);
const optionalRateLimiter = z
  .custom<RateLimitBinding>(
    (v) =>
      typeof v === 'object' && v !== null && typeof (v as RateLimitBinding).limit === 'function',
  )
  .optional();

/** Bindings, variables and secrets the Worker needs. See docs/ENVIRONMENTS.md. */
const envSchema = z.object({
  ENVIRONMENT: z.enum(['development', 'staging', 'production']),
  DATABASE_URL: secret,
  BETTER_AUTH_SECRET: z.string().min(32),
  API_ORIGIN: url,
  WEB_ORIGIN: url,
  GOOGLE_CLIENT_ID: secret,
  GOOGLE_CLIENT_SECRET: secret,
  MICROSOFT_CLIENT_ID: secret,
  MICROSOFT_CLIENT_SECRET: secret,
  AI_GATEWAY_URL: url,
  UPLOADS: binding,
  PASSKEY_RP_ID: z.string().min(1).optional(),
  AUTH_RATE_LIMITER: optionalRateLimiter,
  AI_RATE_LIMITER: optionalRateLimiter,
});

export type WorkerEnv = z.infer<typeof envSchema>;

export interface AppConfig {
  environment: WorkerEnv['ENVIRONMENT'];
  databaseUrl: string;
  authSecret: string;
  apiOrigin: string;
  webOrigin: string;
  google: { clientId: string; clientSecret: string };
  microsoft: { clientId: string; clientSecret: string };
  aiGatewayUrl: string;
  /** WebAuthn relying party id: the web app's host unless overridden. */
  passkeyRpId: string;
}

/** Validates the Worker environment. Throws naming every missing or invalid key. */
export function parseEnv(env: Record<string, unknown>): AppConfig & { raw: WorkerEnv } {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const keys = [...new Set(result.error.issues.map((i) => String(i.path[0])))].sort();
    throw new Error(`Missing or invalid environment: ${keys.join(', ')}`);
  }
  const e = result.data;
  return {
    raw: e,
    environment: e.ENVIRONMENT,
    databaseUrl: e.DATABASE_URL,
    authSecret: e.BETTER_AUTH_SECRET,
    apiOrigin: e.API_ORIGIN,
    webOrigin: e.WEB_ORIGIN,
    google: { clientId: e.GOOGLE_CLIENT_ID, clientSecret: e.GOOGLE_CLIENT_SECRET },
    microsoft: { clientId: e.MICROSOFT_CLIENT_ID, clientSecret: e.MICROSOFT_CLIENT_SECRET },
    aiGatewayUrl: e.AI_GATEWAY_URL,
    passkeyRpId: e.PASSKEY_RP_ID ?? new URL(e.WEB_ORIGIN).hostname,
  };
}
