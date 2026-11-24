/**
 * Levels 1 to 100 and prestige stars from XP (see docs/REWARDS.md "Levels").
 *
 * The XP to go from level L to L + 1 starts at FIRST_LEVEL_XP and rises by LEVEL_STEP_XP per
 * level until it reaches LEVEL_CAP_XP (from level 10 on). So early levels come about weekly and
 * later ones every two to three weeks. Tuning assumptions are exported so the tests check them.
 */

/** Assumed XP on a day the student practises: the 50 XP daily goal plus a little more. */
export const ASSUMED_XP_PER_ACTIVE_DAY = 60;
/** Assumed practice days in a school year: most school days plus some in the holidays. */
export const ASSUMED_ACTIVE_DAYS_PER_YEAR = 250;

export const MAX_LEVEL = 100;
export const MAX_PRESTIGE_STARS = 5;
export const FIRST_LEVEL_XP = 300;
export const LEVEL_STEP_XP = 50;
export const LEVEL_CAP_XP = 750;
/** XP for each prestige star after level 100 (ten levels' worth). */
export const PRESTIGE_XP = 10 * LEVEL_CAP_XP;

function checkLevel(level: number) {
  if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) {
    throw new RangeError(`Level must be a whole number from 1 to ${MAX_LEVEL}`);
  }
}

/** XP needed to go from `level` to the next one (1 to 99). */
export function xpToNextLevel(level: number): number {
  checkLevel(level);
  return Math.min(LEVEL_CAP_XP, FIRST_LEVEL_XP + LEVEL_STEP_XP * (level - 1));
}

/** Total XP at which the student reaches `level`. */
export function xpForLevel(level: number): number {
  checkLevel(level);
  let total = 0;
  for (let l = 1; l < level; l++) total += xpToNextLevel(l);
  return total;
}

export interface LevelProgress {
  level: number;
  prestigeStars: number;
  /** XP earned inside the current level (or the current prestige star after level 100). */
  xpIntoLevel: number;
  /** XP the current level (or star) needs in total. */
  xpForNext: number;
  totalXp: number;
}

export function levelProgress(totalXp: number): LevelProgress {
  if (totalXp < 0) throw new RangeError('XP cannot be negative');
  const maxXp = xpForLevel(MAX_LEVEL);
  if (totalXp >= maxXp) {
    const past = totalXp - maxXp;
    const prestigeStars = Math.min(MAX_PRESTIGE_STARS, Math.floor(past / PRESTIGE_XP));
    const xpIntoLevel =
      prestigeStars === MAX_PRESTIGE_STARS ? PRESTIGE_XP : past - prestigeStars * PRESTIGE_XP;
    return { level: MAX_LEVEL, prestigeStars, xpIntoLevel, xpForNext: PRESTIGE_XP, totalXp };
  }
  let level = 1;
  let start = 0;
  while (start + xpToNextLevel(level) <= totalXp) {
    start += xpToNextLevel(level);
    level++;
  }
  return {
    level,
    prestigeStars: 0,
    xpIntoLevel: totalXp - start,
    xpForNext: xpToNextLevel(level),
    totalXp,
  };
}
