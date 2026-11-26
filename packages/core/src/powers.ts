/**
 * Powers shown as superscripts (workstream F9, owner 2026-11-26; docs/PRODUCT_RULES.md "Showing
 * maths"). Children know x², not "x^2", so wherever maths is shown, `^` and what it raises
 * become a superscript. Stored content is unchanged; this is display only.
 *
 * - `^` raises a whole number or decimal, a single letter, or either with a minus sign
 *   (`10^-3`), or a bracket, shown without its brackets (`10^(2 + 8)` → 10²⁺⁸).
 * - Only the power is raised: `x^2y` is x²y.
 * - `a^b^c` is a to the power b^c (right to left, as in maths).
 * - A `^` with nothing it can raise (`Press ^`, `x^`, an unclosed bracket) stays as it is.
 * - Computing subjects keep `^`, a real symbol there (owner): see `showsPowers`.
 */

export type PowerPart = { kind: 'text'; text: string } | { kind: 'sup'; parts: PowerPart[] };

const ATOM = /^[-−]?(?:\d+(?:\.\d+)?|[A-Za-z])/;

/** True when the text has a power that would be shown as a superscript. */
export function hasPowers(text: string): boolean {
  return parsePowers(text).some((p) => p.kind === 'sup');
}

/** False for computing subjects (by subject or topic id), where `^` is shown as typed. */
export function showsPowers(subjectOrTopicId: string | undefined): boolean {
  return !/comput/.test(subjectOrTopicId ?? '');
}

/** Splits text into plain parts and raised (superscript) parts, which may nest. */
export function parsePowers(text: string): PowerPart[] {
  const parts: PowerPart[] = [];
  let plain = '';
  let i = 0;
  while (i < text.length) {
    const raised = text[i] === '^' ? exponent(text, i + 1) : null;
    if (!raised) {
      plain += text[i];
      i++;
      continue;
    }
    if (plain) parts.push({ kind: 'text', text: plain });
    plain = '';
    parts.push({ kind: 'sup', parts: raised.parts });
    i = raised.end;
  }
  if (plain || parts.length === 0) parts.push({ kind: 'text', text: plain });
  return parts;
}

/** The power that starts at `start` (just after a `^`), or null when there is none. */
function exponent(text: string, start: number): { parts: PowerPart[]; end: number } | null {
  if (text[start] === '(') {
    const close = closing(text, start);
    if (close < 0) return null;
    return { parts: parsePowers(text.slice(start + 1, close)), end: close + 1 };
  }
  const atom = ATOM.exec(text.slice(start));
  if (!atom) return null;
  const end = start + atom[0].length;
  // a^b^c: the power has its own power.
  const nested = text[end] === '^' ? exponent(text, end + 1) : null;
  if (!nested) return { parts: [{ kind: 'text', text: atom[0] }], end };
  return {
    parts: [
      { kind: 'text', text: atom[0] },
      { kind: 'sup', parts: nested.parts },
    ],
    end: nested.end,
  };
}

function closing(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')' && --depth === 0) return i;
  }
  return -1;
}
