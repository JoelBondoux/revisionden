import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

const complete = {
  ENVIRONMENT: 'development',
  DATABASE_URL: 'postgres://user:pass@localhost/db',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  API_ORIGIN: 'https://api-dev.revisionden.com',
  WEB_ORIGIN: 'https://dev.revisionden.com',
  GOOGLE_CLIENT_ID: 'google-id',
  GOOGLE_CLIENT_SECRET: 'google-secret',
  MICROSOFT_CLIENT_ID: 'ms-id',
  MICROSOFT_CLIENT_SECRET: 'ms-secret',
  AI_GATEWAY_URL: 'https://gateway.ai.cloudflare.com/v1/acct/revisionden',
  UPLOADS: { put: () => undefined },
};

describe('environment validation', () => {
  it('accepts a complete environment and returns typed config', () => {
    const config = parseEnv(complete);
    expect(config.environment).toBe('development');
    expect(config.webOrigin).toBe('https://dev.revisionden.com');
    expect(config.passkeyRpId).toBe('dev.revisionden.com');
  });

  it('fails fast and names every missing binding or secret', () => {
    const partial: Record<string, unknown> = { ...complete };
    delete partial.DATABASE_URL;
    delete partial.UPLOADS;
    delete partial.GOOGLE_CLIENT_SECRET;
    expect(() => parseEnv(partial)).toThrow(
      /Missing or invalid environment: DATABASE_URL, GOOGLE_CLIENT_SECRET, UPLOADS/,
    );
  });

  it('rejects an auth secret shorter than 32 characters', () => {
    expect(() => parseEnv({ ...complete, BETTER_AUTH_SECRET: 'short' })).toThrow(
      /BETTER_AUTH_SECRET/,
    );
  });

  it('rejects an unknown environment name', () => {
    expect(() => parseEnv({ ...complete, ENVIRONMENT: 'prod' })).toThrow(/ENVIRONMENT/);
  });

  it('leaves web push and live AI switched off until their secrets are set', () => {
    const config = parseEnv(complete);
    expect(config.push).toBeNull();
    expect(config.ai).toEqual({
      anthropicApiKey: undefined,
      openaiApiKey: undefined,
      gatewayToken: undefined,
      monthlyCapMicroUsd: 2_500_000,
      checker: undefined,
    });
  });

  it('reads the VAPID keys, AI keys, cap and second-checker model when set', () => {
    const config = parseEnv({
      ...complete,
      VAPID_PUBLIC_KEY: 'pub',
      VAPID_PRIVATE_KEY: 'priv',
      ANTHROPIC_API_KEY: 'test-anthropic-key',
      OPENAI_API_KEY: 'test-openai-key',
      AI_GATEWAY_TOKEN: 'test-gateway-token',
      AI_MONTHLY_CAP_USD: '1.75',
      AI_CHECKER_MODEL: 'checker-model',
      AI_CHECKER_PRICES: '0.2/0.8',
    });
    expect(config.push).toEqual({ keys: { publicKey: 'pub', privateKey: 'priv' } });
    expect(config.ai).toEqual({
      anthropicApiKey: 'test-anthropic-key',
      openaiApiKey: 'test-openai-key',
      gatewayToken: 'test-gateway-token',
      monthlyCapMicroUsd: 1_750_000,
      checker: { model: 'checker-model', inputUsdPerMTok: 0.2, outputUsdPerMTok: 0.8 },
    });
  });

  it('needs both VAPID keys, and prices for a second-checker model', () => {
    expect(() => parseEnv({ ...complete, VAPID_PUBLIC_KEY: 'pub' })).toThrow(/VAPID_PRIVATE_KEY/);
    expect(() => parseEnv({ ...complete, AI_CHECKER_MODEL: 'm' })).toThrow(/AI_CHECKER_PRICES/);
    expect(() => parseEnv({ ...complete, AI_MONTHLY_CAP_USD: 'lots' })).toThrow(
      /AI_MONTHLY_CAP_USD/,
    );
  });
});
