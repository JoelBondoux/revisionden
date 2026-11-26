import { readFileSync } from 'node:fs';
import { parse } from 'smol-toml';
import { describe, expect, it } from 'vitest';
import { CLEANUP_CRON, REMINDER_CRONS } from './crons';

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
        'OPERATOR_RATE_LIMITER',
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

  it('offers the style tester in dev only (J12c)', () => {
    expect(config.env.dev!.vars.STYLE_TESTER).toBe('true');
    for (const name of ['staging', 'production']) {
      expect(config.env[name]!.vars.STYLE_TESTER, name).toBeUndefined();
    }
    expect(config.vars.STYLE_TESTER).toBeUndefined();
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
      'APPDECK_OPERATOR_SHARED_SECRET',
      'GOOGLE_CLIENT_ID',
      'MICROSOFT_CLIENT_ID',
      // Contains the Cloudflare account id, so it is a secret too.
      'AI_GATEWAY_URL',
    ]) {
      expect(text).not.toMatch(new RegExp(`^\\s*${secret}\\s*=`, 'm'));
    }
  });

  // Neon suspends an idle database after 5 minutes, and every cron tick that opens it wakes it.
  // Cloudflare leaves deployed crons in place when `triggers` is missing; only `crons = []`
  // removes them (https://developers.cloudflare.com/workers/configuration/cron-triggers/).
  it.each(['dev', 'staging'])(
    'has no cron in %s, written as an explicit empty list so a redeploy removes any old one',
    (name) => {
      expect(config.env[name]!.triggers).toEqual({ crons: [] });
    },
  );

  it('has no cron for local development, as an explicit empty list', () => {
    expect(config.triggers).toEqual({ crons: [] });
  });

  it('runs the clean-up once a day and reminders every 30 minutes in daytime in production', () => {
    expect(config.env.production!.triggers?.crons).toEqual([CLEANUP_CRON, ...REMINDER_CRONS]);
    expect(CLEANUP_CRON).toBe('17 3 * * *');
    expect(REMINDER_CRONS).toEqual(['30 6 * * *', '*/30 7-20 * * *']);
  });

  it('keeps the production reminder ticks between 06:30 and 20:30 UTC (UK waking hours, GMT and BST)', () => {
    const ticks: string[] = [];
    for (const cron of REMINDER_CRONS) {
      const [minute, hour] = cron.split(' ') as [string, string];
      const step = minute.startsWith('*/') ? Number(minute.slice(2)) : 60;
      const minutes = minute.startsWith('*/')
        ? Array.from({ length: 60 / step }, (_, i) => i * step)
        : [Number(minute)];
      const [from, to] = hour.includes('-')
        ? hour.split('-').map(Number)
        : [Number(hour), Number(hour)];
      for (let h = from!; h <= to!; h++) for (const m of minutes) ticks.push(`${h}:${m}`);
    }
    expect(ticks).toHaveLength(29);
    expect(ticks[0]).toBe('6:30');
    expect(ticks.at(-1)).toBe('20:30');
  });
});
