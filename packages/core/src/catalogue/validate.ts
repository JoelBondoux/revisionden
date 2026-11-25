/**
 * Checks the rewards catalogue: unique ids, stated and reachable targets, real collections and
 * seasons, and avatar items that only unlock from the reward that locks them.
 */
import { AVATAR_LAYERS, type AvatarCatalogue } from '../avatar';
import { CHAPTER_FULL_XP } from '../chapters';
import { MAX_LEVEL, MAX_PRESTIGE_STARS } from '../levels';
import { DAILY_REWARD_XP_CAP } from '../reward-xp';
import {
  RARITIES,
  type Collection,
  type Rarity,
  type Reward,
  type RewardStats,
  type Season,
  type StatKey,
} from './types';

/** Highest value each stat can reach; Infinity where there is no ceiling. */
export const STAT_MAX: Record<StatKey, number> = {
  bestStreak: Infinity,
  mocksWithTargetHit: Infinity,
  mocksAboveTarget: Infinity,
  assessmentsWithAllTargetsHit: Infinity,
  fullPastPapers: Infinity,
  weakSpotsFixed: Infinity,
  topicsMastered: Infinity,
  bestSubjectTopicsMastered: Infinity,
  bestSubjectMasteryPercent: 100,
  perfectSets: Infinity,
  correctAnswers: Infinity,
  flashcardsReviewed: Infinity,
  daysGifted: Infinity,
  friendsGiftedTo: Infinity,
  weeksTopOfLeague: Infinity,
  startingTestsCompleted: Infinity,
  bestCorrectRun: Infinity,
  level: MAX_LEVEL,
  prestigeStars: MAX_PRESTIGE_STARS,
  chapter1Xp: CHAPTER_FULL_XP,
  chapter2Xp: CHAPTER_FULL_XP,
  chapter3Xp: CHAPTER_FULL_XP,
  chapter4Xp: CHAPTER_FULL_XP,
  chapter5Xp: CHAPTER_FULL_XP,
  gcseExamsSat: Infinity,
  gcseFinished: 1,
  aLevelExamsSat: Infinity,
  aLevelFinished: 1,
  confirmedBugs: Infinity,
  comebackRuns: Infinity,
  allSubjectsWeeks: Infinity,
  bestWeakSpotsFixedInDay: Infinity,
  pacedPapers: Infinity,
  bestFlashcardsWeek: Infinity,
  bestCorrectInDay: Infinity,
  bestCorrectInWeek: Infinity,
  bestTopicsInDay: Infinity,
  bestSubjectsInDay: Infinity,
  subjectsPractised: Infinity,
  bestTopicAnswers: Infinity,
  itemTypesAnswered: 6,
  fullMarkLongAnswers: Infinity,
  perfectWorkings: Infinity,
  bestRewardDayXp: DAILY_REWARD_XP_CAP,
  fullWeekends: Infinity,
  perfectWeeks: Infinity,
  bestGoalDaysInMonth: 31,
  chaptersFilled: 5,
} satisfies Record<keyof RewardStats, number>;

export const REWARD_STAT_KEYS = Object.keys(STAT_MAX) as StatKey[];

const wholeAtLeast = (n: number, min: number) => Number.isInteger(n) && n >= min;

export interface CatalogueParts {
  collections: readonly Collection[];
  seasons: readonly Season[];
  avatar: AvatarCatalogue;
}

