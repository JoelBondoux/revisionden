import { describe, expect, it } from 'vitest';
import { AVATAR_CATALOGUE } from '../avatar';
import { COLLECTIONS, REWARDS, SEASONS, validateCatalogue, type Reward } from './index';

const bugHunter = REWARDS.filter((r) => r.track === 'bug-hunter');
const secrets = REWARDS.filter((r) => r.secret);
const parts = { collections: COLLECTIONS, seasons: SEASONS, avatar: AVATAR_CATALOGUE };

describe('Bug Hunter track (hidden)', () => {
  it('has steps at 1, 2, 3, 5, 8, 12 and 20 confirmed bugs', () => {
    expect(bugHunter.map((r) => (r.target as { atLeast: number }).atLeast)).toEqual([
      1, 2, 3, 5, 8, 12, 20,
    ]);
    expect(
      bugHunter.every((r) => r.target.kind === 'stat' && r.target.stat === 'confirmedBugs'),
    ).toBe(true);
    expect(bugHunter.every((r) => r.source === 'hidden')).toBe(true);
  });

  it('gives a badge, title, magnifier, circuit frame, Pip debug outfit, glitch effect and the Exterminator set', () => {
    const kinds = bugHunter.map((r) =>
      r.items.map((i) => `${i.kind}:${'id' in i ? i.id : i.text}`),
    );
    expect(kinds).toEqual([
      ['badge:bug-hunter'],
      ['title:Bug Hunter'],
      ['avatar:magnifier'],
      ['frame:circuit-board'],
      ['pipOutfit:debug'],
      ['effect:glitch'],
      ['frame:exterminator', 'title:Exterminator', 'pipOutfit:exterminator'],
    ]);
    expect(bugHunter.at(-1)!.rarity).toBe('legendary');
  });
});

describe('secret achievements', () => {
  it('has about 24, each with a stated stat target and a badge', () => {
    expect(secrets.length).toBeGreaterThanOrEqual(22);
    expect(secrets.length).toBeLessThanOrEqual(26);
    for (const s of secrets) {
      expect(s.source).toBe('secret');
      expect(s.target.kind).toBe('stat');
      expect(s.items.some((i) => i.kind === 'badge')).toBe(true);
    }
  });

  it('keeps vague hints short, and some secrets have none', () => {
    for (const s of secrets.filter((x) => x.hint)) expect(s.hint!.length).toBeLessThanOrEqual(40);
    expect(secrets.filter((s) => !s.hint).length).toBeGreaterThan(0);
    expect(secrets.filter((s) => s.hint).length).toBeGreaterThanOrEqual(6);
  });
});

describe('validator: hidden and secret rewards', () => {
  const base: Reward = {
    id: 'x',
    name: 'X',
    rarity: 'rare',
    source: 'secret',
    secret: true,
    target: { kind: 'stat', stat: 'correctAnswers', atLeast: 1 },
    items: [{ kind: 'badge', id: 'x' }],
    giftDays: 0,
  };

  it('accepts the real catalogue', () => {
    expect(validateCatalogue(REWARDS, parts)).toEqual([]);
  });

  it('needs a stat target for secret and hidden rewards', () => {
    expect(
      validateCatalogue(
        [{ ...base, target: { kind: 'season', seasonId: 's', atLeast: 1 } }],
        parts,
      ),
    ).toContain('x: secret and hidden rewards need a stat target');
  });

  it('keeps secret and hidden rewards out of collections', () => {
    expect(
      validateCatalogue([base], {
        ...parts,
        collections: [{ id: 'c', name: 'C', members: ['x'] }],
      }),
    ).toContain('c: secret or hidden reward x cannot be in a collection');
  });

  it('needs every hidden reward to name its track, and a secret flag to match its source', () => {
    expect(validateCatalogue([{ ...base, source: 'hidden', secret: undefined }], parts)).toContain(
      'x: hidden rewards need a track',
    );
    expect(validateCatalogue([{ ...base, secret: undefined }], parts)).toContain(
      'x: secret rewards need secret: true',
    );
  });
});
