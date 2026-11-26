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

describe('sign-in providers', () => {
  const without = (...keys: string[]) => {
    const env: Record<string, unknown> = { ...complete };
    for (const key of keys) delete env[key];
    return env;
  };

  it('offers both providers when both are configured', () => {
    expect(parseEnv(complete).signInProviders).toEqual(['google', 'microsoft']);
  });

  it('starts with Google only', () => {
    const config = parseEnv(without('MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET'));
    expect(config.signInProviders).toEqual(['google']);
    expect(config.microsoft).toBeUndefined();
    expect(config.google).toEqual({ clientId: 'google-id', clientSecret: 'google-secret' });
  });

  it('starts with Microsoft only', () => {
    const config = parseEnv(without('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'));
    expect(config.signInProviders).toEqual(['microsoft']);
    expect(config.google).toBeUndefined();
  });

  it('names the missing half of a provider set up with only its id or secret', () => {
    expect(() => parseEnv(without('MICROSOFT_CLIENT_SECRET'))).toThrow(
      /Missing or invalid environment: MICROSOFT_CLIENT_SECRET$/,
    );
    expect(() => parseEnv(without('GOOGLE_CLIENT_ID'))).toThrow(/GOOGLE_CLIENT_ID$/);
  });

  it('needs at least one provider', () => {
    expect(() =>
      parseEnv(
        without(
          'GOOGLE_CLIENT_ID',
          'GOOGLE_CLIENT_SECRET',
          'MICROSOFT_CLIENT_ID',
          'MICROSOFT_CLIENT_SECRET',
        ),
      ),
    ).toThrow(/GOOGLE_CLIENT_ID, MICROSOFT_CLIENT_ID/);
  });
});

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

  it('serves draft content only when the development flag is on in development', () => {
    expect(parseEnv(complete).serveDraftContent).toBe(false);
    expect(parseEnv({ ...complete, SERVE_DRAFT_CONTENT: 'false' }).serveDraftContent).toBe(false);
    expect(parseEnv({ ...complete, SERVE_DRAFT_CONTENT: 'true' }).serveDraftContent).toBe(true);
  });

  it('never serves draft content in staging or production, even with the flag on', () => {
    for (const ENVIRONMENT of ['staging', 'production']) {
      const config = parseEnv({ ...complete, ENVIRONMENT, SERVE_DRAFT_CONTENT: 'true' });
      expect(config.serveDraftContent).toBe(false);
    }
  });

  it('turns on the style tester only when the development flag is on in development (J12c)', () => {
    expect(parseEnv(complete).styleTester).toBe(false);
    expect(parseEnv({ ...complete, STYLE_TESTER: 'false' }).styleTester).toBe(false);
    expect(parseEnv({ ...complete, STYLE_TESTER: 'true' }).styleTester).toBe(true);
  });

  it('turns on the friends league only when the development flag is on in development (FL)', () => {
    expect(parseEnv(complete).friendsEnabled).toBe(false);
    expect(parseEnv({ ...complete, FRIENDS_ENABLED: 'false' }).friendsEnabled).toBe(false);
    expect(parseEnv({ ...complete, FRIENDS_ENABLED: 'true' }).friendsEnabled).toBe(true);
  });

  it('never turns on the friends league in staging or production, even with the flag on', () => {
    for (const ENVIRONMENT of ['staging', 'production']) {
      expect(parseEnv({ ...complete, ENVIRONMENT, FRIENDS_ENABLED: 'true' }).friendsEnabled).toBe(
        false,
      );
    }
  });

  it('never turns on the style tester in staging or production, even with the flag on', () => {
    for (const ENVIRONMENT of ['staging', 'production']) {
      expect(parseEnv({ ...complete, ENVIRONMENT, STYLE_TESTER: 'true' }).styleTester).toBe(false);
    }
  });

  it('reads the optional maths engine address', () => {
    expect(parseEnv(complete).mathsEngineUrl).toBeUndefined();
    expect(
      parseEnv({ ...complete, MATHS_ENGINE_URL: 'https://maths.example.com' }).mathsEngineUrl,
    ).toBe('https://maths.example.com');
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

  it('reads the operator sign-in emails, trimmed and in lower case, and has none by default', () => {
    expect(parseEnv(complete).operatorEmails).toEqual([]);
    expect(
      parseEnv({ ...complete, OPERATOR_EMAILS: ' Ops@Example.com, ,second@example.com ' })
        .operatorEmails,
    ).toEqual(['ops@example.com', 'second@example.com']);
  });

  it('keeps the AppDeck operator bridge off until its shared secret is set', () => {
    expect(parseEnv(complete).operatorBridge).toBeUndefined();
    const secret = 'a-shared-secret-of-at-least-32-characters';
    expect(
      parseEnv({ ...complete, APPDECK_OPERATOR_SHARED_SECRET: secret }).operatorBridge,
    ).toEqual({ secret });
  });

  it('refuses an AppDeck shared secret shorter than 32 characters', () => {
    expect(() => parseEnv({ ...complete, APPDECK_OPERATOR_SHARED_SECRET: 'too-short' })).toThrow(
      /APPDECK_OPERATOR_SHARED_SECRET/,
    );
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
