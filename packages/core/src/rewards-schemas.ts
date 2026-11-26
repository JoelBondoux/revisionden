/**
 * Shared Zod schemas for the rewards API (/v1/student/rewards and the parent routes under
 * /v1/students/:id/rewards). The web app and the API both use them.
 */
import { z } from 'zod';
import { AVATAR_LAYERS } from './avatar';
import { REWARDS, REWARD_STAT_KEYS, STAT_MAX, type RewardStats, type StatKey } from './rewards';

export const RaritySchema = z.enum(['common', 'rare', 'epic', 'legendary']);

export const RewardItemSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('avatar'), layer: z.enum(AVATAR_LAYERS), id: z.string() }),
  z.object({ kind: z.literal('frame'), id: z.string() }),
  z.object({ kind: z.literal('title'), text: z.string() }),
  z.object({ kind: z.literal('titleWord'), part: z.enum(['first', 'last']), text: z.string() }),
  z.object({ kind: z.literal('theme'), id: z.string() }),
  z.object({ kind: z.literal('pipOutfit'), id: z.string() }),
  z.object({ kind: z.literal('badge'), id: z.string() }),
  z.object({ kind: z.literal('effect'), id: z.string() }),
  z.object({ kind: z.literal('effectStyle'), id: z.string() }),
]);

export const RewardCardSchema = z.object({
  id: z.string(),
  name: z.string(),
  rarity: RaritySchema,
  items: z.array(RewardItemSchema),
  earned: z.boolean(),
  current: z.number(),
  target: z.number(),
});
export type RewardCardResponse = z.infer<typeof RewardCardSchema>;

export const LevelProgressSchema = z.object({
  level: z.number().int(),
  prestigeStars: z.number().int(),
  xpIntoLevel: z.number(),
  xpForNext: z.number(),
  totalXp: z.number(),
});

export const RewardsOverviewSchema = z.object({
  level: LevelProgressSchema,
  chapter: z
    .object({
      number: z.number().int(),
      name: z.string(),
      theme: z.string(),
      earned: z.number().int(),
      total: z.number().int(),
      next: RewardCardSchema.nullable(),
      steps: z.array(RewardCardSchema),
    })
    .nullable(),
  nextMilestones: z.array(RewardCardSchema),
  collections: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      earned: z.number().int(),
      total: z.number().int(),
      complete: z.boolean(),
      bonus: z.array(RewardCardSchema),
    }),
  ),
  seasons: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      challenge: z.string(),
      ends: z.string(),
      items: z.array(RewardCardSchema),
    }),
  ),
  hiddenTracks: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      earned: z.number().int(),
      total: z.number().int(),
      next: RewardCardSchema.nullable(),
      steps: z.array(RewardCardSchema),
    }),
  ),
  secrets: z.object({
    found: z.number().int(),
    total: z.number().int(),
    cards: z.array(RewardCardSchema.extend({ hint: z.string().optional() })),
  }),
});

const rewardIds = new Set(REWARDS.map((r) => r.id));
const statKeys = REWARD_STAT_KEYS as [StatKey, ...StatKey[]];

export const ParentRewardTargetSchema = z.union([
  z
    .object({
      kind: z.literal('reward'),
      rewardId: z.string().refine((id) => rewardIds.has(id), 'Not a reward in the catalogue'),
    })
    .strict(),
  z
    .object({ kind: z.literal('stat'), stat: z.enum(statKeys), atLeast: z.number().int().min(1) })
    .strict()
    .refine((t) => t.atLeast <= STAT_MAX[t.stat], 'That target can never be reached'),
  z
    .object({
      kind: z.literal('date'),
      on: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date')
        .refine((d) => {
          const time = Date.parse(`${d}T00:00:00Z`);
          return !Number.isNaN(time) && new Date(time).toISOString().startsWith(d);
        }, 'Not a real date'),
    })
    .strict(),
]);
export type ParentRewardTarget = z.infer<typeof ParentRewardTargetSchema>;

export const CreateParentRewardRequestSchema = z
  .object({
    /** A short description of the real-world reward, for example "Cinema trip". */
    title: z.string().trim().min(1, 'Give the reward a short title').max(60),
    /** An optional note for the student, for example "you pick the film". */
    note: z.string().trim().max(200).optional(),
    target: ParentRewardTargetSchema,
  })
  .strict();
