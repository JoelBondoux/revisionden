import { readFileSync } from 'node:fs';
import { parse } from 'smol-toml';
import { describe, expect, it } from 'vitest';

interface EnvBlock {
  name: string;
  vars: Record<string, string>;
  r2_buckets: { binding: string }[];
  ratelimits: { name: string }[];
}

const config = parse(
  readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8'),
) as unknown as {
  env: Record<string, EnvBlock>;
} & EnvBlock;

describe('wrangler config', () => {
  it.each(['dev', 'staging', 'production'])(
    'defines the %s environment with its vars and bindings',
    (name) => {
      const env = config.env[name]!;
      expect(env).toBeDefined();
      for (const key of ['ENVIRONMENT', 'API_ORIGIN', 'WEB_ORIGIN', 'PASSKEY_RP_ID']) {
        expect(env.vars[key], `${name}.${key}`).toBeTruthy();
      }
      expect(env.r2_buckets.map((b) => b.binding)).toContain('UPLOADS');
      expect(env.ratelimits.map((r) => r.name).sort()).toEqual([
        'AI_RATE_LIMITER',
        'AUTH_RATE_LIMITER',
      ]);
    },
  );

  it('never contains secrets: those are set with wrangler secret put', () => {
    const text = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
    for (const secret of [
      'DATABASE_URL',
      'BETTER_AUTH_SECRET',
      'GOOGLE_CLIENT_SECRET',
      'MICROSOFT_CLIENT_SECRET',
      'GOOGLE_CLIENT_ID',
      'MICROSOFT_CLIENT_ID',
      // Contains the Cloudflare account id, so it is a secret too.
      'AI_GATEWAY_URL',
    ]) {
      expect(text).not.toMatch(new RegExp(`^\\s*${secret}\\s*=`, 'm'));
    }
  });
});
