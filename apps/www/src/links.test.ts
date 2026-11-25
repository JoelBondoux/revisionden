import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readSiteConfig } from './config.ts';
import { renderSite } from './site.ts';
import { testInputs } from './test-inputs.ts';

// Owner request via J7 (docs/GAME_FEEL.md "Links"): no plain underlined text links.
const files = renderSite(
  readSiteConfig({
    WWW_ENVIRONMENT: 'production',
    VITE_OPERATOR_NAME: 'Example Trading',
    VITE_CONTACT_EMAIL: 'privacy@example.test',
  }),
  testInputs,
);
const pages = [...files.entries()].filter(
  (entry): entry is [string, string] => entry[0].endsWith('.html') && typeof entry[1] === 'string',
);
const css = readFileSync(join(import.meta.dirname, 'site.css'), 'utf8');

/** The CSS block for a selector, as text. */
function rule(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`No rule for ${selector}`);
  return css.slice(start, css.indexOf('}', start));
}

describe('links follow the app’s link styles', () => {
  it('shows header navigation as quiet pill links, not underlined text', () => {
    const html = pages.find(([path]) => path === 'index.html')![1];
    const nav = html.match(/<nav class="site-nav"[\s\S]*?<\/nav>/)![0];
    for (const link of nav.match(/<a [^>]*>/g)!) expect(link).toContain('class="nav-link"');
  });

  it('shows footer links as chips', () => {
    for (const [path, html] of pages) {
      const footer = html.match(/<footer[\s\S]*<\/footer>/)![0];
      for (const link of footer.match(/<a [^>]*>/g)!)
        expect(link, path).toContain('class="link-chip"');
    }
  });

  it('lists the policies as tappable tiles with a title, description and chevron', () => {
    const html = pages.find(([path]) => path === 'policies.html')![1];
    const tiles = html.match(/<a class="link-tile"[\s\S]*?<\/a>/g) ?? [];
    expect(tiles).toHaveLength(Object.keys(testInputs.legalFiles).length);
    for (const tile of tiles) {
      expect(tile).toMatch(/<span class="link-tile__title">[^<]+<\/span>/);
      expect(tile).toMatch(/<span class="link-tile__description">[^<]+<\/span>/);
      expect(tile).toContain('class="link-tile__chevron"');
    }
  });

  it('never leaves a link standing alone as plain text: those are buttons or tiles', () => {
    for (const [path, html] of pages) {
      expect(html, path).not.toMatch(/<p[^>]*>\s*<a (?![^>]*class=)[^>]*>[^<]*<\/a>\s*<\/p>/);
      expect(html, path).not.toMatch(/<h[1-6][^>]*>\s*<a (?![^>]*class=)/);
    }
  });

  it('styles links inside sentences bold and coloured with a soft bar, underlined only on hover', () => {
    const inline = rule('main a:not([class])');
    expect(inline).toContain('text-decoration: none');
    expect(inline).toContain('font-weight: var(--font-weight-extrabold)');
    expect(inline).toContain('border-bottom: 2px solid var(--color-mastery-fill)');
    expect(rule('main a:not([class]):hover')).toContain('text-decoration: underline');
  });

  it('gives buttons uppercase black-weight labels that lift on hover and squash on press', () => {
    expect(rule('.button')).toContain('text-transform: uppercase');
    expect(rule('.button')).toContain('font-weight: var(--font-weight-black)');
    expect(rule('.button:hover')).toContain('translateY(-2px)');
    expect(rule('.button:active')).toMatch(/scale\(/);
  });

  it('keeps every link a 44px target with the 3px violet focus ring', () => {
    for (const selector of ['.nav-link', '.link-chip', '.link-tile', '.button']) {
      expect(rule(selector), selector).toContain('min-height: var(--tap-target)');
    }
    expect(rule('a:focus-visible')).toContain('outline: 3px solid var(--color-primary)');
  });

  it('turns the lift and squash off with reduced motion', () => {
    const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    for (const selector of [
      '.button:hover',
      '.button:active',
      '.link-tile:hover',
      '.link-tile:active',
      '.link-chip:active',
      '.nav-link:hover',
    ]) {
      expect(block, selector).toContain(selector);
    }
    expect(block).toContain('transform: none');
  });
});
