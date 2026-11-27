import { z } from 'zod';

/** Rate limiter shape shared by our in-memory limiter and Cloudflare's rate limiting binding. */
export interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

const url = z.string().url();
const secret = z.string().min(1);
const binding = z.custom<object>((v) => typeof v === 'object' && v !== null);
const optionalRateLimiter = z
  .custom<RateLimitBinding>(
    (v) =>
      typeof v === 'object' && v !== null && typeof (v as RateLimitBinding).limit === 'function',
  )
  .optional();

/** Bindings, variables and secrets the Worker needs. See docs/ENVIRONMENTS.md. */
const envSchema = z
  .object({
    ENVIRONMENT: z.enum(['development', 'staging', 'production']),
    DATABASE_URL: secret,
    BETTER_AUTH_SECRET: z.string().min(32),
    API_ORIGIN: url,
    WEB_ORIGIN: url,
    // Sign-in providers: each is optional (id and secret together), but at least one is needed.
    GOOGLE_CLIENT_ID: secret.optional(),
    GOOGLE_CLIENT_SECRET: secret.optional(),
    MICROSOFT_CLIENT_ID: secret.optional(),
    MICROSOFT_CLIENT_SECRET: secret.optional(),
    AI_GATEWAY_URL: url,
    UPLOADS: binding,
    PASSKEY_RP_ID: z.string().min(1).optional(),
    AUTH_RATE_LIMITER: optionalRateLimiter,
    AI_RATE_LIMITER: optionalRateLimiter,
    // Development only: also serve unverified (draft) content. Ignored in staging and production.
    SERVE_DRAFT_CONTENT: z.enum(['true', 'false']).optional(),
    // Development only (J12c): testers may try every effect style. Ignored in staging and production.
    STYLE_TESTER: z.enum(['true', 'false']).optional(),
    // Dev only until the notices are updated (FL, lead 2026-11-26).
    FRIENDS_ENABLED: z.enum(['true', 'false']).optional(),
    MATHS_ENGINE_URL: url.optional(),
    // Workstream H: all optional, so push and live AI stay off until their secrets are set.
    VAPID_PUBLIC_KEY: secret.optional(),
    VAPID_PRIVATE_KEY: secret.optional(),
    ANTHROPIC_API_KEY: secret.optional(),
    OPENAI_API_KEY: secret.optional(),
    AI_GATEWAY_TOKEN: secret.optional(),
    AI_MONTHLY_CAP_USD: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/)
      .optional(),
    AI_CHECKER_MODEL: z.string().min(1).optional(),
    // Workstream L: sign-in emails of the operator, who triages feedback (comma-separated).
    OPERATOR_EMAILS: z.string().optional(),
    // Workstream O: AppDeck operator bridge. Off until set; a different secret per environment.
    APPDECK_OPERATOR_SHARED_SECRET: z.string().min(32).optional(),
    // L14: SHA-256 (hex) of the lead's triage token (the token itself is never stored here or in
    // the repo). Development and staging only until the owner approves production.
    TRIAGE_TOKEN_HASH: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .optional(),
    OPERATOR_RATE_LIMITER: optionalRateLimiter,
    // R5 Founding Tester: the 1.0 cut-off as a UTC timestamp. Unset until release (docs/REWARDS.md).
    BETA_ENDS_AT: z.string().datetime().optional(),
    // "input/output" US dollars per million tokens, e.g. "0.15/0.6".
    AI_CHECKER_PRICES: z
      .string()
      .regex(/^\d+(\.\d+)?\/\d+(\.\d+)?$/)
      .optional(),
  })
  .superRefine((e, ctx) => {
    if (!!e.VAPID_PUBLIC_KEY !== !!e.VAPID_PRIVATE_KEY) {
      const missing = e.VAPID_PUBLIC_KEY ? 'VAPID_PRIVATE_KEY' : 'VAPID_PUBLIC_KEY';
      ctx.addIssue({ code: 'custom', path: [missing], message: 'Both VAPID keys are needed' });
    }
    if (e.AI_CHECKER_MODEL && !e.AI_CHECKER_PRICES) {
      ctx.addIssue({ code: 'custom', path: ['AI_CHECKER_PRICES'], message: 'Prices needed' });
    }
  });

