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
    GOOGLE_CLIENT_ID: secret,
    GOOGLE_CLIENT_SECRET: secret,
    MICROSOFT_CLIENT_ID: secret,
    MICROSOFT_CLIENT_SECRET: secret,
    AI_GATEWAY_URL: url,
    UPLOADS: binding,
    PASSKEY_RP_ID: z.string().min(1).optional(),
    AUTH_RATE_LIMITER: optionalRateLimiter,
    AI_RATE_LIMITER: optionalRateLimiter,
    // Development only: also serve unverified (draft) content. Ignored in staging and production.
    SERVE_DRAFT_CONTENT: z.enum(['true', 'false']).optional(),
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
  google: { clientId: string; clientSecret: string };
  microsoft: { clientId: string; clientSecret: string };
  aiGatewayUrl: string;
  /** WebAuthn relying party id: the web app's host unless overridden. */
  passkeyRpId: string;
  /** Serve draft content as well as verified. Only ever true in development. */
  serveDraftContent: boolean;
  /** Maths engine (services/maths) used to check worked maths answers. */
  mathsEngineUrl?: string;
  /** Web push; null until both VAPID keys are set. */
  push: { keys: { publicKey: string; privateKey: string } } | null;
  ai: AiConfig;
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
    serveDraftContent: e.ENVIRONMENT === 'development' && e.SERVE_DRAFT_CONTENT === 'true',
    ...(e.MATHS_ENGINE_URL ? { mathsEngineUrl: e.MATHS_ENGINE_URL } : {}),
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
