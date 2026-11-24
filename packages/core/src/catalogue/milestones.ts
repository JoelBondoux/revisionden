/**
 * Long-term milestone ladders (see docs/REWARDS.md "Milestones"). The 14 original rewards keep
 * their ids and their avatar items, so rewards already earned stay earned.
 */
import type { AvatarLayer } from '../avatar';
import type { Rarity, Reward, RewardItem, StatKey } from './types';

const milestone = (
  id: string,
  name: string,
  rarity: Rarity,
  stat: StatKey,
  atLeast: number,
  items: RewardItem[] = [{ kind: 'badge', id }],
  giftDays = 0,
): Reward => ({
  id,
  name,
  rarity,
  source: 'milestone',
  target: { kind: 'stat', stat, atLeast },
  items,
  giftDays,
});

const avatar = (layer: AvatarLayer, id: string): RewardItem => ({
  kind: 'avatar',
  layer,
  id,
});

export const MILESTONE_REWARDS: readonly Reward[] = [
  // Streak days (gift days: 7 → 1, 30 → 2, 100 → 3, 365 → 5, 1,000 → 10).
  milestone(
    'streak-7',
    '7-day streak',
    'common',
    'bestStreak',
    7,
    [avatar('hairColour', 'neon-green')],
    1,
  ),
  milestone(
    'streak-30',
    '30-day streak',
    'common',
    'bestStreak',
    30,
    [avatar('hairColour', 'hot-pink')],
    2,
  ),
  milestone('streak-60', '60-day streak', 'rare', 'bestStreak', 60),
  milestone(
    'streak-100',
    '100-day streak',
    'rare',
    'bestStreak',
    100,
    [avatar('headwear', 'crown'), avatar('skin', 'alien')],
    3,
  ),
  milestone('streak-180', '180-day streak', 'rare', 'bestStreak', 180),
  milestone(
    'streak-365',
    'A whole year of streak',
    'epic',
    'bestStreak',
    365,
    [
      { kind: 'badge', id: 'streak-365' },
      { kind: 'title', text: 'Year-Rounder' },
    ],
    5,
  ),
  milestone('streak-500', '500-day streak', 'epic', 'bestStreak', 500),
  milestone('streak-750', '750-day streak', 'epic', 'bestStreak', 750),
  milestone(
    'streak-1000',
    '1,000-day streak',
    'legendary',
    'bestStreak',
    1000,
    [
      { kind: 'badge', id: 'streak-1000' },
      { kind: 'frame', id: 'thousand-days' },
      { kind: 'title', text: 'Unbreakable' },
    ],
    10,
  ),

  // Questions answered correctly.
  milestone('correct-100', '100 right answers', 'common', 'correctAnswers', 100),
  milestone('correct-500', '500 right answers', 'common', 'correctAnswers', 500),
  milestone('correct-1000', '1,000 right answers', 'rare', 'correctAnswers', 1000),
  milestone('correct-2500', '2,500 right answers', 'rare', 'correctAnswers', 2500),
  milestone('correct-5000', '5,000 right answers', 'epic', 'correctAnswers', 5000),
  milestone('correct-10000', '10,000 right answers', 'epic', 'correctAnswers', 10000),
  milestone('correct-25000', '25,000 right answers', 'legendary', 'correctAnswers', 25000),

  // Topics mastered in one subject.
  milestone(
    'subject-topics-5',
    '5 topics mastered in a subject',
    'common',
    'bestSubjectTopicsMastered',
    5,
  ),
  milestone(
    'subject-topics-10',
    '10 topics mastered in a subject',
    'rare',
    'bestSubjectTopicsMastered',
    10,
  ),
  milestone(
    'subject-topics-25',
    '25 topics mastered in a subject',
    'rare',
    'bestSubjectTopicsMastered',
    25,
  ),
  milestone(
    'subject-mastery-50',
    'Half a subject mastered',
    'rare',
    'bestSubjectMasteryPercent',
    50,
  ),
  milestone(
    'subject-mastery-75',
    'Three quarters of a subject mastered',
    'epic',
    'bestSubjectMasteryPercent',
    75,
  ),
  milestone('subject-master', 'Subject master', 'legendary', 'bestSubjectMasteryPercent', 100, [
    { kind: 'badge', id: 'subject-master' },
    { kind: 'title', text: 'Subject Master' },
  ]),
  milestone('topics-mastered-10', '10 topics mastered', 'common', 'topicsMastered', 10, [
    avatar('skin', 'robot'),
  ]),

  // Weak spots fixed.
  milestone('weak-spots-10', '10 weak spots fixed', 'common', 'weakSpotsFixed', 10, [
    avatar('eyewear', 'night-vision'),
  ]),
  milestone('weak-spots-25', '25 weak spots fixed', 'common', 'weakSpotsFixed', 25),
  milestone('weak-spots-50', '50 weak spots fixed', 'rare', 'weakSpotsFixed', 50),
  milestone('weak-spots-100', '100 weak spots fixed', 'rare', 'weakSpotsFixed', 100),
  milestone('weak-spots-250', '250 weak spots fixed', 'epic', 'weakSpotsFixed', 250),

  // Full past papers.
  milestone('full-past-paper', 'Full past paper', 'common', 'fullPastPapers', 1, [
    avatar('eyewear', 'laser-visor'),
  ]),
  milestone('past-papers-5', '5 full past papers', 'common', 'fullPastPapers', 5),
  milestone('past-papers-10', '10 full past papers', 'rare', 'fullPastPapers', 10),
  milestone('past-papers-25', '25 full past papers', 'rare', 'fullPastPapers', 25),
  milestone('past-papers-50', '50 full past papers', 'epic', 'fullPastPapers', 50),
  milestone('past-papers-100', '100 full past papers', 'epic', 'fullPastPapers', 100),

  // Mock and assessment grades.
  milestone('mock-target-hit', 'Target grade in a mock', 'common', 'mocksWithTargetHit', 1, [
    avatar('top', 'captain-shirt'),
  ]),
  milestone(
    'assessment-all-targets',
    'Every target at an assessment',
    'rare',
    'assessmentsWithAllTargetsHit',
    1,
    [avatar('top', 'gold-hoodie')],
  ),
  milestone('mock-beat-target', 'Beat a target grade', 'rare', 'mocksAboveTarget', 1),

  // Flashcards reviewed.
  milestone('flashcards-500', '500 flashcards reviewed', 'common', 'flashcardsReviewed', 500),
  milestone('flashcards-2500', '2,500 flashcards reviewed', 'rare', 'flashcardsReviewed', 2500),
  milestone('flashcards-10000', '10,000 flashcards reviewed', 'epic', 'flashcardsReviewed', 10000),

  // Kindness.
  milestone('gift-3-days', 'Gave 3 days', 'common', 'daysGifted', 3, [
    avatar('heldItem', 'dino-buddy'),
  ]),
  milestone('gift-10-days', 'Gave 10 days', 'rare', 'daysGifted', 10),
  milestone('gift-25-days', 'Gave 25 days', 'epic', 'daysGifted', 25, [
    { kind: 'badge', id: 'gift-25-days' },
    { kind: 'title', text: 'Big Heart' },
  ]),
  milestone('gift-5-friends', 'Gifted 5 friends', 'rare', 'friendsGiftedTo', 5, [
    avatar('headwear', 'dino-hood'),
  ]),
  milestone('gift-15-friends', 'Gifted 15 friends', 'epic', 'friendsGiftedTo', 15),

  // Friends league.
  milestone('league-top', 'Top of the friends league', 'common', 'weeksTopOfLeague', 1, [
    avatar('heldItem', 'trophy'),
  ]),
  milestone('league-wins-5', '5 league wins', 'rare', 'weeksTopOfLeague', 5),
  milestone('league-wins-20', '20 league wins', 'epic', 'weeksTopOfLeague', 20),

  // Exams.
  milestone('exam-first-gcse', 'First GCSE exam sat', 'rare', 'gcseExamsSat', 1),
  milestone('exam-all-gcses', 'Every GCSE sat', 'epic', 'gcseFinished', 1),
  milestone('exam-first-a-level', 'First A-Level exam sat', 'rare', 'aLevelExamsSat', 1),
  milestone('exam-all-a-levels', 'Every A-Level sat', 'legendary', 'aLevelFinished', 1),

  // Early wins.
  milestone('perfect-set', 'Perfect set', 'common', 'perfectSets', 1, [
    avatar('heldItem', 'pixel-sword'),
  ]),
  milestone('starting-test', 'Starting test done', 'common', 'startingTestsCompleted', 1, [
    avatar('scene', 'jungle'),
  ]),
  milestone('correct-25-in-a-row', '25 right in a row', 'common', 'bestCorrectRun', 25, [
    avatar('scene', 'space'),
  ]),
];
