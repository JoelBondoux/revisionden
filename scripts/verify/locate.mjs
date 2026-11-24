// Finds a citation's quote in a source's pages and confirms it sits at the stated location.
import { normaliseText } from './normalise.mjs';

const PAGE_PHRASE = /\b(?:pages?|pp?\.?)\s*(\d+)(?:\s*[-\u2013\u2014]\s*(\d+))?/gi;
const CODE = /(?<![A-Za-z0-9.])([A-Z]{1,3}\d+[a-z]?|\d+(?:\.\d+)+[a-z]?)(?![A-Za-z0-9]|\.\d)/g;
const AFTER_QUOTE = 200;

/** Page numbers and specification codes (N7, A17, 4.2.1a) named in a citation location. */
export function parseLocation(location) {
  const pages = [];
  for (const [, from, to] of location.matchAll(PAGE_PHRASE)) {
    const last = to ? Number(to) : Number(from);
    for (let p = Number(from); p <= last; p += 1) pages.push(p);
  }
  const rest = location.replace(PAGE_PHRASE, ' ');
  const codes = [...rest.matchAll(CODE)].map((m) => m[1]);
  return { pages, codes };
}

function joinPages(pages, joinHyphens) {
  const starts = [];
  let text = '';
  for (const page of pages) {
    starts.push(text.length);
    text += `${normaliseText(page, { joinHyphens })} `;
  }
  return { text, starts };
}

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasCode = (text, code) =>
  new RegExp(`(?<![A-Za-z0-9.])${escapeRegExp(code)}(?![A-Za-z0-9]|\\.\\d)`).test(text);

const notFound = (reason) => ({ found: false, page: null, locationConfirmed: false, reason });

/**
 * { found, page, locationConfirmed, reason } for a citation ({ quote, location }) in a source.
 * pages: text of each page. paged: false for web pages (no page numbers). window: how many
 * characters before the quote a specification code may appear.
 */
export function locateQuote({ quote, location }, pages, { paged = true, window = 1500 } = {}) {
  const needle = normaliseText(quote);
  if (!needle) return notFound('the citation has no quote');
  let match = null;
  for (const joinHyphens of [true, false]) {
    const { text, starts } = joinPages(pages, joinHyphens);
    const at = text.indexOf(needle);
    if (at >= 0) {
      match = { text, at, page: starts.findLastIndex((s) => s <= at) + 1 };
      break;
    }
  }
  if (!match) return notFound('quote not found in the source');

  const { text, at, page } = match;
  const loc = parseLocation(location);
  const problems = [];
  if (loc.pages.length && !paged) {
    problems.push('a web page has no page numbers; give a section or specification code');
  } else if (loc.pages.length && !loc.pages.includes(page)) {
    const stated = loc.pages.length === 1 ? 'page' : 'pages';
    problems.push(`quote found on page ${page}, not ${stated} ${loc.pages.join(', ')}`);
  }
  const nearby = text.slice(Math.max(0, at - window), at + needle.length + AFTER_QUOTE);
  for (const code of loc.codes) {
    if (!hasCode(nearby, code)) problems.push(`${code} is not next to the quote`);
  }
  if (!loc.pages.length && !loc.codes.length) {
    problems.push('the location has no page number or specification code to check');
  }
  return {
    found: true,
    page: paged ? page : null,
    locationConfirmed: problems.length === 0,
    reason: problems.length ? problems.join('; ') : null,
  };
}
