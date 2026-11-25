import { describe, expect, it } from 'vitest';
import { REWARDS } from './catalogue';
import {
  TITLE_WORDS,
  chooseTitle,
  formatTitle,
  isReviewedPair,
  titleWordsFor,
  validateTitleWords,
} from './titles';

const firsts = TITLE_WORDS.filter((w) => w.part === 'first');
const lasts = TITLE_WORDS.filter((w) => w.part === 'last');
const rewardOf = (text: string) => TITLE_WORDS.find((w) => w.text === text)!.rewardId;

describe('two-part title words', () => {
  it('has about 120 first words and 120 last words, each unique', () => {
    expect(firsts.length).toBeGreaterThanOrEqual(110);
    expect(lasts.length).toBeGreaterThanOrEqual(110);
    expect(new Set(firsts.map((w) => w.text)).size).toBe(firsts.length);
    expect(new Set(lasts.map((w) => w.text)).size).toBe(lasts.length);
  });

  it('migrates every old single title into words (no single titles are left)', () => {
    expect(REWARDS.flatMap((r) => r.items).filter((i) => i.kind === 'title')).toEqual([]);
    const level11 = REWARDS.find((r) => r.id === 'level-11')!;
    expect(level11.items).toEqual([
      { kind: 'titleWord', part: 'first', text: 'Opening' },
      { kind: 'titleWord', part: 'last', text: 'Act' },
    ]);
  });

  it('unlocks words from every layer and from hidden tracks', () => {
    const sources = new Set(
      TITLE_WORDS.map((w) => REWARDS.find((r) => r.id === w.rewardId)!.source),
    );
    for (const s of ['level', 'chapter', 'milestone', 'collection', 'season', 'hidden', 'secret']) {
      expect(sources).toContain(s);
    }
  });

  it("gives each word its reward's rarity, so rarer rewards unlock rarer words", () => {
    const flawless = TITLE_WORDS.find((w) => w.text === 'Flawless')!;
    expect(flawless.rarity).toBe('legendary');
    expect(TITLE_WORDS.find((w) => w.text === 'Fresh')!.rarity).toBe('common');
  });

  it('passes the validator: every pairing is checked against blocked words', () => {
    expect(validateTitleWords()).toEqual([]);
  });

  it('catches a blocked word, a pairing that spells one, a bad format and a stale review pair', () => {
    const words = [
      { text: 'Bad', part: 'first' as const, rewardId: 'level-4', rarity: 'common' as const },
      { text: 'Wan', part: 'first' as const, rewardId: 'level-4', rarity: 'common' as const },
      { text: 'Kicker', part: 'last' as const, rewardId: 'level-4', rarity: 'common' as const },
      { text: 'two words', part: 'last' as const, rewardId: 'level-4', rarity: 'common' as const },
      { text: 'Nope', part: 'last' as const, rewardId: 'missing', rarity: 'common' as const },
    ];
    const errors = validateTitleWords(words, [['Bad', 'Ghost']]);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('"Wan Kicker"'),
        expect.stringContaining('"two words"'),
        expect.stringContaining('missing'),
        expect.stringContaining('Ghost'),
      ]),
    );
  });

  it('includes the examples from the spec', () => {
    for (const text of ['Algebra', 'Ace', 'Cosmic', 'Scholar', 'Unshakeable', 'Explorer']) {
      expect(TITLE_WORDS.some((w) => w.text === text)).toBe(true);
    }
  });
});

describe('choosing a title', () => {
  const earned = [
    rewardOf('Cosmic'),
    rewardOf('Scholar'),
    rewardOf('Prehistoric'),
    rewardOf('Senior'),
  ];

  it('lists only the words the student has unlocked', () => {
    const words = titleWordsFor(earned);
    // Each of these rewards gives both a first and a last word.
    expect(words.first.map((w) => w.text).sort()).toEqual(['Cosmic', 'Prehistoric', 'Seasoned']);
    expect(words.last.map((w) => w.text).sort()).toEqual(['Dino-Expert', 'Scholar', 'Senior']);
  });

  it('accepts an unlocked pair and formats it', () => {
    expect(chooseTitle({ first: 'Cosmic', last: 'Scholar' }, earned)).toEqual({ ok: true });
    expect(formatTitle({ first: 'Cosmic', last: 'Scholar' })).toBe('Cosmic Scholar');
  });

  it('allows one word or none, so a title can be cleared', () => {
    expect(chooseTitle({ first: 'Cosmic', last: null }, earned)).toEqual({ ok: true });
    expect(chooseTitle({ first: null, last: null }, [])).toEqual({ ok: true });
    expect(formatTitle({ first: null, last: 'Scholar' })).toBe('Scholar');
    expect(formatTitle({ first: null, last: null })).toBeNull();
  });

  it('refuses a locked word, a word in the wrong slot and a reviewed pair', () => {
    expect(chooseTitle({ first: 'Flawless', last: null }, earned)).toEqual({
      ok: false,
      reason: 'locked',
    });
    expect(chooseTitle({ first: 'Scholar', last: null }, earned)).toEqual({
      ok: false,
      reason: 'locked',
    });
    expect(chooseTitle({ first: 'Prehistoric', last: 'Senior' }, earned)).toEqual({
      ok: false,
      reason: 'reviewed',
    });
  });

  it('tells the picker which pairs are on the manual review list', () => {
    expect(isReviewedPair('Prehistoric', 'Senior')).toBe(true);
    expect(isReviewedPair('Cosmic', 'Scholar')).toBe(false);
  });
});
