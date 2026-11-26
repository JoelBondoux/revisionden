/**
 * Fairer marking of typed short answers (workstream F6; docs/PRODUCT_RULES.md "Marking typed
 * answers"). Two answers match when they are the same after these safe rules:
 *
 * - Word answers: case and extra spaces are ignored (one space between words).
 * - Maths answers (anything with a digit or a maths sign): all spaces and case are ignored;
 *   the unicode minus and dashes are a minus; ×, ·, * (and x between two numbers) are one
 *   multiply sign, dropped unless it sits between two numbers; ÷ is /; superscripts are ^;
 *   ≤ and ≥ are <= and >=; √, sqrt and sqrt( ) are the same; "and" and ; separate a list like ,.
 * - Only when the item says order does not matter (`any_order`): products and sums may be
 *   written in any order (signs stay with their terms), a list of values in any order, and an
 *   equation either way round. Coordinates in brackets and inequalities are never reordered.
 * - Optional units (`units`): the answer may end with one of the item's units, or leave it off.
 */

export interface AnswerOptions {
  /** Order does not matter: commuted products and sums, reordered lists, swapped = sides. */
  anyOrder?: boolean;
  /** Units the answer may end with (or leave off), for example ['cm']. */
  units?: readonly string[];
}

const MATHS = /[0-9=<>≤≥^()+\-−–—*/×÷·⋅√²³¹⁰⁴-⁹,]/;
const SUPERSCRIPTS: Record<string, string> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
};

const words = (text: string) => text.trim().toLowerCase().replace(/\s+/g, ' ');

function withoutUnit(text: string, units: readonly string[] | undefined): string {
  for (const unit of units ?? []) {
    const u = unit.toLowerCase().replace(/\s+/g, '');
    if (u && text.endsWith(u) && text.length > u.length) return text.slice(0, -u.length);
  }
  return text;
}

/** One written form of an answer; equal forms mean equal answers (see the rules above). */
export function normaliseAnswer(text: string, options: AnswerOptions = {}): string {
  if (!MATHS.test(text)) return words(text);
  let s = text
    .toLowerCase()
    .replace(/[−–—‒]/g, '-')
    .replace(/[⁰¹²³⁴-⁹]+/g, (run) => `^${[...run].map((c) => SUPERSCRIPTS[c]).join('')}`)
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/÷/g, '/')
    .replace(/[×·⋅]/g, '*')
    .replace(/√/g, 'sqrt')
    .replace(/(\d)\s+x\s+(?=\d)/g, '$1*')
    .replace(/\s+and\s+/g, ',')
    .replace(/\s+/g, '')
    .replace(/(\d)and(?=[a-z])/g, '$1,')
    .replace(/;/g, ',')
    .replace(/sqrt\(([a-z0-9.]+)\)/g, 'sqrt$1')
    .replace(/\*/g, (sign, at: number, all: string) =>
      /\d/.test(all[at - 1] ?? '') && /\d/.test(all[at + 1] ?? '') ? sign : '',
    );
  s = withoutUnit(s, options.units);
  return options.anyOrder ? anyOrder(s) : s;
}

/** True when two typed answers are the same answer under the rules above. */
export function sameAnswer(expected: string, given: string, options: AnswerOptions = {}): boolean {
  if (!MATHS.test(expected) && !MATHS.test(given)) return words(expected) === words(given);
  return normaliseAnswer(expected, options) === normaliseAnswer(given, options);
}

// ---------------------------------------------------------------------------------------------
// Any order: a canonical form with lists, sums and products sorted
// ---------------------------------------------------------------------------------------------

/** Splits at `separators` outside brackets. */
function splitTop(s: string, at: (s: string, i: number) => boolean): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (depth === 0 && at(s, i)) {
      parts.push(s.slice(start, i));
      start = i;
    }
  }
  parts.push(s.slice(start));
  return parts;
}

function anyOrder(s: string): string {
  const parts = splitTop(s, (t, i) => t[i] === ',').map((p, i) => (i === 0 ? p : p.slice(1)));
  return parts.map(relation).sort().join(',');
}

function relation(s: string): string {
  const match = /<=|>=|=|<|>/.exec(s);
  if (!match) return sum(s);
  const op = match[0];
  const left = s.slice(0, match.index);
  const right = s.slice(match.index + op.length);
  if (/<|>|=/.test(right)) return s;
  const sides = [sum(left), sum(right)];
  if (op === '=') sides.sort();
  return sides.join(op);
}

function sum(s: string): string {
  if (s === '') return s;
  const terms = splitTop(
    s,
    (t, i) => (t[i] === '+' || t[i] === '-') && i > 0 && !/[\^*/(]/.test(t[i - 1]!),
  ).map((term) => (term.startsWith('+') || term.startsWith('-') ? term : `+${term}`));
  return terms
    .map((term) => term[0]! + product(term.slice(1)))
    .sort()
    .join('');
}

const ATOM = /^(\d+(?:\.\d+)?|sqrt(?:\d+(?:\.\d+)?|[a-z])|[a-z])/;

/** The factors of a term, sorted; the term unchanged when it is not a plain product. */
function product(term: string): string {
  if (term.includes('/')) return term;
  const factors: string[] = [];
  let rest = term;
  while (rest !== '') {
    let factor: string;
    if (rest.startsWith('(')) {
      const close = closing(rest);
      if (close < 0) return term;
      factor = `(${sum(rest.slice(1, close))})`;
      rest = rest.slice(close + 1);
    } else {
      const atom = ATOM.exec(rest);
      if (!atom) return term;
      factor = atom[0];
      rest = rest.slice(factor.length);
    }
    const power = /^\^(\d+|[a-z]|\([^()]*\))/.exec(rest);
    if (power) {
      factor += power[0];
      rest = rest.slice(power[0].length);
    }
    factors.push(factor);
  }
  // A separator no answer contains, so that sorted numbers never join into a new number.
  return factors.sort().join('·');
}

function closing(s: string): number {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')' && --depth === 0) return i;
  }
  return -1;
}