export type CreateParentRewardRequest = z.infer<typeof CreateParentRewardRequestSchema>;

/** Changes a parent can make before the reward is given. */
export const UpdateParentRewardRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(60).optional(),
    note: z.string().trim().max(200).nullable().optional(),
    target: ParentRewardTargetSchema.optional(),
  })
  .strict()
  .refine((u) => Object.keys(u).length > 0, 'Change at least one thing');
export type UpdateParentRewardRequest = z.infer<typeof UpdateParentRewardRequestSchema>;

export const ParentRewardSchema = z.object({
  id: z.string(),
  title: z.string(),
  note: z.string().nullable(),
  target: ParentRewardTargetSchema,
  /** What the target is, in words, for example "100-day streak" or "Level 20". */
  targetLabel: z.string(),
  reached: z.boolean(),
  current: z.number(),
  goal: z.number(),
  givenAt: z.string().nullable(),
});
export type ParentReward = z.infer<typeof ParentRewardSchema>;

/** A child's parent-set rewards with progress (for the parent dashboard, workstream K). */
export const ParentRewardsResponseSchema = z.object({ parentRewards: z.array(ParentRewardSchema) });
export type ParentRewardsResponse = z.infer<typeof ParentRewardsResponseSchema>;

export const StudentRewardsResponseSchema = z.object({
  overview: RewardsOverviewSchema,
  /** Rewards earned since the last look, to celebrate. */
  newlyEarned: z.array(RewardCardSchema),
  parentRewards: z.array(ParentRewardSchema),
});
export type StudentRewardsResponse = z.infer<typeof StudentRewardsResponseSchema>;

export function parentRewardProgress(
  target: ParentRewardTarget,
  stats: Partial<RewardStats>,
  earnedIds: readonly string[],
  /** UK date today (YYYY-MM-DD), for date targets. */
  today?: string,
): { reached: boolean; current: number; target: number } {
  if (target.kind === 'date') {
    const reached = today !== undefined && today >= target.on;
    return { reached, current: reached ? 1 : 0, target: 1 };
  }
  if (target.kind === 'stat') {
    const value = stats[target.stat] ?? 0;
    return {
      reached: value >= target.atLeast,
      current: Math.min(value, target.atLeast),
      target: target.atLeast,
    };
  }
  if (earnedIds.includes(target.rewardId)) return { reached: true, current: 1, target: 1 };
  const reward = REWARDS.find((r) => r.id === target.rewardId);
  if (reward?.target.kind === 'stat') {
    const value = stats[reward.target.stat] ?? 0;
    return {
      reached: false,
      current: Math.min(value, reward.target.atLeast),
      target: reward.target.atLeast,
    };
  }
  return { reached: false, current: 0, target: 1 };
}

