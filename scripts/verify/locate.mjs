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
  match: null,
  confidence: null,
});

const pageAt = (starts, at) => starts.findLastIndex((s) => s <= at) + 1;

/** Copies of the quote in the normalised text (a specification can repeat text). */
function exactMatches(pages, needle) {
  const found = [];
  for (const joinHyphens of [true, false]) {
    const { text, starts } = joinPages(pages, joinHyphens);
    for (let at = text.indexOf(needle); at >= 0; at = text.indexOf(needle, at + 1)) {
      found.push({ text, at, length: needle.length, page: pageAt(starts, at), confidence: 1 });
    }
  }
  return found;
}

const LETTER = /[\p{L}\p{N}]/u;

/**
 * Copies of the quote when everything but letters and digits is ignored on both sides: PDFs
 * split words around superscripts and brackets ("n th"), and drop hyphens at line ends
 * ("position-toterm"). The letters must still match, in order.
 */
function letterMatches(pages, needle) {
  const { text, starts } = joinPages(pages, false);
  const kept = [];
  let letters = '';
  for (let i = 0; i < text.length; i += 1) {
    if (LETTER.test(text[i])) {
      kept.push(i);
      letters += text[i];
    }
  }
  const want = [...needle].filter((ch) => LETTER.test(ch)).join('');
  const found = [];
  if (!want) return found;
  for (let at = letters.indexOf(want); at >= 0; at = letters.indexOf(want, at + 1)) {
    const start = kept[at];
    const length = kept[at + want.length - 1] + 1 - start;
    found.push({ text, at: start, length, page: pageAt(starts, start), confidence: 1 });
  }
  return found;
}

function lcs(a, b) {
  const row = new Array(b.length + 1).fill(0);
  for (const x of a) {
    let diagonal = 0;
    for (let j = 1; j <= b.length; j += 1) {
      const above = row[j];
      row[j] = x === b[j - 1] ? diagonal + 1 : Math.max(row[j], row[j - 1]);
      diagonal = above;
    }
  }
  return row[b.length];
}

function coversAll(window, wanted) {
  const counts = new Map();
  for (const w of window) counts.set(w, (counts.get(w) ?? 0) + 1);
  for (const w of wanted) {
    if (!counts.get(w)) return false;
    counts.set(w, counts.get(w) - 1);
  }
  return true;
}

export const MIN_WORD_CONFIDENCE = 0.5;

/**
 * Copies of the quote as a sequence of words, allowing a few inserted fragments ("Y", "1") and
 * some reordering (formulas split across lines). Every word of the quote must appear within a
 * window only slightly longer than the quote. confidence: the share of the quote's words that
 * appear in the same order.
 */
function wordMatches(pages, needle) {
  const { text, starts } = joinPages(pages, false);
  const tokens = [...text.matchAll(/[\p{L}\p{N}]+/gu)].map((m) => ({
    word: m[0],
    at: m.index,
    end: m.index + m[0].length,
  }));
  const wanted = [...needle.matchAll(/[\p{L}\p{N}]+/gu)].map((m) => m[0]);
  if (wanted.length === 0) return [];
  const slack = Math.max(5, Math.ceil(wanted.length / 2));
  const size = wanted.length + slack;
  const occurrences = (w) => tokens.filter((t) => t.word === w).length;
  const counts = wanted.map(occurrences);
  if (counts.some((n) => n === 0)) return [];
  const anchorIndex = counts.indexOf(Math.min(...counts));
  const anchor = wanted[anchorIndex];
  const found = [];
  tokens.forEach((t, i) => {
    if (t.word !== anchor) return;
    let best = null;
    for (let start = Math.max(0, i - size + 1); start <= i; start += 1) {
      const window = tokens.slice(start, start + size);
      const words = window.map((w) => w.word);
      if (!coversAll(words, wanted)) continue;
      const confidence = lcs(wanted, words) / wanted.length;
      if (!best || confidence > best.confidence) {
        const used = window.filter((w) => wanted.includes(w.word));
        best = { first: used[0], last: used.at(-1), confidence };
      }
    }
    if (best && best.confidence >= MIN_WORD_CONFIDENCE) {
      const at = best.first.at;
      found.push({
        text,
        at,
        length: best.last.end - at,
        page: pageAt(starts, at),
        confidence: best.confidence,
      });
    }
  });
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
 * { found, page, locationConfirmed, reason, match, confidence } for a citation ({ quote, location }) in a source.
 * pages: text of each page. paged: false for web pages (no page numbers). window: how many
 * characters before the quote to look for the nearest specification code. labels: the printed page number
 * of each page (a "page N" location may use either the PDF page or the printed page number).
 * match: 'exact', or a near match ('letters' or 'words') that a person must confirm.
 */
export function locateQuote(
  { quote, location },
  pages,
  { paged = true, window = 1500, labels = [] } = {},
) {
  const needle = normaliseText(quote);
  if (!needle) return notFound('the citation has no quote');
  const loc = parseLocation(location);
  // Strictest first; a looser level is a near match that a person must confirm.
  const levels = [
    ['exact', () => exactMatches(pages, needle)],
    ['letters', () => letterMatches(pages, needle)],
    ['words', () => wordMatches(pages, needle)],
  ];
  let match = null;
  let matches = [];
  for (const [level, find] of levels) {
    matches = find();
    if (matches.length) {
      match = level;
      break;
    }
  }
  if (!match) return notFound('quote not found in the source');

  const checks = matches.map((m) => ({
    ...m,
    problems: locationProblems(m, loc, { paged, window, labels }),
  }));
  const { page, problems, confidence } = checks.find((c) => c.problems.length === 0) ?? checks[0];
  return {
    found: true,
    page: paged ? page : null,
    locationConfirmed: problems.length === 0,
    reason: problems.length ? problems.join('; ') : null,
    match,
    confidence: Math.round(confidence * 100) / 100,
  };
}
