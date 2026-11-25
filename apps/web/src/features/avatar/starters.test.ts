import { encodeAvatar, validateAvatar } from '@revisionden/core';
import { STARTER_LOOKS, starterCode } from './starters';

describe('starter looks', () => {
  it('offers Boy, Girl and Neutral, with Neutral first in importance', () => {
    expect(STARTER_LOOKS.map((s) => s.label)).toEqual(['Boy', 'Girl', 'Neutral']);
  });

  it('uses only items a new child can wear', () => {
    for (const look of STARTER_LOOKS) {
      expect(validateAvatar(encodeAvatar(look.choices), [])).toEqual({ ok: true });
    }
  });

  it('gives three different looks', () => {
    expect(new Set(STARTER_LOOKS.map((s) => encodeAvatar(s.choices))).size).toBe(3);
  });

  it('gives the code for a look by id', () => {
    expect(starterCode('neutral')).toBe(encodeAvatar(STARTER_LOOKS[2]!.choices));
  });
});