/** Default monthly AI spend cap per child: US$2.50 (about £2). */
export const DEFAULT_AI_MONTHLY_CAP_MICRO_USD = 2_500_000;

export type WorkerEnv = z.infer<typeof envSchema>;

export interface AppConfig {
  environment: WorkerEnv['ENVIRONMENT'];
  databaseUrl: string;
  authSecret: string;
  apiOrigin: string;
  webOrigin: string;
  /** Unset when that provider is not configured; at least one of the two is set. */
  google?: OAuthClient;
  microsoft?: OAuthClient;
  /** Configured providers, in the order the sign-in page shows them. */
  signInProviders: SignInProvider[];
  aiGatewayUrl: string;
  /** WebAuthn relying party id: the web app's host unless overridden. */
  passkeyRpId: string;
  /** Serve draft content as well as verified. Only ever true in development. */
  serveDraftContent: boolean;
  /** Let testers try every effect style (J12c). Only ever true in development. */
  styleTester?: boolean;
  /** The friends league (FL): development only until L updates the notices. */
  friendsEnabled?: boolean;
  /** Maths engine (services/maths) used to check worked maths answers. */
  mathsEngineUrl?: string;
  /** Web push; null until both VAPID keys are set. */
  push: { keys: { publicKey: string; privateKey: string } } | null;
  ai: AiConfig;
  /** Parent sign-in emails (lower case) allowed to triage feedback at /v1/admin. */
  operatorEmails: string[];
  /** AppDeck operator bridge (`/operator/appdeck`); unset means the bridge is off (503). */
  operatorBridge?: { secret: string };
  /** L14: the lead's triage token (`/v1/triage`), by its SHA-256; unset means the routes are 404. */
  triage?: { tokenHash: string };
  /** 1.0 cut-off for Founding Tester (R5); unset until release, so nobody gets it early. */
  betaEndsAt?: Date;
}

export type SignInProvider = 'google' | 'microsoft';

export interface OAuthClient {
  clientId: string;
  clientSecret: string;
}

export interface AiConfig {
  anthropicApiKey: string | undefined;
  openaiApiKey: string | undefined;
  /** Token for an authenticated Cloudflare AI Gateway (cf-aig-authorization). */
  gatewayToken: string | undefined;
  monthlyCapMicroUsd: number;
  /** Second-checker model (OpenAI, via the gateway) and its prices; off when unset. */
  checker: { model: string; inputUsdPerMTok: number; outputUsdPerMTok: number } | undefined;
}

/**
 * Sign-in provider keys that are missing: an id without its secret (or the reverse), or both
 * providers unset. Checked on the raw environment so it is reported with every other problem.
 */
function missingProviderKeys(env: Record<string, unknown>): string[] {
  const set = (key: string) => typeof env[key] === 'string' && env[key] !== '';
  const missing: string[] = [];
  for (const p of ['GOOGLE', 'MICROSOFT']) {
    const id = set(`${p}_CLIENT_ID`);
    if (id !== set(`${p}_CLIENT_SECRET`))
      missing.push(id ? `${p}_CLIENT_SECRET` : `${p}_CLIENT_ID`);
  }
  const none = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'MICROSOFT_CLIENT_ID',
    'MICROSOFT_CLIENT_SECRET',
  ];
  if (!none.some(set)) missing.push('GOOGLE_CLIENT_ID', 'MICROSOFT_CLIENT_ID');
  return missing;
}

