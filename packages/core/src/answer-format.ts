// How an answer is written (docs/VERIFICATION.md, "Answer format"): an answer may state its
// subject ("t = ...", "f^-1(x) = ..."), and a rounded answer must be written to the accuracy the
// question asks for. Used by marking (learning.ts), content validation and the blind check.

const squash = (text: string) => text.replace(/\s+/g, '');

/** The right-hand side when `answer` reads "<subject> = RHS" (spaces ignored), else `answer`. */
export function withoutSubject(answer: string, subject: string | undefined): string {
  if (!subject) return answer;
  const parts = answer.split('=');
  if (parts.length !== 2) return answer;
  const [left, right] = parts as [string, string];
  if (squash(left) !== squash(subject) || right.trim() === '') return answer;
  return right.trim();
}

/** The unicode minus and the dashes people type for one (−, –, —, ‒) as a plain "-". */
export const withMinus = (text: string): string => text.replace(/[−–—‒]/g, '-');

// Other spellings of the units content uses: symbols before the number (£) and words or
// symbols after it. The unit as written always counts, with ^2 and ^3 as ² and ³ too.
const UNIT_SPELLINGS: Record<string, { before?: string[]; after?: string[] }> = {
  '£': { before: ['£'], after: ['pounds', 'pound'] },
  pounds: { before: ['£'], after: ['pounds', 'pound'] },
  pence: { after: ['p', 'pence', 'penny'] },
  p: { after: ['p', 'pence', 'penny'] },
  mm: { after: ['mm', 'millimetres', 'millimetre', 'millimeters', 'millimeter'] },
  cm: { after: ['cm', 'centimetres', 'centimetre', 'centimeters', 'centimeter'] },
  m: { after: ['m', 'metres', 'metre', 'meters', 'meter'] },
  km: { after: ['km', 'kilometres', 'kilometre', 'kilometers', 'kilometer'] },
  g: { after: ['g', 'grams', 'gram'] },
  kg: { after: ['kg', 'kilograms', 'kilogram'] },
  s: { after: ['s', 'seconds', 'second', 'secs', 'sec'] },
  seconds: { after: ['s', 'seconds', 'second', 'secs', 'sec'] },
  minutes: { after: ['minutes', 'minute', 'mins', 'min'] },
  hours: { after: ['hours', 'hour', 'hrs', 'hr', 'h'] },
  'km/h': { after: ['km/h', 'kph', 'km per hour'] },
  'm/s': { after: ['m/s', 'metres per second'] },
};

const POWERS: [string, string][] = [
  ['^2', '²'],
  ['^3', '³'],
];
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/**
 * `text` without the item's own unit ("15 m" -> "15", "£9600" -> "9600", "28.3 cm²" -> "28.3"),
 * or `text` unchanged. A different unit is left in place, so the answer stays wrong.
 */
export function withoutUnit(text: string, unit: string | undefined): string {
  if (!unit) return text;
  const trimmed = text.trim();
  const known = UNIT_SPELLINGS[unit.trim().toLowerCase()] ?? {};
  for (const before of known.before ?? []) {
    if (trimmed.startsWith(before)) return trimmed.slice(before.length).trim();
  }
  const written = unit.trim();
  const spellings = new Set([written, ...(known.after ?? [])]);
  for (const [caret, superscript] of POWERS) {
    for (const spelling of [...spellings]) {
      spellings.add(spelling.replace(caret, superscript)).add(spelling.replace(superscript, caret));
    }
  }
  // Longest first, so "cm" is tried before "m"; words ignore case, symbols do not.
  for (const spelling of [...spellings].sort((a, b) => b.length - a.length)) {
    const flags = /^[a-z ]{3,}$/i.test(spelling) ? 'i' : '';
    const m = new RegExp(`^(.*[\\d)])\\s*${escape(spelling)}$`, flags).exec(trimmed);
    if (m) return m[1]!.trim();
  }
  return text;
}

const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? a : gcd(b, a % b));

/**
 * Whether `text` is in its simplest form, as GCSE marks "give your answer in its simplest form":
 * a whole number, a fraction in lowest terms (23/33, 49/20) or a mixed number whose fraction is
 * proper and in lowest terms (2 9/20). An unsimplified fraction (69/99), n/1 or a decimal is not.
 */
export function simplestForm(text: string): boolean {
  const t = withMinus(text).trim();
  if (/^-?\d+$/.test(t)) return true;
  const m = /^-?(?:(\d+)\s+)?(\d+)\/(\d+)$/.exec(t);
  if (!m) return false;
  const top = BigInt(m[2]!);
  const bottom = BigInt(m[3]!);
  if (bottom < 2n || top === 0n || gcd(top, bottom) !== 1n) return false;
  return m[1] === undefined || top < bottom;
}

// A UK thousands separator: a space (also thin or non-breaking) or a comma, between groups of
// exactly three digits, and the same one throughout, as in "38 700" or "1,234,567.5".
const GROUPED = /^-?\d{1,3}(?:([ \u00a0\u2009\u202f,])\d{3})(?:\1\d{3})*(?:\.\d+)?$/;

/** A number written with thousands separators, without them ("38 700" -> "38700"), else `text`. */
export function withoutThousands(text: string): string {
  const trimmed = text.trim();
  return GROUPED.test(trimmed) ? trimmed.replace(/[ \u00a0\u2009\u202f,]/g, '') : text;
}

