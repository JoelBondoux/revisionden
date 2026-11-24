import { describe, expect, it } from 'vitest';
import {
  AVATAR_CATALOGUE,
  AVATAR_LAYERS,
  DEFAULT_AVATAR,
  decodeAvatar,
  encodeAvatar,
  validateAvatar,
  type AvatarChoices,
} from './avatar';

const sample: AvatarChoices = {
  ...DEFAULT_AVATAR,
  skin: 3,
  eyes: 2,
  hairStyle: 5,
  hairColour: 7,
  topColour: 9,
  backgroundColour: 4,
};

function lockedItem() {
  for (const layer of AVATAR_LAYERS) {
    const index = AVATAR_CATALOGUE[layer].findIndex((item) => item.unlockedBy);
    if (index >= 0) return { layer, index, reward: AVATAR_CATALOGUE[layer][index]!.unlockedBy! };
  }
  throw new Error('catalogue has no locked items');
}

describe('avatar code', () => {
  it('has the 14 agreed layers in a fixed order', () => {
    expect(AVATAR_LAYERS).toEqual([
      'skin',
      'eyes',
      'mouth',
      'facialHair',
      'hairStyle',
      'hairColour',
      'top',
      'topColour',
      'eyewear',
      'headwear',
      'heldItem',
      'backgroundColour',
      'pattern',
      'scene',
    ]);
  });

  it('round-trips: decoding an encoded avatar gives the same choices', () => {
    expect(decodeAvatar(encodeAvatar(sample))).toEqual(sample);
    expect(decodeAvatar(encodeAvatar(DEFAULT_AVATAR))).toEqual(DEFAULT_AVATAR);
  });

  it('makes a short code: a version character and two characters per layer', () => {
    const code = encodeAvatar(sample);
    expect(code).toMatch(/^1[0-9a-z]{28}$/);
  });

  it('refuses to encode a choice that is not a whole number from 0 to 1295', () => {
    expect(() => encodeAvatar({ ...sample, skin: -1 })).toThrow(/skin/);
    expect(() => encodeAvatar({ ...sample, eyes: 1.5 })).toThrow(/eyes/);
    expect(() => encodeAvatar({ ...sample, scene: 1296 })).toThrow(/scene/);
  });

  it('rejects codes with the wrong length, version or characters', () => {
    const good = encodeAvatar(sample);
    expect(() => decodeAvatar(good.slice(0, -1))).toThrow(/length/);
    expect(() => decodeAvatar('9' + good.slice(1))).toThrow(/version/);
    expect(() => decodeAvatar(good.slice(0, -1) + '!')).toThrow(/character/);
  });
});

describe('validateAvatar', () => {
  it('accepts the default avatar with no rewards earned', () => {
    expect(validateAvatar(encodeAvatar(DEFAULT_AVATAR), [])).toEqual({ ok: true });
  });

  it('rejects an item that is not in the catalogue', () => {
    const tooHigh = AVATAR_CATALOGUE.eyes.length;
    expect(validateAvatar(encodeAvatar({ ...sample, eyes: tooHigh }), [])).toEqual({
      ok: false,
      problems: [{ layer: 'eyes', reason: 'unknown_item' }],
    });
  });

  it('rejects a locked item unless its reward has been earned', () => {
    const { layer, index, reward } = lockedItem();
    const code = encodeAvatar({ ...DEFAULT_AVATAR, [layer]: index });
    expect(validateAvatar(code, [])).toEqual({
      ok: false,
      problems: [{ layer, reason: 'locked', requires: reward }],
    });
    expect(validateAvatar(code, [reward])).toEqual({ ok: true });
  });

  it('reports a malformed code as a problem instead of throwing', () => {
    expect(validateAvatar('nonsense', [])).toEqual({
      ok: false,
      problems: [{ layer: 'code', reason: 'malformed' }],
    });
  });

  it('keeps every free layer free: the first option of each layer is never locked', () => {
    for (const layer of AVATAR_LAYERS) {
      expect(AVATAR_CATALOGUE[layer][0]?.unlockedBy).toBeUndefined();
    }
  });
});
