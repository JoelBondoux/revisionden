import { describe, expect, it } from 'vitest';
import { NICKNAME_MESSAGES, validateNickname } from './nickname';

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

  it('rejects symbols and accented letters', () => {
    for (const bad of ['dash-name', 'hi!', 'café', 'emoji🙂']) {
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

  it('allows single spaces between words', () => {
    expect(validateNickname('Thing 1')).toEqual({ ok: true, nickname: 'Thing 1' });
    expect(validateNickname('Pixel Fox 7')).toEqual({ ok: true, nickname: 'Pixel Fox 7' });
  });

  it('trims spaces at the start and end before checking and saving', () => {
    expect(validateNickname('  Thing 1 ')).toEqual({ ok: true, nickname: 'Thing 1' });
    expect(validateNickname(' a ')).toEqual({ ok: false, reason: 'too_short' });
    expect(validateNickname('  Sixteen_chars_X  ')).toEqual({
      ok: true,
      nickname: 'Sixteen_chars_X',
    });
  });

  it('rejects double spaces and other whitespace', () => {
    expect(validateNickname('Thing  1')).toEqual({ ok: false, reason: 'invalid_characters' });
    expect(validateNickname('Thing\t1')).toEqual({ ok: false, reason: 'invalid_characters' });
  });

  it('treats spaces like underscores in the block list', () => {
    expect(validateNickname('a d m i n')).toEqual({ ok: false, reason: 'blocked' });
    expect(validateNickname('big ass')).toEqual({ ok: false, reason: 'blocked' });
    expect(validateNickname('f u c k')).toEqual({ ok: false, reason: 'blocked' });
    expect(validateNickname('class 7')).toEqual({ ok: true, nickname: 'class 7' });
  });

  it('explains the characters it allows, including spaces', () => {
    expect(NICKNAME_MESSAGES.invalid_characters).toBe(
      'Nickname can only use letters, numbers, spaces and underscores',
    );
  });

  it('gives a helpful message for a blocked nickname', () => {
    expect(NICKNAME_MESSAGES.blocked).toBe(
      "That looks like a real name or a word we don't allow. Try a made-up nickname like Pixel_Fox",
    );
  });
});
