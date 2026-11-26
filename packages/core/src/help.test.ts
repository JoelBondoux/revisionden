import { describe, expect, it } from 'vitest';
import { HELPED_XP_FACTOR, helpButton, helpedMasteryScore, helpedXp } from './help';
import { comboBefore } from './xp';

describe('Need a clue? and Help me understand (F10, owner 2026-11-26)', () => {
  it('offers the clue first when the item has a verified hint, then help', () => {
    expect(helpButton({ hint: 'A hint', canHelp: true }, false)).toBe('clue');
    expect(helpButton({ hint: 'A hint', canHelp: true }, true)).toBe('help');
  });

  it('goes straight to help when there is no hint but there are verified steps', () => {
    expect(helpButton({ canHelp: true }, false)).toBe('help');
  });

  it('shows no button when there is neither, and none after the clue without steps', () => {
    expect(helpButton({}, false)).toBeNull();
    expect(helpButton({ hint: 'A hint' }, true)).toBeNull();
  });

  it('pays half XP, rounded down, for a right answer after help (owner)', () => {
    expect(HELPED_XP_FACTOR).toBe(0.5);
    expect(helpedXp(15)).toBe(7);
    expect(helpedXp(20)).toBe(10);
    expect(helpedXp(0)).toBe(0);
  });

  it('counts a helped answer as wrong for mastery', () => {
    expect(helpedMasteryScore()).toBe(0);
  });

  it('breaks the combo: a helped answer is never part of one', () => {
    const now = new Date('2026-11-26T10:00:00Z');
    const at = (s: number) => new Date(now.getTime() - s * 1000);
    expect(
      comboBefore(
        [
          { correct: true, mode: 'learn', at: at(10), helped: true },
          { correct: true, mode: 'learn', at: at(20) },
        ],
        now,
      ),
    ).toBe(0);
  });
});