const STAT_WORDS: Record<StatKey, (n: number) => string> = {
  bestStreak: (n) => `${n}-day streak`,
  mocksWithTargetHit: (n) => `Target grade in ${n} mock${n === 1 ? '' : 's'}`,
  mocksAboveTarget: (n) => `Beat a target grade ${n} time${n === 1 ? '' : 's'}`,
  assessmentsWithAllTargetsHit: (n) => `Every target at ${n} assessment${n === 1 ? '' : 's'}`,
  fullPastPapers: (n) => `${n} full past paper${n === 1 ? '' : 's'}`,
  weakSpotsFixed: (n) => `${n} weak spots fixed`,
  topicsMastered: (n) => `${n} topics mastered`,
  bestSubjectTopicsMastered: (n) => `${n} topics mastered in one subject`,
  bestSubjectMasteryPercent: (n) => `${n}% of a subject mastered`,
  perfectSets: (n) => `${n} perfect set${n === 1 ? '' : 's'}`,
  correctAnswers: (n) => `${n} right answers`,
  flashcardsReviewed: (n) => `${n} flashcards reviewed`,
  daysGifted: (n) => `${n} days gifted`,
  friendsGiftedTo: (n) => `Gifted ${n} friends`,
  weeksTopOfLeague: (n) => `${n} league win${n === 1 ? '' : 's'}`,
  startingTestsCompleted: (n) => `${n} starting test${n === 1 ? '' : 's'}`,
  bestCorrectRun: (n) => `${n} right in a row`,
  level: (n) => `Level ${n}`,
  prestigeStars: (n) => `${n} prestige star${n === 1 ? '' : 's'}`,
  chapter1Xp: (n) => `${n} chapter 1 XP`,
  chapter2Xp: (n) => `${n} chapter 2 XP`,
  chapter3Xp: (n) => `${n} chapter 3 XP`,
  chapter4Xp: (n) => `${n} chapter 4 XP`,
  chapter5Xp: (n) => `${n} chapter 5 XP`,
  gcseExamsSat: (n) => `${n} GCSE exam${n === 1 ? '' : 's'} sat`,
  gcseFinished: () => 'Every GCSE sat',
  aLevelExamsSat: (n) => `${n} A-Level exam${n === 1 ? '' : 's'} sat`,
  aLevelFinished: () => 'Every A-Level sat',
  confirmedBugs: (n) => `${n} confirmed bug${n === 1 ? '' : 's'}`,
  comebackRuns: (n) => `${n} comeback${n === 1 ? '' : 's'}`,
  allSubjectsWeeks: (n) => `Every subject in a week, ${n} time${n === 1 ? '' : 's'}`,
  bestWeakSpotsFixedInDay: (n) => `${n} weak spots fixed in a day`,
  pacedPapers: (n) => `${n} paper${n === 1 ? '' : 's'} on pace`,
  bestFlashcardsWeek: (n) => `${n} flashcards in a week`,
  bestCorrectInDay: (n) => `${n} right answers in a day`,
  bestCorrectInWeek: (n) => `${n} right answers in a week`,
  bestTopicsInDay: (n) => `${n} topics in a day`,
  bestSubjectsInDay: (n) => `${n} subjects in a day`,
  subjectsPractised: (n) => `${n} subjects practised`,
  bestTopicAnswers: (n) => `${n} answers in one topic`,
  itemTypesAnswered: (n) => `${n} answer types right`,
  fullMarkLongAnswers: (n) => `${n} full-mark long answer${n === 1 ? '' : 's'}`,
  perfectWorkings: (n) => `${n} perfect worked answers`,
  bestRewardDayXp: (n) => `${n} XP in a day`,
  fullWeekends: (n) => `${n} full weekend${n === 1 ? '' : 's'}`,
  perfectWeeks: (n) => `${n} perfect week${n === 1 ? '' : 's'}`,
  bestGoalDaysInMonth: (n) => `${n} goal days in a month`,
  chaptersFilled: (n) => `${n} chapter${n === 1 ? '' : 's'} filled`,
  factChecks: (n) => `${n} confirmed problem report${n === 1 ? '' : 's'}`,
  weakSpotsTurnedStrong: (n) => `${n} weak spot${n === 1 ? '' : 's'} turned strong`,
  practiceKindsTried: (n) => `${n} kinds of practice tried`,
  plannedWeeks: (n) => `${n} week${n === 1 ? '' : 's'} on plan`,
  perfectSetsLevel2: (n) => `${n} perfect set${n === 1 ? '' : 's'} at level 2+`,
};

/** The target in words, for the parent and student screens. */
export function parentTargetLabel(target: ParentRewardTarget): string {
  if (target.kind === 'stat') return STAT_WORDS[target.stat](target.atLeast);
  if (target.kind === 'date') {
    const date = new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${target.on}T00:00:00Z`));
    return `On ${date}`;
  }
  return REWARDS.find((r) => r.id === target.rewardId)?.name ?? target.rewardId;
}

/**
 * GET /v1/student/rewards/effect-styles (J10b): the effect styles this student has unlocked.
 * `testerStyles` (J12c) is only sent on the dev environment: every style a tester may try there.
 */
export const EffectStylesResponseSchema = z.object({
  unlocked: z.array(z.string()),
  testerStyles: z.array(z.string()).optional(),
});
export type EffectStylesResponse = z.infer<typeof EffectStylesResponseSchema>;
