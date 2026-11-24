/**
 * Rewards evaluator and overview (see docs/REWARDS.md and docs/PRODUCT_RULES.md "Rewards").
 *
 * The catalogue itself is data in ./catalogue. Every reward has one stated target: a stat that
 * must reach a number, a collection to complete, or a seasonal challenge inside its term window.
 * Evaluation is deterministic: the same progress always gives the same rewards.
 */
import { CHAPTERS, CHAPTER_STEP_XP, chapterForYear, chapterXp } from './chapters';
import {
  COLLECTIONS,
  REWARDS,
  SEASONS,
  type Collection,
  type Rarity,
  type Reward,
  type RewardItem,
  type RewardStats,
  type Season,
  type StatKey,
} from './catalogue';
import { localDate } from './learning';
import { levelProgress, type LevelProgress } from './levels';
import { rewardableXpByDay, type XpEvent } from './reward-xp';

export * from './catalogue';

export interface RewardContext {
  /** Needed for seasonal items: they only unlock inside their window or re-release. */
  now?: Date;
  /** Challenge progress per season id, counted inside the live window. */
  seasonProgress?: Readonly<Record<string, number>>;
  collections?: readonly Collection[];
  seasons?: readonly Season[];
}

const statValue = (stats: Partial<RewardStats>, stat: StatKey) => stats[stat] ?? 0;

function seasonLive(season: Season | undefined, now: Date | undefined): boolean {
  if (!season || !now) return false;
  const day = localDate(now);
  const inside = (w: Season['window']) => day >= w.start && day <= w.end;
  return inside(season.window) || inside(season.rerelease);
}

function targetMet(
  r: Reward,
  stats: Partial<RewardStats>,
  earned: ReadonlySet<string>,
  ctx: RewardContext,
): boolean {
  const t = r.target;
  switch (t.kind) {
    case 'stat':
      return statValue(stats, t.stat) >= t.atLeast;
    case 'season': {
      const season = (ctx.seasons ?? SEASONS).find((s) => s.id === t.seasonId);
      return seasonLive(season, ctx.now) && (ctx.seasonProgress?.[t.seasonId] ?? 0) >= t.atLeast;
    }
    case 'collection': {
      const set = (ctx.collections ?? COLLECTIONS).find((c) => c.id === t.collectionId);
      return !!set && set.members.every((m) => earned.has(m));
    }
  }
}

/** Rewards the progress has now earned that are not already in `earnedIds`, in catalogue order. */
export function evaluateRewards(
  stats: Partial<RewardStats>,
  earnedIds: readonly string[],
  catalogue: readonly Reward[] = REWARDS,
  ctx: RewardContext = {},
): Reward[] {
  const earned = new Set(earnedIds);
  const fresh = new Set<string>();
  // Collections can complete from members earned in this same call, so repeat until stable.
  let changed = true;
  while (changed) {
    changed = false;
    for (const r of catalogue) {
      if (earned.has(r.id) || !targetMet(r, stats, earned, ctx)) continue;
      earned.add(r.id);
      fresh.add(r.id);
      changed = true;
    }
  }
  return catalogue.filter((r) => fresh.has(r.id));
}

export function giftDaysFor(rewards: readonly Reward[]): number {
  return rewards.reduce((sum, r) => sum + r.giftDays, 0);
}

/** How far along a reward the student is, for "locked" labels and progress bars. */
export function rewardProgress(
  reward: Reward,
  stats: Partial<RewardStats>,
  ctx: RewardContext & { earnedIds?: readonly string[] } = {},
): { current: number; target: number } {
  const t = reward.target;
  if (t.kind === 'collection') {
    const members =
      (ctx.collections ?? COLLECTIONS).find((c) => c.id === t.collectionId)?.members ?? [];
    const earned = new Set(ctx.earnedIds ?? []);
    return { current: members.filter((m) => earned.has(m)).length, target: members.length };
  }
  const value =
    t.kind === 'stat' ? statValue(stats, t.stat) : (ctx.seasonProgress?.[t.seasonId] ?? 0);
  return { current: Math.min(t.atLeast, value), target: t.atLeast };
}

/**
 * Level, prestige and chapter stats from timed XP. Only reward XP counts (see reward-xp.ts).
 * A-Level students (Year 12 and up) have finished their GCSEs, so GCSE completion carries over.
 */
export function progressionStats(input: {
  xpEvents: readonly XpEvent[];
  yearGroup: number;
  /** UK date, YYYY-MM-DD. */
  today: string;
  /** Reward XP total when it is known separately (defaults to the sum of `xpEvents`). */
  totalRewardXp?: number;
}): Partial<RewardStats> {
  const days = rewardableXpByDay(input.xpEvents);
  const total = input.totalRewardXp ?? days.reduce((sum, d) => sum + d.xp, 0);
  const { level, prestigeStars } = levelProgress(total);
  const chapters = chapterXp({ days, yearGroup: input.yearGroup, today: input.today });
  const stats: Partial<RewardStats> = {
    level,
    prestigeStars,
    chapter1Xp: chapters[1],
    chapter2Xp: chapters[2],
    chapter3Xp: chapters[3],
    chapter4Xp: chapters[4],
    chapter5Xp: chapters[5],
  };
  if (input.yearGroup >= 12) Object.assign(stats, { gcseExamsSat: 1, gcseFinished: 1 });
  return stats;
}

