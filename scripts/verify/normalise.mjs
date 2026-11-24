// Text normalising for quote checks: makes text from PDFs and web pages comparable with a quote
// copied by hand, without loosening the match (letter case and words must still be exact).

const LIGATURES = {
  '\ufb00': 'ff',
  '\ufb01': 'fi',
  '\ufb02': 'fl',
  '\ufb03': 'ffi',
  '\ufb04': 'ffl',
  '\ufb05': 'st',
  '\ufb06': 'st',
};
const CHARACTERS = [
  [/[\u2018\u2019\u201a\u201b\u2032]/g, "'"],
  [/[\u201c\u201d\u201e\u201f\u2033]/g, '"'],
  [/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, '-'],
  [/[\u00a0\u2007\u202f\u2009\u200a\u2002\u2003]/g, ' '],
  [/\u2026/g, '...'],
];

/**
 * Normalises text for comparison. joinHyphens: join a word split by a hyphen at a line break
 * ("equa-\ntions" becomes "equations"); set false to keep the hyphen ("well-\nknown").
 */
export function normaliseText(text, { joinHyphens = true } = {}) {
  let out = text.normalize('NFKC').replace(/[\ufb00-\ufb06]/g, (c) => LIGATURES[c] ?? c);
  // NFKC already expands most ligatures; the map above covers fonts that bypass it.
  out = out.replace(/\u00ad/g, '').replace(/\u200b|\u200c|\u200d|\ufeff/g, '');
  for (const [pattern, replacement] of CHARACTERS) out = out.replace(pattern, replacement);
  out = out.replace(/(\w)-[ \t]*\r?\n\s*(\w)/g, joinHyphens ? '$1$2' : '$1-$2');
  out = out.replace(/\s+/g, ' ');
  // PDF text often has spaces inside brackets and before punctuation; words are untouched.
  return out
    .replace(/([([]) /g, '$1')
    .replace(/ ([)\],;:.!?])/g, '$1')
    .trim();
}

/** Index of the quote in the normalised source, or -1. Tries both ways of reading line hyphens. */
export function findQuote(quote, source) {
  const needle = normaliseText(quote);
  if (!needle) return -1;
  for (const joinHyphens of [true, false]) {
    const at = normaliseText(source, { joinHyphens }).indexOf(needle);
    if (at >= 0) return at;
  }
  return -1;
}
