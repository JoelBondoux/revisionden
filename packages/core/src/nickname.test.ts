import { describe, expect, it } from 'vitest';
import { validateNickname } from './nickname';

describe('validateNickname', () => {
  it('accepts letters, numbers and underscores between 2 and 16 characters', () => {
    expect(validateNickname('Fox_42')).toEqual({ ok: true, nickname: 'Fox_42' });
    expect(validateNickname('ab')).toEqual({ ok: true, nickname: 'ab' });
    expect(validateNickname('a'.repeat(16))).toEqual({ ok: true, nickname: 'a'.repeat(16) });
  });

  it('rejects nicknames shorter than 2 characters', () => {
    expect(validateNickname('a')).toEqual({ ok: false, reason: 'too_short' });
    expect(validateNickname('')).toEqual({ ok: false, reason: 'too_short' });
  });

  it('rejects nicknames longer than 16 characters', () => {
    expect(validateNickname('a'.repeat(17))).toEqual({ ok: false, reason: 'too_long' });
  });

  it('rejects spaces, symbols and accented letters', () => {
    for (const bad of ['two words', 'dash-name', 'hi!', 'café', 'emoji🙂']) {
      expect(validateNickname(bad)).toEqual({ ok: false, reason: 'invalid_characters' });
    }
  });

  it('rejects words on the block list whatever the letter case', () => {
    expect(validateNickname('SHITE')).toEqual({ ok: false, reason: 'blocked' });
    expect(validateNickname('xx_fuckxx')).toEqual({ ok: false, reason: 'blocked' });
  });

  it('sees through number-for-letter swaps and underscores', () => {
    expect(validateNickname('sh1t')).toEqual({ ok: false, reason: 'blocked' });
    expect(validateNickname('f_u_c_k')).toEqual({ ok: false, reason: 'blocked' });
  });

  it('blocks short words only when they stand alone, so ordinary words still work', () => {
    expect(validateNickname('ass')).toEqual({ ok: false, reason: 'blocked' });
    expect(validateNickname('big_ass')).toEqual({ ok: false, reason: 'blocked' });
    expect(validateNickname('class_7')).toEqual({ ok: true, nickname: 'class_7' });
    expect(validateNickname('Essex_Owl')).toEqual({ ok: true, nickname: 'Essex_Owl' });
  });

  it('blocks names that pretend to be staff', () => {
    expect(validateNickname('admin')).toEqual({ ok: false, reason: 'blocked' });
    expect(validateNickname('Teacher_1')).toEqual({ ok: false, reason: 'blocked' });
  });

  it('accepts extra blocked words passed in by the caller', () => {
    expect(validateNickname('Pebble', { extraBlocked: ['pebble'] })).toEqual({
      ok: false,
      reason: 'blocked',
    });
  });
});