function checkReward(r: Reward, parts: CatalogueParts, problems: string[]) {
  if (!r.name.trim()) problems.push(`${r.id}: needs a name`);
  if (r.items.length === 0) problems.push(`${r.id}: needs at least one item`);
  if (!wholeAtLeast(r.giftDays, 0)) {
    problems.push(`${r.id}: gift days must be a whole number of at least 0`);
  }
  if ((r.secret || r.source === 'hidden') && r.target.kind !== 'stat') {
    problems.push(`${r.id}: secret and hidden rewards need a stat target`);
  }
  if (r.source === 'hidden' && !r.track) problems.push(`${r.id}: hidden rewards need a track`);
  if (r.source === 'secret' && !r.secret)
    problems.push(`${r.id}: secret rewards need secret: true`);
  const t = r.target;
  if (t.kind === 'collection') {
    if (!parts.collections.some((c) => c.id === t.collectionId)) {
      problems.push(`${r.id}: unknown collection ${t.collectionId}`);
    }
    return;
  }
  if (!wholeAtLeast(t.atLeast, 1)) {
    problems.push(`${r.id}: target must be a whole number of at least 1`);
  }
  if (t.kind === 'season') {
    if (!parts.seasons.some((s) => s.id === t.seasonId)) {
      problems.push(`${r.id}: unknown season ${t.seasonId}`);
    }
    return;
  }
  if (!(t.stat in STAT_MAX)) {
    problems.push(`${r.id}: unknown stat ${t.stat}`);
  } else if (t.atLeast > STAT_MAX[t.stat]) {
    problems.push(
      `${r.id}: ${t.stat} target ${t.atLeast} can never be reached (max ${STAT_MAX[t.stat]})`,
    );
  }
}

function checkAvatarLinks(rewards: readonly Reward[], avatar: AvatarCatalogue, problems: string[]) {
  const unlocks = new Set<string>();
  for (const r of rewards) {
    for (const item of r.items) {
      if (item.kind !== 'avatar') continue;
      const found = avatar[item.layer].find((a) => a.id === item.id);
      const key = `${item.layer}:${item.id}`;
      if (!found) problems.push(`${r.id}: avatar item ${key} is not in the avatar catalogue`);
      else if (found.unlockedBy !== r.id)
        problems.push(`${r.id}: avatar item ${key} is not locked by ${r.id}`);
      else unlocks.add(key);
    }
  }
  for (const layer of AVATAR_LAYERS) {
    for (const item of avatar[layer]) {
      if (item.unlockedBy && !unlocks.has(`${layer}:${item.id}`)) {
        problems.push(
          `avatar item ${layer}:${item.id} is locked by ${item.unlockedBy}, which does not unlock it`,
        );
      }
    }
  }
}

export function validateCatalogue(rewards: readonly Reward[], parts: CatalogueParts): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const r of rewards) {
    if (seen.has(r.id)) problems.push(`${r.id}: duplicate id`);
    seen.add(r.id);
    checkReward(r, parts, problems);
  }
  for (const c of parts.collections) {
    if (c.members.length === 0) problems.push(`${c.id}: has no members`);
    const bonusIds = rewards
      .filter((r) => r.target.kind === 'collection' && r.target.collectionId === c.id)
      .map((r) => r.id);
    for (const m of c.members) {
      if (!seen.has(m)) problems.push(`${c.id}: unknown member ${m}`);
      const member = rewards.find((r) => r.id === m);
      if (member && (member.secret || member.track)) {
        problems.push(`${c.id}: secret or hidden reward ${m} cannot be in a collection`);
      }
      if (bonusIds.includes(m)) problems.push(`${c.id}: contains its own bonus ${m}`);
    }
  }
  for (const s of parts.seasons) {
    if (s.window.end < s.window.start) problems.push(`${s.id}: window ends before it starts`);
    if (s.rerelease.start <= s.window.end)
      problems.push(`${s.id}: re-release must come after the window`);
  }
  checkAvatarLinks(rewards, parts.avatar, problems);
  return problems;
}

/** Share of rewards at each rarity, in percent (one decimal place). */
export function rarityShares(rewards: readonly Reward[]): Record<Rarity, number> {
  const shares = {} as Record<Rarity, number>;
  for (const rarity of RARITIES) {
    const n = rewards.filter((r) => r.rarity === rarity).length;
    shares[rarity] = rewards.length ? Math.round((n / rewards.length) * 1000) / 10 : 0;
  }
  return shares;
}
