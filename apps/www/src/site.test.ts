import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readSiteConfig } from './config.ts';
import { internalLinks, thirdPartyResources } from './checks.ts';
import { renderSite, type SiteInputs } from './site.ts';

const repoRoot = join(import.meta.dirname, '..', '..', '..');
const tokensCss = readFileSync(join(repoRoot, 'apps/web/src/design/tokens.css'), 'utf8');
const inputs: SiteInputs = {
  tokensCss,
  siteCss: '.site { color: var(--color-text); }',
  fonts: { 'nunito-latin-400-normal.woff2': new Uint8Array([1]) },
};

const production = readSiteConfig({
  WWW_ENVIRONMENT: 'production',
  VITE_OPERATOR_NAME: 'Example Trading',
  VITE_CONTACT_EMAIL: 'privacy@example.test',
});
const staging = readSiteConfig({ WWW_ENVIRONMENT: 'staging' });

const text = (files: Map<string, string | Uint8Array>, path: string) => {
  const file = files.get(path);
  if (typeof file !== 'string') throw new Error(`${path} is missing or not text`);
  return file;
};
const pages = (files: Map<string, string | Uint8Array>) =>
  [...files.keys()].filter((path) => path.endsWith('.html'));

/** The output file a same-site link is served from (Workers assets, auto-trailing-slash). */
function resolves(files: Map<string, unknown>, link: string): boolean {
  if (link === '/') return files.has('index.html');
  const path = link.replace(/^\//, '').replace(/\/$/, '');
  return files.has(path) || files.has(`${path}.html`) || files.has(`${path}/index.html`);
}

describe('the built site', () => {
  const files = renderSite(production, inputs);

  it('has a home page and a not-found page', () => {
    expect(text(files, 'index.html')).toContain('<h1');
    expect(text(files, '404.html')).toContain('Page not found');
  });

  it('gives every page a language, title, description, canonical address and Open Graph tags', () => {
    for (const path of pages(files)) {
      const html = text(files, path);
      expect(html, path).toContain('<html lang="en-GB">');
      expect(html, path).toMatch(/<title>[^<]*RevisionDen[^<]*<\/title>/);
      expect(html, path).toMatch(/<meta name="description" content="[^"]{20,}">/);
      expect(html, path).toContain(
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
      );
      expect(html, path).toMatch(/<meta property="og:title" content="[^"]+">/);
      if (path !== '404.html')
        expect(html, path).toMatch(
          /<link rel="canonical" href="https:\/\/revisionden\.com\/[^"]*">/,
        );
    }
  });

  it('lets keyboard users skip to the main content', () => {
    for (const path of pages(files)) {
      const html = text(files, path);
      expect(html, path).toContain('<a class="skip-link" href="#main">Skip to main content</a>');
      expect(html, path).toContain('<main id="main"');
    }
  });

  it('sends Sign in and Start free to the app', () => {
    const html = text(files, 'index.html');
    expect(html).toContain(
      '<a class="button button--ghost" href="https://app.revisionden.com">Sign in</a>',
    );
    expect(html).toContain('href="https://app.revisionden.com">Start free</a>');
  });

  it('sends staging sign-in to the staging app', () => {
    const html = text(renderSite(staging, inputs), 'index.html');
    expect(html).toContain('href="https://staging.revisionden.com">Sign in</a>');
    expect(html).not.toContain('app.revisionden.com');
  });

  it('reuses the web app’s design tokens rather than its own copy', () => {
    expect(text(files, 'styles.css').startsWith(tokensCss)).toBe(true);
  });

  it('self-hosts its fonts', () => {
    expect(files.get('fonts/nunito-latin-400-normal.woff2')).toEqual(new Uint8Array([1]));
    expect(text(files, 'styles.css')).toContain("url('/fonts/nunito-latin-400-normal.woff2')");
  });

  it('loads nothing from any other origin', () => {
    for (const [path, file] of files) {
      if (typeof file !== 'string') continue;
      expect(thirdPartyResources(file, production.siteUrl), path).toEqual([]);
    }
  });

  it('has no broken internal links', () => {
    for (const path of pages(files)) {
      for (const link of internalLinks(text(files, path))) {
        expect(resolves(files, link), `${path} links to ${link}`).toBe(true);
      }
    }
  });

  it('lists every page except the not-found page in the sitemap', () => {
    const sitemap = text(files, 'sitemap.xml');
    expect(sitemap).toContain('<loc>https://revisionden.com/</loc>');
    expect(sitemap).not.toContain('404');
  });

  it('lets search engines in on the live site and points them at the sitemap', () => {
    expect(text(files, 'robots.txt')).toBe(
      'User-agent: *\nAllow: /\n\nSitemap: https://revisionden.com/sitemap.xml\n',
    );
  });

  it('keeps search engines out of the staging site', () => {
    const files = renderSite(staging, inputs);
    expect(text(files, 'robots.txt')).toBe('User-agent: *\nDisallow: /\n');
    expect(text(files, 'index.html')).toContain('<meta name="robots" content="noindex, nofollow">');
  });

  it('never includes the trading name on the home page', () => {
    expect(text(files, 'index.html')).not.toContain('Example Trading');
  });
});