// ---------------------------------------------------------------------------------------------
// Overview for the student rewards screen
// ---------------------------------------------------------------------------------------------

export interface RewardCard {
  id: string;
  name: string;
  rarity: Rarity;
  items: readonly RewardItem[];
  earned: boolean;
  current: number;
  target: number;
}

export interface RewardsOverview {
  level: LevelProgress;
  chapter: {
    number: number;
    name: string;
    theme: string;
    earned: number;
    total: number;
    /** The next step to earn, with progress inside that step. */
    next: RewardCard | null;
    steps: RewardCard[];
  } | null;
  /** The closest unearned step of each milestone ladder, nearest first (three of them). */
  nextMilestones: RewardCard[];
  collections: {
    id: string;
    name: string;
    earned: number;
    total: number;
    complete: boolean;
    bonus: RewardCard[];
  }[];
  /** Seasonal drops live today (this term's drop, and any re-release). */
  seasons: { id: string; name: string; challenge: string; ends: string; items: RewardCard[] }[];
}

export interface OverviewInput {
  stats: Partial<RewardStats>;
  earnedIds: readonly string[];
  totalRewardXp: number;
  yearGroup: number;
  now: Date;
  seasonProgress?: Readonly<Record<string, number>>;
}

export function rewardsOverview(input: OverviewInput): RewardsOverview {
  const earned = new Set(input.earnedIds);
  const ctx = { earnedIds: input.earnedIds, seasonProgress: input.seasonProgress };
  const card = (r: Reward): RewardCard => ({
    id: r.id,
    name: r.name,
    rarity: r.rarity,
    items: r.items,
    earned: earned.has(r.id),
    ...rewardProgress(r, input.stats, ctx),
  });

  const number = chapterForYear(input.yearGroup);
  let chapter: RewardsOverview['chapter'] = null;
  if (number) {
    const info = CHAPTERS.find((c) => c.number === number)!;
    const steps = REWARDS.filter(
      (r) => r.source === 'chapter' && r.id.startsWith(`chapter-${number}-`),
    );
    const nextReward = steps.find((r) => !earned.has(r.id));
    let next: RewardCard | null = null;
    if (nextReward) {
      next = card(nextReward);
      const t = nextReward.target;
      if (t.kind === 'stat' && t.stat === `chapter${number}Xp`) {
        const into = statValue(input.stats, t.stat) - (t.atLeast - CHAPTER_STEP_XP);
        next = {
          ...next,
          current: Math.max(0, Math.min(CHAPTER_STEP_XP, into)),
          target: CHAPTER_STEP_XP,
        };
      }
    }
    chapter = {
      number,
      name: info.name,
      theme: info.theme,
      earned: steps.filter((r) => earned.has(r.id)).length,
      total: steps.length,
      next,
      steps: steps.map(card),
    };
  }

  const ladders = new Map<string, Reward>();
  for (const r of REWARDS) {
    if (r.source !== 'milestone' || r.target.kind !== 'stat' || earned.has(r.id)) continue;
    if (!ladders.has(r.target.stat)) ladders.set(r.target.stat, r);
  }
  const fraction = (c: RewardCard) => c.current / c.target;
  const nextMilestones = [...ladders.values()]
    .map(card)
    .map((c, order) => ({ c, order }))
    .sort((a, b) => fraction(b.c) - fraction(a.c) || a.order - b.order)
    .slice(0, 3)
    .map(({ c }) => c);

  const collections = COLLECTIONS.map((set) => {
    const bonus = REWARDS.filter(
      (r) => r.target.kind === 'collection' && r.target.collectionId === set.id,
    );
    return {
      id: set.id,
      name: set.name,
      earned: set.members.filter((m) => earned.has(m)).length,
      total: set.members.length,
      complete: bonus.every((r) => earned.has(r.id)),
      bonus: bonus.map(card),
    };
  });

  const seasons = SEASONS.filter((s) => seasonLive(s, input.now)).map((s) => {
    const inWindow = localDate(input.now) <= s.window.end;
    return {
      id: s.id,
      name: s.name,
      challenge: s.challenge,
      ends: inWindow ? s.window.end : s.rerelease.end,
      items: REWARDS.filter((r) => r.target.kind === 'season' && r.target.seasonId === s.id).map(
        card,
      ),
    };
  });

  return {
    level: levelProgress(input.totalRewardXp),
    chapter,
    nextMilestones,
    collections,
    seasons,
  };
}