/** Validates the Worker environment. Throws naming every missing or invalid key. */
export function parseEnv(env: Record<string, unknown>): AppConfig & { raw: WorkerEnv } {
  const result = envSchema.safeParse(env);
  const providerKeys = missingProviderKeys(env);
  if (!result.success || providerKeys.length > 0) {
    const issues = result.success ? [] : result.error.issues.map((i) => String(i.path[0]));
    const keys = [...new Set([...issues, ...providerKeys])].sort();
    throw new Error(`Missing or invalid environment: ${keys.join(', ')}`);
  }
  const e = result.data;
  const client = (clientId?: string, clientSecret?: string): OAuthClient | undefined =>
    clientId && clientSecret ? { clientId, clientSecret } : undefined;
  const google = client(e.GOOGLE_CLIENT_ID, e.GOOGLE_CLIENT_SECRET);
  const microsoft = client(e.MICROSOFT_CLIENT_ID, e.MICROSOFT_CLIENT_SECRET);
  return {
    raw: e,
    environment: e.ENVIRONMENT,
    databaseUrl: e.DATABASE_URL,
    authSecret: e.BETTER_AUTH_SECRET,
    apiOrigin: e.API_ORIGIN,
    webOrigin: e.WEB_ORIGIN,
    ...(google ? { google } : {}),
    ...(microsoft ? { microsoft } : {}),
    signInProviders: [
      ...(google ? ['google' as const] : []),
      ...(microsoft ? ['microsoft' as const] : []),
    ],
    aiGatewayUrl: e.AI_GATEWAY_URL,
    passkeyRpId: e.PASSKEY_RP_ID ?? new URL(e.WEB_ORIGIN).hostname,
    serveDraftContent: e.ENVIRONMENT === 'development' && e.SERVE_DRAFT_CONTENT === 'true',
    styleTester: e.ENVIRONMENT === 'development' && e.STYLE_TESTER === 'true',
    friendsEnabled: e.ENVIRONMENT === 'development' && e.FRIENDS_ENABLED === 'true',
    ...(e.MATHS_ENGINE_URL ? { mathsEngineUrl: e.MATHS_ENGINE_URL } : {}),
    operatorEmails: (e.OPERATOR_EMAILS ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
    ...(e.BETA_ENDS_AT ? { betaEndsAt: new Date(e.BETA_ENDS_AT) } : {}),
    ...(e.APPDECK_OPERATOR_SHARED_SECRET
      ? { operatorBridge: { secret: e.APPDECK_OPERATOR_SHARED_SECRET } }
      : {}),
    // L14: never in production until the owner approves it (and the privacy notice says so).
    ...(e.TRIAGE_TOKEN_HASH && e.ENVIRONMENT !== 'production'
      ? { triage: { tokenHash: e.TRIAGE_TOKEN_HASH } }
      : {}),
    push:
      e.VAPID_PUBLIC_KEY && e.VAPID_PRIVATE_KEY
        ? { keys: { publicKey: e.VAPID_PUBLIC_KEY, privateKey: e.VAPID_PRIVATE_KEY } }
        : null,
    ai: {
      anthropicApiKey: e.ANTHROPIC_API_KEY,
      openaiApiKey: e.OPENAI_API_KEY,
      gatewayToken: e.AI_GATEWAY_TOKEN,
      monthlyCapMicroUsd: e.AI_MONTHLY_CAP_USD
        ? Math.round(Number(e.AI_MONTHLY_CAP_USD) * 1_000_000)
        : DEFAULT_AI_MONTHLY_CAP_MICRO_USD,
      checker:
        e.AI_CHECKER_MODEL && e.AI_CHECKER_PRICES
          ? {
              model: e.AI_CHECKER_MODEL,
              inputUsdPerMTok: Number(e.AI_CHECKER_PRICES.split('/')[0]),
              outputUsdPerMTok: Number(e.AI_CHECKER_PRICES.split('/')[1]),
            }
          : undefined,
    },
  };
}
