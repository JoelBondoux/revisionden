import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSite } from './build.ts';

describe('site build', () => {
  const out = mkdtempSync(join(tmpdir(), 'revisionden-www-'));
  afterAll(() => rmSync(out, { recursive: true, force: true }));

  it('writes the pages, stylesheet and self-hosted Nunito fonts to the output folder', () => {
    buildSite(out, { WWW_ENVIRONMENT: 'staging' });
    expect(readFileSync(join(out, 'index.html'), 'utf8')).toContain('<h1>');
    expect(existsSync(join(out, 'fonts/nunito-latin-800-normal.woff2'))).toBe(true);
    const css = readFileSync(join(out, 'styles.css'), 'utf8');
    expect(css).toContain('--color-primary: #6c47f5');
    expect(css).toContain('@media (prefers-color-scheme: dark)');
  });

  it('stops before writing anything when production details are missing', () => {
    const empty = mkdtempSync(join(tmpdir(), 'revisionden-www-'));
    expect(() => buildSite(empty, { WWW_ENVIRONMENT: 'production' })).toThrow(/VITE_OPERATOR_NAME/);
    expect(existsSync(join(empty, 'index.html'))).toBe(false);
    rmSync(empty, { recursive: true, force: true });
  });
});
