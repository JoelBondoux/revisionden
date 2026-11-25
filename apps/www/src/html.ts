import type { SiteConfig } from './config.ts';
import { pip } from './pip.ts';

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escapes text for HTML content and attribute values. */
export const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => ESCAPES[c]!);

/** A page of the site: its address, head details and the HTML inside <main>. */
export interface Page {
  /** Site path, e.g. "/" or "/pricing". */
  path: string;
  /** Output file, e.g. "index.html" or "pricing.html". */
  file: string;
  title: string;
  description: string;
  body: string;
  /** Shown in the header navigation with this label. */
  nav?: string;
  /** Left out of the sitemap and canonical links (the not-found page). */
  unlisted?: boolean;
}

/** Header links, in order; only pages that exist are passed in. */
export interface NavItem {
  path: string;
  label: string;
}

function header(config: SiteConfig, nav: NavItem[], current: string): string {
  const links = nav
    .map((item) => {
      const here = item.path === current ? ' aria-current="page"' : '';
      return `<li><a href="${item.path}"${here}>${escapeHtml(item.label)}</a></li>`;
    })
    .join('');
  return `<header class="site-header">
  <a class="brand" href="/">${pip(36)}<span>RevisionDen</span></a>
  <nav class="site-nav" aria-label="Main"><ul>${links}</ul></nav>
  <div class="site-actions">
    <a class="button button--ghost" href="${config.appUrl}">Sign in</a>
    <a class="button button--primary" href="${config.appUrl}">Start free</a>
  </div>
</header>`;
}

function footer(nav: NavItem[]): string {
  const links = nav
    .map((item) => `<li><a href="${item.path}">${escapeHtml(item.label)}</a></li>`)
    .join('');
  return `<footer class="site-footer">
  <nav aria-label="Footer"><ul>${links}</ul></nav>
  <p>RevisionDen is a revision tutor for GCSE and A-Level students and their families.</p>
</footer>`;
}

/** The full HTML document for a page. */
export function layout(
  page: Page,
  config: SiteConfig,
  nav: NavItem[],
  footerNav: NavItem[],
): string {
  const title = page.path === '/' ? page.title : `${page.title} | RevisionDen`;
  const url = `${config.siteUrl}${page.path === '/' ? '/' : page.path}`;
  const canonical = page.unlisted ? '' : `\n<link rel="canonical" href="${url}">`;
  const robots = config.indexable ? '' : '\n<meta name="robots" content="noindex, nofollow">';
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(page.description)}">${canonical}${robots}
<meta name="color-scheme" content="light dark">
<meta property="og:type" content="website">
<meta property="og:site_name" content="RevisionDen">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(page.description)}">
<meta property="og:url" content="${url}">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/styles.css">
</head>
<body>
<a class="skip-link" href="#main">Skip to main content</a>
${header(config, nav, page.path)}
<main id="main" tabindex="-1">
${page.body}
</main>
${footer(footerNav)}
</body>
</html>
`;
}
