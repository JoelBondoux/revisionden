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
});
