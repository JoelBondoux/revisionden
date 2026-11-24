// Finds a citation's quote in a source's pages and confirms it sits at the stated location.
import { normaliseText } from './normalise.mjs';

const PAGE_PHRASE = /\b(?:pages?|pp?\.?)\s*(\d+)(?:\s*[-\u2013\u2014]\s*(\d+))?/gi;
const CODE = /(?<![A-Za-z0-9.])([A-Z]{1,3}\d+[a-z]?|\d+(?:\.\d+)+[a-z]?)(?![A-Za-z0-9]|\.\d)/g;

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

const isSection = (code) => /^\d/.test(code);
const sameShape = (a, b) => isSection(a) === isSection(b);
// A section code also covers its subsections (4.2.1 covers 4.2.1.3); a letter code must match.
const covers = (stated, found) =>
  found === stated || (isSection(stated) && found.startsWith(`${stated}.`));

/** null when the code is next to the quote, else the reason it is not. */
function codeProblem(code, before, quoted) {
  if ([...quoted.matchAll(CODE)].some((m) => covers(code, m[1]))) return null;
  const nearest = [...before.matchAll(CODE)].map((m) => m[1]).findLast((c) => sameShape(c, code));
  if (nearest && covers(code, nearest)) return null;
  return nearest
    ? `the nearest code before the quote is ${nearest}, not ${code}`
    : `${code} does not appear before the quote`;
}

const notFound = (reason) => ({
  found: false,
  page: null,
  locationConfirmed: false,
  reason,
  spacingIgnored: false,
});

/**
 * Copies of the quote when spaces are ignored on both sides: PDFs split words around
 * superscripts and brackets ("n th", "variable (s)"). The letters must still match in order.
 */
function spacelessMatches(pages, needle) {
  const { text, starts } = joinPages(pages, true);
  const kept = [];
  let tight = '';
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] !== ' ') {
      kept.push(i);
      tight += text[i];
    }
  }
  const want = needle.replace(/ /g, '');
  const found = [];
  for (let at = tight.indexOf(want); at >= 0; at = tight.indexOf(want, at + 1)) {
    const start = kept[at];
    const length = kept[at + want.length - 1] + 1 - start;
    found.push({ text, at: start, length, page: starts.findLastIndex((s) => s <= start) + 1 });
  }
  return found;
}

function locationProblems({ text, at, page, length }, loc, { paged, window, labels }) {
  const problems = [];
  if (loc.pages.length && !paged) {
    problems.push('a web page has no page numbers; give a section or specification code');
  } else if (loc.pages.length) {
    const printed = labels[page - 1] ?? null;
    const onPage = loc.pages.includes(page) || (printed && loc.pages.includes(Number(printed)));
    if (!onPage) {
      const stated = loc.pages.length === 1 ? 'page' : 'pages';
      const where = printed ? `page ${page} (printed page ${printed})` : `page ${page}`;
      problems.push(`quote found on ${where}, not ${stated} ${loc.pages.join(', ')}`);
    }
  }
  const before = text.slice(Math.max(0, at - window), at);
  const quoted = text.slice(at, at + length);
  for (const code of loc.codes) {
    const problem = codeProblem(code, before, quoted);
    if (problem) problems.push(problem);
  }
  if (!loc.pages.length && !loc.codes.length) {
    problems.push('the location has no page number or specification code to check');
  }
  return problems;
}

/**
 * { found, page, locationConfirmed, reason, spacingIgnored } for a citation ({ quote, location }) in a source.
 * pages: text of each page. paged: false for web pages (no page numbers). window: how many
 * characters before the quote to look for the nearest specification code. labels: the printed page number
 * of each page (a "page N" location may use either the PDF page or the printed page number).
 */
export function locateQuote(
  { quote, location },
  pages,
  { paged = true, window = 1500, labels = [] } = {},
) {
  const needle = normaliseText(quote);
  if (!needle) return notFound('the citation has no quote');
  const loc = parseLocation(location);
  // Every copy of the quote (a specification can repeat text, e.g. Foundation and Higher tiers).
  const matches = [];
  for (const joinHyphens of [true, false]) {
    const { text, starts } = joinPages(pages, joinHyphens);
    for (let at = text.indexOf(needle); at >= 0; at = text.indexOf(needle, at + 1)) {
      const page = starts.findLastIndex((s) => s <= at) + 1;
      matches.push({ text, at, length: needle.length, page });
    }
  }
  const spacingIgnored = matches.length === 0;
  if (spacingIgnored) matches.push(...spacelessMatches(pages, needle));
  if (matches.length === 0) return notFound('quote not found in the source');

  const checks = matches.map((m) => ({
    ...m,
    problems: locationProblems(m, loc, { paged, window, labels }),
  }));
  const { page, problems } = checks.find((c) => c.problems.length === 0) ?? checks[0];
  return {
    found: true,
    page: paged ? page : null,
    locationConfirmed: problems.length === 0,
    reason: problems.length ? problems.join('; ') : null,
    spacingIgnored,
  };
}
