/**
 * Short device-link codes a child can type at /link when the camera or link is awkward
 * (docs/PRODUCT_RULES.md "Linking a device"). 8 characters from an alphabet with no look-alikes
 * (no 0/O, 1/I/L). Stored only as a hash, like the link token itself.
 */
export const LINK_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const LINK_CODE_LENGTH = 8;

/** One character per random byte (31 characters: about 40 bits of randomness per code). */
export function linkCodeFromBytes(bytes: Uint8Array): string {
  return Array.from(bytes.slice(0, LINK_CODE_LENGTH), (b) => LINK_CODE_ALPHABET[b % 31]).join('');
}

/** "ABCDEFGH" → "ABCD-EFGH", easier to read out and type. */
export function formatLinkCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/** What a child typed → the stored form, or null if it cannot be a code. */
export function normaliseLinkCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s-]/g, '');
  if (code.length !== LINK_CODE_LENGTH) return null;
  return [...code].every((ch) => LINK_CODE_ALPHABET.includes(ch)) ? code : null;
}
