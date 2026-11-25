import { readFileSync } from 'node:fs';
import { parse } from 'smol-toml';
import { describe, expect, it } from 'vitest';

interface EnvBlock {
  name: string;
  vars: Record<string, string>;
  r2_buckets: { binding: string; bucket_name: string; jurisdiction?: string }[];
  ratelimits: { name: string }[];
  triggers?: { crons: string[] };
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

  it.each(['dev', 'staging', 'production'])(
    'keeps %s uploads in an EU-jurisdiction bucket named for the environment',
    (name) => {
      const uploads = config.env[name]!.r2_buckets.find((b) => b.binding === 'UPLOADS')!;
      expect(uploads.bucket_name).toBe(`revisionden-uploads-${name}`);
      expect(uploads.jurisdiction).toBe('eu');
    },
  );

  it('serves draft content in dev only, so the family can try the pilot', () => {
    expect(config.env.dev!.vars.SERVE_DRAFT_CONTENT).toBe('true');
    for (const name of ['staging', 'production']) {
      expect(config.env[name]!.vars.SERVE_DRAFT_CONTENT, name).toBeUndefined();
    }
    // Local development keeps the default (off) unless .dev.vars turns it on.
    expect(config.vars.SERVE_DRAFT_CONTENT).toBeUndefined();
  });

  it('points production at the app on app.revisionden.com, with passkeys for the whole domain', () => {
    const vars = config.env.production!.vars;
    expect(vars.WEB_ORIGIN).toBe('https://app.revisionden.com');
    expect(vars.API_ORIGIN).toBe('https://api.revisionden.com');
    // The registrable domain, so a passkey made on app.revisionden.com keeps working if the app
    // moves between subdomains (WebAuthn allows an RP ID that is a suffix of the origin's host).
    expect(vars.PASSKEY_RP_ID).toBe('revisionden.com');
    expect(new URL(vars.WEB_ORIGIN!).hostname.endsWith(`.${vars.PASSKEY_RP_ID}`)).toBe(true);
  });

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

  it.each(['dev', 'staging', 'production'])(
    'runs the reminder cron every 15 minutes in %s',
    (name) => {
      expect(config.env[name]!.triggers?.crons).toEqual(['*/15 * * * *']);
    },
  );
});
