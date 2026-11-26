// A hint is a nudge toward the method, never the answer (docs/VERIFICATION.md, "Hints"). This
// refuses a hint that contains the item's final answer: the accepted text (ignoring spaces, case
// and the minus sign used), or for numeric answers any number in the hint, in any form marking
// reads (standard form, mixed number, fraction, decimal with thousands separators), equal to it
// or within 0.5% of it (1/2 for 0.5, 1.333 for 4/3, 640000000 for 6.4 × 10^8), unless the
// question already shows that number written the same way.

import { standardForm, withMinus } from '../../packages/core/src/answer-format.ts';

const MINUS = /[−‒–—﹣－]/g;
// Lower case, one minus sign, single spaces, and no spaces next to symbols ("3n + 2" = "3n+2"),
// so word boundaries survive ("try 3n+2" still has a space before the answer).
const squash = (text) =>
  String(text)
    .replace(MINUS, '-')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*([^a-z0-9\s])\s*/g, '$1')
    .trim();

/** `needle` occurs in `hay` (both squashed) not glued to a letter or digit on either side. */
function containsAnswer(hay, needle) {
  const h = squash(hay);
  const n = squash(needle);
  if (!n) return false;
  for (let at = h.indexOf(n); at !== -1; at = h.indexOf(n, at + 1)) {
    const before = h[at - 1];
    const after = h[at + n.length];
    const glued = (c) => c !== undefined && /[a-z0-9]/.test(c);
    // A leading letter or digit in the answer may not continue a word; a sign may.
    if (!(glued(before) && /[a-z0-9]/.test(n[0])) && !(glued(after) && /[a-z0-9]/.test(n.at(-1)))) {
      return true;
    }
  }
  return false;
}

// Every way a number is written in content and marking: standard form (6.4 × 10^8, 6.4e8), a
// mixed number (1 1/3), a fraction (4/3), and a decimal, with UK thousands separators
// (640,000,000 or 640 000 000). Longest forms first, so 6.4 × 10^8 is never read as 6.4.
const NUMBER = new RegExp(
  [
    String.raw`-?\d+(?:\.\d+)?\s*[×xX*·⋅]\s*10\s*\^\s*\(?\s*-?\d+\s*\)?`,
    String.raw`-?\d+(?:\.\d+)?[eE][+-]?\d+(?![a-z])`,
    String.raw`-?\d+\s+\d+\s*\/\s*\d+`,
    String.raw`-?\d+\s*\/\s*\d+`,
    String.raw`-?\d{1,3}(?:,\d{3})+(?:\.\d+)?`,
    String.raw`-?\d{1,3}(?: \d{3})+(?:\.\d+)?(?![\d/])`,
    String.raw`-?\d+(?:\.\d+)?`,
  ].join('|'),
  'g',
);

/** The value of one written number (see NUMBER), or null. */
function valueOf(text) {
  const t = withMinus(text).trim();
  const sf = standardForm(t.replace(/\s+/g, ' '));
  if (sf) return Number(sf.plain);
  const mixed = /^(-?)(\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(t);
  if (mixed) {
    const size = Number(mixed[2]) + Number(mixed[3]) / Number(mixed[4]);
    return mixed[1] ? -size : size;
  }
  const fraction = /^(-?\d+)\s*\/\s*(\d+)$/.exec(t);
  if (fraction) return Number(fraction[2]) === 0 ? null : Number(fraction[1]) / Number(fraction[2]);
  const plain = t.replace(/[, ]/g, '');
  return /^-?\d+(?:\.\d+)?$/.test(plain) ? Number(plain) : null;
}

/** Every number written in `text`, with its value. */
function numbersIn(text) {
  const numbers = [];
  for (const match of withMinus(String(text)).matchAll(NUMBER)) {
    const value = valueOf(match[0]);
    if (value !== null && Number.isFinite(value)) numbers.push({ text: match[0], value });
  }
  return numbers;
}

const close = (a, b) => a === b || (b !== 0 && Math.abs(a - b) <= Math.abs(b) * 0.005);

/** The texts that would give the answer away, and the numeric value if it is a number. */
function answerOf(item) {
  const { answer = {} } = item;
  switch (item.type) {
    case 'numeric':
      return { texts: [answer.value], value: valueOf(answer.value) ?? undefined };
    case 'short_answer':
      return { texts: answer.accepted ?? [] };
    case 'worked_maths':
      return { texts: [answer.expression, ...(answer.solutions ?? [])].filter(Boolean) };
    case 'multiple_choice':
      return { texts: [item.options?.[answer.option]].filter(Boolean) };
    case 'flashcard':
      return { texts: [item.back].filter(Boolean) };
    default:
      return { texts: [] };
  }
}

/** Problems with an item's hint; empty when it has none or it gives nothing away. */
export function hintErrors(item) {
  if (!item.hint) return [];
  const question = [item.prompt, item.front].filter(Boolean).join(' ');
  const { texts, value } = answerOf(item);
  const given = texts.find((t) => containsAnswer(item.hint, t) && !containsAnswer(question, t));
  if (given !== undefined) return [`hint gives away the answer (${given})`];
  if (value !== undefined) {
    // A number the question already shows, written the same way, gives nothing away; the same
    // value in another form (640000000 for 6.4 × 10^8) is the answer.
    const leak = numbersIn(item.hint).find(
      ({ text, value: n }) => close(n, value) && !containsAnswer(question, text),
    );
    if (leak) return [`hint gives away the answer (${leak.text} equals ${item.answer.value})`];
  }
  return [];
}