// Standard form, a × 10^n: the multiply sign may be ×, x, X, *, · or ⋅, the power ^n, ^(n) or
// superscript digits; e-notation (6.4e8) is the same number. Read exactly, never through floats.
const STANDARD =
  /^(-?\d+(?:\.\d+)?)\s*[×xX*·⋅]\s*10\s*(?:\^\s*(\(\s*[-−]?\d+\s*\)|[-−]?\d+)|([⁻]?[⁰¹²³⁴-⁹]+))$/;
const E_NOTATION = /^(-?\d+(?:\.\d+)?)[eE]([+-]?\d+)$/;
const SUPERSCRIPT: Record<string, string> = {
  '⁻': '-',
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

/** The largest power of ten standard form is read with, either way (10^100 and 10^-100). */
export const MAX_POWER = 100;

export interface StandardForm {
  /** The same number as a plain decimal, keeping the digits shown ("3.20e-4" -> "0.000320"). */
  plain: string;
  /** Significant figures of the number in front. */
  figures: number;
  /** Whether the number in front is at least 1 and less than 10. */
  proper: boolean;
}

/** A number written as a × 10^n (or a e n), or null when the text is not one. */
export function standardForm(text: string): StandardForm | null {
  const trimmed = text.trim();
  let mantissa: string;
  let power: string;
  const sf = STANDARD.exec(trimmed);
  if (sf) {
    mantissa = sf[1]!;
    power = sf[2]
      ? sf[2].replace(/[()\s]/g, '').replace('−', '-')
      : [...sf[3]!].map((c) => SUPERSCRIPT[c]).join('');
  } else {
    const e = E_NOTATION.exec(trimmed);
    if (!e) return null;
    mantissa = e[1]!;
    power = e[2]!;
  }
  // A power beyond ±100 is no school answer, and expanding it would build a huge string.
  const exponent = Number(power);
  if (!Number.isInteger(exponent) || Math.abs(exponent) > MAX_POWER) return null;
  const negative = mantissa.startsWith('-');
  const [whole = '', fraction = ''] = mantissa.replace('-', '').split('.');
  const digits = whole + fraction;
  const point = whole.length + exponent;
  let plain: string;
  if (point <= 0) plain = `0.${'0'.repeat(-point)}${digits}`;
  else if (point >= digits.length) plain = digits + '0'.repeat(point - digits.length);
  else plain = `${digits.slice(0, point)}.${digits.slice(point)}`;
  plain = plain.replace(/^0+(?=\d)/, '');
  const size = Math.abs(Number(mantissa));
  return {
    plain: negative ? `-${plain}` : plain,
    figures: Math.max(digits.replace(/^0+/, '').length, 1),
    proper: size >= 1 && size < 10,
  };
}

export interface Rounding {
  decimal_places?: number;
  significant_figures?: number;
}

export interface ShownPrecision {
  decimalPlaces: number;
  /** Fewest and most significant figures the text can be read as (4500: 2 to 4). */
  figures: [number, number];
}

const PLAIN_DECIMAL = /^-?(\d+)(?:\.(\d+))?$/;

/** The accuracy a plain decimal is written to, or null when the text is not one. */
export function shownPrecision(text: string): ShownPrecision | null {
  const sf = standardForm(text);
  if (sf) {
    // The number in front shows the significant figures: 6.40 × 10^8 is exactly 3.
    const plain = shownPrecision(sf.plain);
    return plain && { decimalPlaces: plain.decimalPlaces, figures: [sf.figures, sf.figures] };
  }
  const m = PLAIN_DECIMAL.exec(text.trim());
  if (!m) return null;
  const whole = m[1] ?? '';
  const fraction = m[2] ?? '';
  const digits = (whole + fraction).replace(/^0+/, '');
  if (fraction) return { decimalPlaces: fraction.length, figures: [digits.length, digits.length] };
  const fewest = digits.replace(/0+$/, '').length;
  return { decimalPlaces: 0, figures: [Math.max(fewest, 1), Math.max(digits.length, 1)] };
}

/** The rounding an answer key asks for, or null when it asks for none. */
export function roundingOf(key: Rounding): Rounding | null {
  if (key.decimal_places !== undefined) return { decimal_places: key.decimal_places };
  if (key.significant_figures !== undefined) {
    return { significant_figures: key.significant_figures };
  }
  return null;
}

/** Whether `text` is written to the asked accuracy (ignoring its value). */
export function showsRounding(text: string, rounding: Rounding): boolean {
  const shown = shownPrecision(text);
  if (!shown) return false;
  if (rounding.decimal_places !== undefined) return shown.decimalPlaces === rounding.decimal_places;
  const want = rounding.significant_figures ?? 0;
  return shown.figures[0] <= want && want <= shown.figures[1];
}

/** A plain decimal as an exact scaled integer (digits, places), or null. */
function exactDecimal(text: string): { digits: bigint; places: number } | null {
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec((standardForm(text)?.plain ?? text).trim());
  if (!m) return null;
  const fraction = m[3] ?? '';
  const digits = BigInt(`${m[2]}${fraction}`);
  return { digits: m[1] ? -digits : digits, places: fraction.length };
}

/** Whether two plain decimals have exactly the same value (no floating-point tolerance). */
function sameDecimal(a: string, b: string): boolean {
  const x = exactDecimal(a);
  const y = exactDecimal(b);
  if (!x || !y) return false;
  const places = Math.max(x.places, y.places);
  const scale = (d: { digits: bigint; places: number }) =>
    d.digits * 10n ** BigInt(places - d.places);
  return scale(x) === scale(y);
}

/** A rounded answer: written to the asked accuracy, with exactly the key's value. */
export function meetsRounding(given: string, expected: string, rounding: Rounding): boolean {
  return showsRounding(given, rounding) && sameDecimal(given, expected);
}
