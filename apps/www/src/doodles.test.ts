import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readInputs } from './build.ts';
import { readSiteConfig } from './config.ts';
import { renderSite } from './site.ts';
import { repoRoot, testInputs } from './test-inputs.ts';

// J8 (#100): the app's line-doodle background, reused on the public site. Same tile, same 7%
// ink, hidden for high contrast and forced colours. The site follows the device theme only, so
// the pattern is always on (no data-pattern switch).
const css = readFileSync(join(import.meta.dirname, 'site.css'), 'utf8');
const appTile = readFileSync(join(repoRoot, 'apps/web/src/design/doodles.svg'), 'utf8');
const darkStart = css.indexOf('@media (prefers-color-scheme: dark)');
const dark = css.slice(darkStart, css.indexOf('}\n}', darkStart));

describe('doodle background', () => {
  it('ships the app’s own doodle tile, read from apps/web rather than copied', () => {
    expect(readInputs().doodlesSvg).toBe(appTile);
    const files = renderSite(readSiteConfig({ WWW_ENVIRONMENT: 'staging' }), testInputs);
    expect(files.get('doodles.svg')).toBe(testInputs.doodlesSvg);
  });

  it('draws the tile as a fixed 240px mask behind the page', () => {
    const rule = css.slice(
      css.indexOf('body::before {'),
      css.indexOf('}', css.indexOf('body::before {')),
    );
    expect(rule).toContain('position: fixed;');
    expect(rule).toContain('z-index: -1;');
    expect(rule).toContain('pointer-events: none;');
    expect(rule).toContain('background-color: var(--site-pattern-ink);');
    expect(rule).toContain("mask: url('/doodles.svg') 0 0 / 240px 240px repeat;");
  });

  it('uses the app’s 7% ink in light and dark', () => {
    expect(css.slice(0, darkStart)).toContain('--site-pattern-ink: rgb(108 71 245 / 7%);');
    expect(dark).toContain('--site-pattern-ink: rgb(196 181 255 / 7%);');
  });

  it('hides the pattern for high contrast and forced colours', () => {
    const block = css.slice(
      css.indexOf('@media (prefers-contrast: more), (forced-colors: active)'),
    );
    expect(block).toMatch(
      /^@media \(prefers-contrast: more\), \(forced-colors: active\) \{\s*body::before \{\s*display: none;/,
    );
  });
});
