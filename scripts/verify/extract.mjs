// Extracts plain text from a source document: one string per page for PDFs, one for web pages.

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

export function isPdf(bytes, contentType = '') {
  if (contentType.includes('application/pdf')) return true;
  return PDF_MAGIC.every((b, i) => bytes[i] === b);
}

const isHtml = (contentType) => /text\/html|application\/xhtml\+xml|text\/plain/.test(contentType);

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };
const BLOCKS =
  /<\/?(p|div|br|li|ul|ol|tr|td|th|table|h[1-6]|section|article|header|footer|main|nav|dd|dt|dl|blockquote|pre|hr)\b[^>]*>/gi;

/** Plain text of an HTML page: drops scripts, styles, comments and tags; decodes entities. */
export function htmlToText(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, ' ')
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

/** { kind: 'pdf' | 'html', pages: string[] } for the bytes of a fetched source. */
export async function extractText(bytes, contentType = '') {
  if (isPdf(bytes, contentType)) return { kind: 'pdf', pages: await pdfPages(bytes) };
  if (isHtml(contentType)) {
    return { kind: 'html', pages: [htmlToText(new TextDecoder().decode(bytes))] };
  }
  throw new Error(`cannot read ${contentType || 'unknown type'}: only PDF and HTML sources`);
}
