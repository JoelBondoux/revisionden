import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const text = readFileSync(join(process.cwd(), 'wrangler.toml'), 'utf8');

/** The [env.<name>] block of wrangler.toml, as text. */
function block(name: string): string {
  const start = text.indexOf(`[env.${name}]`);
  const next = text.indexOf('\n[env.', start + 1);
  return text.slice(start, next === -1 ? undefined : next);
}

describe('web wrangler config', () => {
  it('serves the built app and sends unknown paths to the app router', () => {
    expect(text).toMatch(/directory = "\.\/dist"/);
    expect(text).toMatch(/not_found_handling = "single-page-application"/);
  });

  it.each([
    ['dev', 'revisionden-web-dev', 'dev.revisionden.com'],
    ['staging', 'revisionden-web-staging', 'staging.revisionden.com'],
    ['production', 'revisionden-web', 'revisionden.com'],
  ])('deploys %s as %s on %s', (env, worker, host) => {
    expect(block(env)).toContain(`name = "${worker}"`);
    expect(block(env)).toContain(`pattern = "${host}", custom_domain = true`);
  });
});
