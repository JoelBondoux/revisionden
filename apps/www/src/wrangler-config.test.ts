import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const text = readFileSync(join(import.meta.dirname, '..', 'wrangler.toml'), 'utf8');

/** The [env.<name>] block of wrangler.toml, as text. */
function block(name: string): string {
  const start = text.indexOf(`[env.${name}]`);
  const next = text.indexOf('\n[env.', start + 1);
  return text.slice(start, next === -1 ? undefined : next);
}

describe('www wrangler config', () => {
  it('serves the built pages through the worker, with the 404 page for unknown paths', () => {
    expect(text).toMatch(/main = "src\/worker\.ts"/);
    expect(text).toMatch(/directory = "\.\/dist"/);
    expect(text).toMatch(/binding = "ASSETS"/);
    expect(text).toMatch(/not_found_handling = "404-page"/);
    expect(text).toMatch(/run_worker_first = true/);
  });

  it('deploys staging as revisionden-www-staging on www-staging.revisionden.com', () => {
    expect(block('staging')).toContain('name = "revisionden-www-staging"');
    expect(block('staging')).toContain(
      'pattern = "www-staging.revisionden.com", custom_domain = true',
    );
  });

  it('deploys production as revisionden-www on the apex and www hosts', () => {
    expect(block('production')).toContain('name = "revisionden-www"');
    expect(block('production')).toContain('pattern = "revisionden.com", custom_domain = true');
    expect(block('production')).toContain('pattern = "www.revisionden.com", custom_domain = true');
  });

  it('only names Workers revisionden-*', () => {
    for (const [, name] of text.matchAll(/^name = "([^"]+)"/gm))
      expect(name).toMatch(/^revisionden-/);
  });
});
