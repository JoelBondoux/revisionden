import { describe, expect, it } from 'vitest';
import {
  COMBO_BONUS_FROM,
  COMBO_BONUS_XP,
  comboBefore,
  comboBonusForSequence,
  comboBonusXp,
  type ComboAnswer,
} from './xp';

const MIN = 60_000;
const now = new Date('2026-11-25T10:00:00Z');
const ago = (minutes: number) => new Date(now.getTime() - minutes * MIN);
const learn = (correct: boolean, minutesAgo: number): ComboAnswer => ({
  correct,
  mode: 'learn',
  at: ago(minutesAgo),
});

describe('combo bonus XP (docs/GAME_FEEL.md "XP rule")', () => {
  it('is +5 XP per right answer from the 3rd in a row', () => {
    expect(COMBO_BONUS_XP).toBe(5);
    expect(COMBO_BONUS_FROM).toBe(3);
    expect(comboBonusXp(0)).toBe(0);
    expect(comboBonusXp(1)).toBe(0);
    expect(comboBonusXp(2)).toBe(0);
    expect(comboBonusXp(3)).toBe(5);
    expect(comboBonusXp(10)).toBe(5);
  });
});

describe('comboBefore: right answers in a row just before this one, from the history', () => {
  it('counts back through right Learn mode answers, newest first', () => {
    expect(comboBefore([learn(true, 1), learn(true, 2), learn(false, 3)], now)).toBe(2);
  });

  it('is 0 after a wrong answer', () => {
    expect(comboBefore([learn(false, 1), learn(true, 2)], now)).toBe(0);
  });

  it('is 0 with no history', () => {
    expect(comboBefore([], now)).toBe(0);
  });

  it('never spans sessions: a gap of more than 5 minutes ends the combo', () => {
    expect(comboBefore([learn(true, 6)], now)).toBe(0);
    expect(comboBefore([learn(true, 1), learn(true, 7)], now)).toBe(1);
    expect(comboBefore([learn(true, 1), learn(true, 5)], now)).toBe(2);
  });

  it('stops at an answer in Test mode', () => {
    expect(
      comboBefore(
        [learn(true, 1), { correct: true, mode: 'test', at: ago(2) }, learn(true, 3)],
        now,
      ),
    ).toBe(1);
  });
});

describe('comboBonusForSequence: Test mode, applied at the reveal to the answers in order', () => {
  it('gives the same bonus as Learn mode would, answer by answer', () => {
    const result = comboBonusForSequence([true, true, true, true, false, true, true, true]);
    expect(result.bonuses).toEqual([0, 0, 5, 5, 0, 0, 0, 5]);
    expect(result.bonusXp).toBe(15);
    expect(result.bestCombo).toBe(4);
  });

  it('gives nothing without 3 in a row', () => {
    expect(comboBonusForSequence([true, true, false, true])).toEqual({
      bonuses: [0, 0, 0, 0],
      bonusXp: 0,
      bestCombo: 2,
    });
    expect(comboBonusForSequence([]).bestCombo).toBe(0);
  });
});
