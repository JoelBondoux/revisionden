import { describe, expect, it } from 'vitest';
import {
  ASSUMED_ACTIVE_DAYS_PER_YEAR,
  ASSUMED_XP_PER_ACTIVE_DAY,
  MAX_LEVEL,
  MAX_PRESTIGE_STARS,
  PRESTIGE_XP,
  levelProgress,
  xpForLevel,
  xpToNextLevel,
} from './levels';

const yearXp = ASSUMED_XP_PER_ACTIVE_DAY * ASSUMED_ACTIVE_DAYS_PER_YEAR;

describe('level curve', () => {
  it('starts everyone at level 1 with no XP', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(levelProgress(0)).toMatchObject({ level: 1, prestigeStars: 0, xpIntoLevel: 0 });
  });

  it('needs strictly more XP for every level, and each level never costs less than the last', () => {
    for (let level = 2; level <= MAX_LEVEL; level++) {
      expect(xpForLevel(level)).toBeGreaterThan(xpForLevel(level - 1));
      if (level > 2)
        expect(xpToNextLevel(level - 1)).toBeGreaterThanOrEqual(xpToNextLevel(level - 2));
    }
  });

  it('levels up about weekly at first and every few weeks later', () => {
    const weekXp = yearXp / 50;
    expect(xpToNextLevel(1) / weekXp).toBeLessThanOrEqual(1.5);
    expect(xpToNextLevel(60) / weekXp).toBeGreaterThanOrEqual(2);
    expect(xpToNextLevel(60) / weekXp).toBeLessThanOrEqual(4);
  });

  it('reaches about level 20 after one school year of daily practice', () => {
    const level = levelProgress(yearXp).level;
    expect(level).toBeGreaterThanOrEqual(18);
    expect(level).toBeLessThanOrEqual(26);
  });

  it('reaches level 100 near the end of Year 13, not before Year 13', () => {
    const yearsToMax = xpForLevel(MAX_LEVEL) / yearXp;
    expect(yearsToMax).toBeGreaterThan(4.5);
    expect(yearsToMax).toBeLessThanOrEqual(5);
  });

  it('is reachable: every level has a finite whole-number XP target', () => {
    for (let level = 1; level <= MAX_LEVEL; level++) {
      expect(Number.isInteger(xpForLevel(level))).toBe(true);
    }
  });

  it('places XP inside a level and says how much is left', () => {
    const at = xpForLevel(5) + 10;
    expect(levelProgress(at)).toEqual({
      level: 5,
      prestigeStars: 0,
      xpIntoLevel: 10,
      xpForNext: xpToNextLevel(5),
      totalXp: at,
    });
  });

  it('rejects levels outside 1 to 100 and negative XP', () => {
    expect(() => xpForLevel(0)).toThrow();
    expect(() => xpForLevel(101)).toThrow();
    expect(() => xpForLevel(2.5)).toThrow();
    expect(() => levelProgress(-1)).toThrow();
  });
});

describe('prestige stars after level 100', () => {
  it('earns a star for every PRESTIGE_XP past level 100, up to 5', () => {
    const max = xpForLevel(MAX_LEVEL);
    expect(levelProgress(max)).toMatchObject({ level: 100, prestigeStars: 0, xpIntoLevel: 0 });
    expect(levelProgress(max + PRESTIGE_XP - 1).prestigeStars).toBe(0);
    expect(levelProgress(max + PRESTIGE_XP)).toMatchObject({ level: 100, prestigeStars: 1 });
    expect(levelProgress(max + PRESTIGE_XP * 2 + 5)).toMatchObject({
      prestigeStars: 2,
      xpIntoLevel: 5,
      xpForNext: PRESTIGE_XP,
    });
  });

  it('stops at 5 stars and then shows a full bar', () => {
    const p = levelProgress(xpForLevel(MAX_LEVEL) + PRESTIGE_XP * 50);
    expect(p.prestigeStars).toBe(MAX_PRESTIGE_STARS);
    expect(p.xpIntoLevel).toBe(p.xpForNext);
  });
});
