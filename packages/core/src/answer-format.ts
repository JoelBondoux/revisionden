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

/** A rounded answer: written to the asked accuracy, with the same value as the key. */
export function meetsRounding(given: string, expected: string, rounding: Rounding): boolean {
  if (!showsRounding(given, rounding)) return false;
  const a = Number(given.trim());
  const b = Number(expected.trim());
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));
}
