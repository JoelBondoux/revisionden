import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readSiteConfig } from './config.ts';
import { renderSite } from './site.ts';
import { testInputs } from './test-inputs.ts';

// J8 (owner, 2026-11-25): the site follows the device's light or dark setting only, with the
// app's dark theme values. No theme switch, no stored choice.
const css = readFileSync(join(import.meta.dirname, 'site.css'), 'utf8');
const dark = css.slice(
  css.indexOf('@media (prefers-color-scheme: dark)'),
  css.indexOf('}\n}', css.indexOf('@media (prefers-color-scheme: dark)')),
);

describe('dark theme follows the device', () => {
  it.each([
    ['--site-bg', '#14112a'],
    ['--site-surface', '#1f1b33'],
    ['--site-border', '#3a3552'],
    ['--site-text', '#eceaf5'],
    ['--site-muted', '#b5b1c8'],
    ['--site-link', '#c4b5ff'],
    ['--site-accent-soft', '#2d2652'],
  ])('uses the app’s dark value for %s', (token, value) => {
    expect(dark.toLowerCase()).toContain(`${token}: ${value};`);
  });

  it('keeps the purple buttons with white text in dark mode', () => {
    expect(dark).not.toContain('--color-primary:');
    expect(dark).not.toContain('--color-text-on-primary:');
  });

  it('offers no theme switch: no script, no stored choice, no theme attribute', () => {
    const files = renderSite(readSiteConfig({ WWW_ENVIRONMENT: 'staging' }), testInputs);
    for (const [path, file] of files) {
      if (typeof file !== 'string' || !path.endsWith('.html')) continue;
      expect(file, path).not.toMatch(/<script|data-theme|localStorage/);
    }
    expect(css).not.toContain('data-theme');
  });
});
