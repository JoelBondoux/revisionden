// Extracts plain text from a source document: one string per page for PDFs, one for web pages.
import { HEADING } from './normalise.mjs';

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

export function isPdf(bytes, contentType = '') {
  if (contentType.includes('application/pdf')) return true;
  return PDF_MAGIC.every((b, i) => bytes[i] === b);
}

const isHtml = (contentType) => /text\/html|application\/xhtml\+xml|text\/plain/.test(contentType);

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };
const BLOCKS =
  /<\/?(p|div|br|li|ul|ol|tr|td|th|table|h[1-6]|section|article|header|footer|main|nav|dd|dt|dl|blockquote|pre|hr)\b[^>]*>/gi;

/**
 * Plain text of an HTML page: drops scripts, styles, comments and tags; decodes entities. Each
 * heading (h1 to h6) starts with HEADING, so headings can be told from running text.
 */
export function htmlToText(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<h[1-6]\b[^>]*>/gi, `\n${HEADING}`)
    .replace(BLOCKS, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

async function pdfPages(bytes) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: false,
    isEvalSupported: false,
    verbosity: 0,
  }).promise;
  const pages = [];
  for (let n = 1; n <= doc.numPages; n += 1) {
    const page = await doc.getPage(n);
    const { items } = await page.getTextContent();
    pages.push(items.map((i) => ('str' in i ? i.str + (i.hasEOL ? '\n' : ' ') : '')).join(''));
  }
  await doc.destroy();
  return pages;
}

/** The printed page number: a line holding only a number among the first or last 4 lines. */
function printedPageNumber(text) {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const edges = [...lines.slice(0, 4), ...lines.slice(-4)];
  return edges.find((l) => /^\d{1,4}$/.test(l)) ?? null;
}

/**
 * { kind: 'pdf' | 'html', pages: string[], labels: (string | null)[] } for a fetched source.
 * labels: the printed page number of each page, where one can be read.
 */
export async function extractText(bytes, contentType = '') {
  if (isPdf(bytes, contentType)) {
    const pages = await pdfPages(bytes);
    return { kind: 'pdf', pages, labels: pages.map(printedPageNumber) };
  }
  if (isHtml(contentType)) {
    return { kind: 'html', pages: [htmlToText(new TextDecoder().decode(bytes))], labels: [null] };
  }
  throw new Error(`cannot read ${contentType || 'unknown type'}: only PDF and HTML sources`);
}
