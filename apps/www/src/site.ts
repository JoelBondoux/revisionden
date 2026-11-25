import type { SiteConfig } from './config.ts';
import { layout, type NavItem, type Page } from './html.ts';
import { aboutPage } from './pages/about.ts';
import { helpPage } from './pages/help.ts';
import { homePage } from './pages/home.ts';
import { howItWorksPage } from './pages/how-it-works.ts';
import { notFoundPage } from './pages/not-found.ts';
import { policiesIndexPage, policyPage } from './pages/policies.ts';
import { pricingPage } from './pages/pricing.ts';
import { youngPeoplePage } from './pages/young-people.ts';
import { pipIconSvg } from './pip.ts';
import { loadPolicies } from './policies.ts';
import { readPricing } from './pricing.ts';

/** Files read from the repository at build time (see build.ts). */
export interface SiteInputs {
  /** apps/web/src/design/tokens.css: the web app's design tokens, reused as they are. */
  tokensCss: string;
  /** This site's own stylesheet (src/site.css). */
  siteCss: string;
  /** Self-hosted font files by file name (from @fontsource/nunito). */
  fonts: Record<string, Uint8Array>;
  /** docs/LEGAL.md (policy order and audiences). */
  legalIndex: string;
  /** docs/legal/*.md by file name: the same policies the app shows. */
  legalFiles: Record<string, string>;
  /** docs/PRICING.md: the planned prices (decision 0004). */
  pricingDoc: string;
}

export type SiteFiles = Map<string, string | Uint8Array>;

const FONT_WEIGHT = /-(\d00)-normal\.woff2$/;

function fontFaces(fonts: Record<string, Uint8Array>): string {
  return Object.keys(fonts)
    .sort()
    .map((name) => {
      const weight = name.match(FONT_WEIGHT)?.[1] ?? '400';
      return `@font-face{font-family:'Nunito';font-style:normal;font-display:swap;font-weight:${weight};src:url('/fonts/${name}') format('woff2');}`;
    })
    .join('\n');
}

function sitemap(config: SiteConfig, pages: Page[]): string {
  const urls = pages
    .filter((page) => !page.unlisted)
    .map((page) => `  <url><loc>${config.siteUrl}${page.path}</loc></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function robots(config: SiteConfig): string {
  return config.indexable
    ? `User-agent: *\nAllow: /\n\nSitemap: ${config.siteUrl}/sitemap.xml\n`
    : 'User-agent: *\nDisallow: /\n';
}

/** Every file of the site, by output path. Pure: the caller reads inputs and writes files. */
export function renderSite(config: SiteConfig, inputs: SiteInputs): SiteFiles {
  const policies = loadPolicies(
    { index: inputs.legalIndex, files: inputs.legalFiles },
    config.policyEnv,
  );
  const pages: Page[] = [
    homePage(config),
    howItWorksPage(config),
    pricingPage(config, readPricing(inputs.pricingDoc)),
    youngPeoplePage(config),
    helpPage(config),
    aboutPage(config),
    policiesIndexPage(policies, !config.policyEnv.VITE_POLICY_EFFECTIVE_DATE),
    ...policies.map(policyPage),
    notFoundPage(),
  ];
  const nav: NavItem[] = pages.flatMap((page) =>
    page.nav ? [{ path: page.path, label: page.nav }] : [],
  );
  const footerNav: NavItem[] = [
    { path: '/', label: 'Home' },
    ...nav,
    { path: '/about', label: 'About' },
    { path: '/policies', label: 'Policies' },
    { path: '/policies/privacy-for-young-people', label: 'Privacy for young people' },
  ];
  const files: SiteFiles = new Map();
  for (const page of pages) files.set(page.file, layout(page, config, nav, footerNav));
  files.set('styles.css', `${inputs.tokensCss}\n${fontFaces(inputs.fonts)}\n${inputs.siteCss}`);
  for (const [name, bytes] of Object.entries(inputs.fonts)) files.set(`fonts/${name}`, bytes);
  files.set('icon.svg', pipIconSvg());
  files.set('sitemap.xml', sitemap(config, pages));
  files.set('robots.txt', robots(config));
  return files;
}
