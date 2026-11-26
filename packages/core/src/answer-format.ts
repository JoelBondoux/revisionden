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

// A UK thousands separator: a space (also thin or non-breaking) or a comma, between groups of
// exactly three digits, and the same one throughout, as in "38 700" or "1,234,567.5".
const GROUPED = /^-?\d{1,3}(?:([ \u00a0\u2009\u202f,])\d{3})(?:\1\d{3})*(?:\.\d+)?$/;

/** A number written with thousands separators, without them ("38 700" -> "38700"), else `text`. */
export function withoutThousands(text: string): string {
  const trimmed = text.trim();
  return GROUPED.test(trimmed) ? trimmed.replace(/[ \u00a0\u2009\u202f,]/g, '') : text;
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
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text.trim());
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
