/**
 * Shapes for the rewards catalogue (see docs/REWARDS.md). The catalogue is plain data: every
 * reward has one stated target, so there are no random draws and nothing is bought.
 */
import type { AvatarLayer } from '../avatar';

/**
 * Numbers a reward target can check. All of them measure learning, kindness or exams; none
 * measure time spent in the app (see the guard-rail tests).
 */
export interface RewardStats {
  /** Longest streak ever, in days. */
  bestStreak: number;
  /** Mocks where the student hit their target grade. */
  mocksWithTargetHit: number;
  /** Mocks where the student beat their target grade. */
  mocksAboveTarget: number;
  /** Assessments where the student hit every target. */
  assessmentsWithAllTargetsHit: number;
  fullPastPapers: number;
  /** Topics that were weak spots and are now at or above the weak-spot line. */
  weakSpotsFixed: number;
  /** Topics mastered across all subjects. */
  topicsMastered: number;
  /** Topics mastered in the student's best subject. */
  bestSubjectTopicsMastered: number;
  /** Share of topics mastered in the student's best subject, 0 to 100. */
  bestSubjectMasteryPercent: number;
  /** Sets with every question right (for example 5 out of 5). */
  perfectSets: number;
  correctAnswers: number;
  flashcardsReviewed: number;
  daysGifted: number;
  /** Different friends the student has gifted a day to. */
  friendsGiftedTo: number;
  weeksTopOfLeague: number;
  startingTestsCompleted: number;
  /** Most answers right in a row. */
  bestCorrectRun: number;
  /** Level 1 to 100 (see levels.ts). */
  level: number;
  prestigeStars: number;
  chapter1Xp: number;
  chapter2Xp: number;
  chapter3Xp: number;
  chapter4Xp: number;
  chapter5Xp: number;
  gcseExamsSat: number;
  /** 1 once the last GCSE exam is sat. */
  gcseFinished: number;
  aLevelExamsSat: number;
  /** 1 once the last A-Level exam is sat. */
  aLevelFinished: number;
  /** Bug reports the operator confirmed (one per distinct bug; workstream L). */
  confirmedBugs: number;
  // Secret achievement stats (see secret-stats.ts). All learning-based, none time-of-day.
  /** Five right in a row straight after three wrong in a row. */
  comebackRuns: number;
  /** Weeks in which every enrolled subject was practised. */
  allSubjectsWeeks: number;
  bestWeakSpotsFixedInDay: number;
  /** Timed papers with every question on pace (workstream X). */
  pacedPapers: number;
  bestFlashcardsWeek: number;
  bestCorrectInDay: number;
  bestCorrectInWeek: number;
  bestTopicsInDay: number;
  bestSubjectsInDay: number;
  subjectsPractised: number;
  /** Most answers given in a single topic. */
  bestTopicAnswers: number;
  /** Different answer types (of 6) answered correctly. */
  itemTypesAnswered: number;
  fullMarkLongAnswers: number;
  perfectWorkings: number;
  /** Most reward XP counted on one day (capped at the daily reward cap). */
  bestRewardDayXp: number;
  /** Weekends with the daily goal met on both Saturday and Sunday. */
  fullWeekends: number;
  /** Monday-to-Sunday weeks with the daily goal met every day. */
  perfectWeeks: number;
  bestGoalDaysInMonth: number;
  /** Year chapters filled to the end. */
  chaptersFilled: number;
  // Hidden track stats (R7b; see track-stats.ts).
  /** "Report a problem" reports the review queue confirmed as wrong (Fact Checker). */
  factChecks: number;
  /** Weak spots turned into strong topics (Comeback Kid). */
  weakSpotsTurnedStrong: number;
  /** Kinds of practice tried, out of 7 (Explorer). */
  practiceKindsTried: number;
  /** Weeks with at least 80% of planned sessions done (Planner). */
  plannedWeeks: number;
  /** Perfect sets at feedback level 2 or above (Perfectionist). */
  perfectSetsLevel2: number;
}

export type StatKey = keyof RewardStats;

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export const RARITIES: readonly Rarity[] = ['common', 'rare', 'epic', 'legendary'];

export type TitlePart = 'first' | 'last';

export type RewardSource =
  'level' | 'chapter' | 'milestone' | 'collection' | 'season' | 'hidden' | 'secret';

/** What the student gets. Avatar items point at a layer item in AVATAR_CATALOGUE. */
export type RewardItem =
  | { kind: 'avatar'; layer: AvatarLayer; id: string }
  | { kind: 'frame'; id: string }
  /**
   * A single title from R1 to R7b. Only in the source catalogue files: the exported REWARDS
   * replace it with two-part title words (R8, `title-words.ts`).
   */
  | { kind: 'title'; text: string }
  /** A word for a two-part title (R8): the student picks one first word and one last word. */
  | { kind: 'titleWord'; part: TitlePart; text: string }
  | { kind: 'theme'; id: string }
  | { kind: 'pipOutfit'; id: string }
  | { kind: 'badge'; id: string }
  /** An effect drawn over the avatar (for example the glitch effect). */
  | { kind: 'effect'; id: string };

export type UnlockTarget =
  | { kind: 'stat'; stat: StatKey; atLeast: number }
  /** Every member of the collection earned. */
  | { kind: 'collection'; collectionId: string }
  /** The season's challenge progress, counted inside its term window (or its re-release). */
  | { kind: 'season'; seasonId: string; atLeast: number };

export interface Reward {
  id: string;
  name: string;
  rarity: Rarity;
  source: RewardSource;
  target: UnlockTarget;
  items: readonly RewardItem[];
  /** Gift days that come with this reward (they can only be given to friends). */
  giftDays: number;
  /** Hidden track id: the track stays invisible until its first step is earned. */
  track?: string;
  /** Secret achievement: shown as "???" until earned. */
  secret?: boolean;
  /** Optional vague hint for a secret achievement. */
  hint?: string;
}

export interface Collection {
  id: string;
  name: string;
  /** Reward ids that make up the set. */
  members: readonly string[];
}

/** What a season's challenge counts, inside the window only. */
export type SeasonMeasure = 'correctAnswers' | 'goalDays';

export interface DateWindow {
  /** First day, YYYY-MM-DD (UK date), inclusive. */
  start: string;
  /** Last day, YYYY-MM-DD (UK date), inclusive. */
  end: string;
}

export interface Season {
  id: string;
  name: string;
  window: DateWindow;
  /** When missed items come back (the same term a year later). */
  rerelease: DateWindow;
  measure: SeasonMeasure;
  challenge: string;
}
