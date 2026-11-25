import { describe, expect, it } from 'vitest';
import {
  LINK_CODE_ALPHABET,
  LINK_CODE_LENGTH,
  formatLinkCode,
  linkCodeFromBytes,
  normaliseLinkCode,
} from './link-code';

describe('link codes', () => {
  it('are 8 characters with no look-alike characters', () => {
    expect(LINK_CODE_LENGTH).toBe(8);
    for (const lookAlike of ['0', 'O', '1', 'I', 'L']) {
      expect(LINK_CODE_ALPHABET).not.toContain(lookAlike);
    }
  });

  it('are made from random bytes, one character per byte', () => {
    const code = linkCodeFromBytes(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]));
    expect(code).toBe(LINK_CODE_ALPHABET.slice(0, 8));
    expect(code).toMatch(new RegExp(`^[${LINK_CODE_ALPHABET}]{8}$`));
  });

  it('use every byte value without going out of range', () => {
    const code = linkCodeFromBytes(new Uint8Array(8).fill(255));
    expect(code).toHaveLength(8);
    expect([...code].every((ch) => LINK_CODE_ALPHABET.includes(ch))).toBe(true);
  });

  it('are shown in two groups of four', () => {
    expect(formatLinkCode('ABCDEFGH')).toBe('ABCD-EFGH');
  });

  it('accept what a child types: any case, spaces or a dash', () => {
    expect(normaliseLinkCode('abcd-efgh')).toBe('ABCDEFGH');
    expect(normaliseLinkCode(' ab cd ef gh ')).toBe('ABCDEFGH');
  });

  it('reject codes of the wrong length or with characters never used', () => {
    expect(normaliseLinkCode('ABCDEFG')).toBeNull();
    expect(normaliseLinkCode('ABCDEFGO')).toBeNull();
    expect(normaliseLinkCode('ABCD!FGH')).toBeNull();
  });
});
