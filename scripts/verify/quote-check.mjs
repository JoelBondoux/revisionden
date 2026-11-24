// Pipeline step 2 (docs/VERIFICATION.md): every quote must be found in the cited official source
// at the stated location. Fetches the source, extracts its text and records the result.
import { extractText } from './extract.mjs';
import { locateQuote } from './locate.mjs';
import { assertWritable, entriesOf, leavesOf, stamp, withCheck } from './record.mjs';

export const QUOTE_CHECK_TOOL = { name: 'revisionden-quote-check', version: '1.0.0' };

const extracted = new WeakMap();
async function pagesOf(source) {
  if (!extracted.has(source.bytes)) {
    extracted.set(source.bytes, extractText(source.bytes, source.contentType));
  }
  return extracted.get(source.bytes);
}

/**
 * { result, url, page, sha256, reason, match, confidence } for one citation. result: 'pass'
 * (exact quote at its location), 'near' (found only by a looser match, so a reviewer must confirm
 * it) or 'fail'. store: see sources.mjs.
 */
export async function checkCitation(citation, store) {
  const base = { url: citation.url, page: null, sha256: null };
  if (!citation.quote) return { ...base, result: 'fail', reason: 'the citation has no quote yet' };
  let source;
  let text;
  try {
    source = await store.get(citation.url);
    text = await pagesOf(source);
  } catch (err) {
    return { ...base, result: 'fail', reason: err.message };
  }
  const found = locateQuote(citation, text.pages, {
    paged: text.kind === 'pdf',
    labels: text.labels,
  });
  return {
    ...base,
    sha256: source.sha256,
    page: found.page,
    result:
      !found.found || !found.locationConfirmed ? 'fail' : found.match === 'exact' ? 'pass' : 'near',
    reason: found.reason,
    match: found.match,
    confidence: found.confidence,
  };
}

function describe(results) {
  return results
    .map((r, i) => {
      const where = r.page ? `found on page ${r.page}` : 'found';
      const near = `near match (${r.match}, confidence ${r.confidence?.toFixed(2)}): a reviewer must confirm it`;
      const what = { pass: where, near: `${where}; ${near}`, fail: r.reason }[r.result];
      return `citation ${i + 1}: ${what}${r.sha256 ? ` (sha256 ${r.sha256})` : ''}`;
    })
    .join('; ');
}

/**
 * Quote-checks every item, topic tree, mark scheme and diagram (or only one id).
 * Returns one result per piece of content with its quote-check record entry.
 */
export async function quoteCheckContent(content, { store, now = () => new Date(), only } = {}) {
  const results = [];
  for (const { kind, file, data, citations } of entriesOf(content, { only })) {
    const checked = [];
    for (const c of citations) checked.push(await checkCitation(c, store));
    // A near match never passes on its own: a reviewer confirms it (docs/VERIFICATION.md).
    const result = checked.length && checked.every((r) => r.result === 'pass') ? 'pass' : 'fail';
    results.push({
      id: data.id,
      kind,
      file,
      result,
      citations: checked,
      check: {
        name: 'quote-check',
        result,
        tool: QUOTE_CHECK_TOOL.name,
        tool_version: QUOTE_CHECK_TOOL.version,
        at: stamp(now()),
        notes: describe(checked) || 'no citations',
      },
    });
  }
  return results;
}

/** A copy of draft content with the quote-check result and each source's SHA-256 recorded. */
export function applyQuoteCheck(data, result) {
  assertWritable(data);
  let n = 0;
  const hashed = (c) => {
    const sha256 = result.citations[n++]?.sha256;
    return sha256 ? { ...c, sha256 } : c;
  };
  let copy;
  if (data.topics) {
    copy = structuredClone(data);
    for (const leaf of leavesOf(copy)) leaf.citations = leaf.citations.map(hashed);
  } else {
    copy = { ...data, citations: data.citations.map(hashed) };
  }
  return withCheck(copy, result.check);
}
