/** Checks run over the built pages by the tests (no third parties, links that resolve). */

const RESOURCE_ATTRIBUTES = [
  /<(?:script|img|source|iframe|audio|video|embed|track)\b[^>]*?\ssrc="([^"]+)"/gi,
  /<link\b[^>]*?\shref="([^"]+)"/gi,
  /url\(\s*["']?([^"')]+)["']?\s*\)/gi,
  /@import\s+["']([^"']+)["']/gi,
];

const isExternal = (url: string) => /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(url);

/**
 * Every resource a page would load from another origin. Plain <a> links are not resources:
 * nothing is fetched until a visitor follows one.
 */
export function thirdPartyResources(text: string, ownOrigin?: string): string[] {
  const found: { index: number; url: string }[] = [];
  for (const pattern of RESOURCE_ATTRIBUTES) {
    for (const match of text.matchAll(pattern)) {
      const url = match[1]!;
      if (!isExternal(url)) continue;
      if (ownOrigin && url.startsWith(`${ownOrigin}/`)) continue;
      found.push({ index: match.index, url });
    }
  }
  return found.sort((a, b) => a.index - b.index).map((item) => item.url);
}

/** Every same-site path the page links to or loads, in order. */
export function internalLinks(html: string): string[] {
  const links: string[] = [];
  for (const match of html.matchAll(/\s(?:href|src)="(\/[^"]*)"/g)) {
    const path = match[1]!.replace(/[#?].*$/, '');
    if (path.startsWith('//')) continue;
    links.push(path || '/');
  }
  return links;
}
