/*
 * W21: which painted-text readings are findings (decision 0012). Text too faint to sample is a
 * failure, not a skip. The painted helper already leaves out, for provable reasons, text with no
 * size (under 4px either way), off screen, clipped away by an overflow box, hidden (visibility or
 * opacity) or covered by something else; the one exclusion made here is a decorative emoji (a
 * picture, not text; lead ruling 2026-11-26).
 */

/** True when a line from paintedTextFailures is a decorative emoji alone (quoted, no letters). */
export function isDecorativeEmoji(line: string): boolean {
  const quoted = /^"([^"]*)"/.exec(line)?.[1];
  if (quoted === undefined) return false;
  return !/[\p{L}\p{N}]/u.test(quoted) && /\p{Extended_Pictographic}/u.test(quoted);
}

/** The painted-text readings that are findings: everything except decorative emoji. */
export function paintedTextFindings(lines: readonly string[]): string[] {
  return lines.filter((line) => !isDecorativeEmoji(line));
}
