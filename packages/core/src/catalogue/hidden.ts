/**
 * Hidden tracks and secret achievements (see docs/REWARDS.md "Bug Hunter track (hidden)" and
 * "Secret achievements"). Hidden tracks stay invisible until their first step is earned; secret
 * achievements show as "???" until earned. All targets measure learning or helping, never time.
 */
import type { Rarity, Reward, RewardItem, StatKey } from './types';

const step = (
  track: string,
  stat: StatKey,
  atLeast: number,
  name: string,
  rarity: Rarity,
  items: RewardItem[],
): Reward => ({
  id: `${track}-${atLeast}`,
  name,
  rarity,
  source: 'hidden',
  track,
  target: { kind: 'stat', stat, atLeast },
  items,
  giftDays: 0,
});

/** Bug Hunter: confirmed bug reports (the operator confirms each one; workstream L). */
export const BUG_HUNTER_REWARDS: readonly Reward[] = [
  step('bug-hunter', 'confirmedBugs', 1, 'First bug squashed', 'common', [
    { kind: 'badge', id: 'bug-hunter' },
  ]),
  step('bug-hunter', 'confirmedBugs', 2, '"Bug Hunter" title', 'common', [
    { kind: 'title', text: 'Bug Hunter' },
  ]),
  step('bug-hunter', 'confirmedBugs', 3, 'Magnifying glass', 'rare', [
    { kind: 'avatar', layer: 'heldItem', id: 'magnifier' },
  ]),
  step('bug-hunter', 'confirmedBugs', 5, 'Circuit-board frame', 'rare', [
    { kind: 'frame', id: 'circuit-board' },
  ]),
  step('bug-hunter', 'confirmedBugs', 8, 'Pip debug outfit', 'epic', [
    { kind: 'pipOutfit', id: 'debug' },
  ]),
  step('bug-hunter', 'confirmedBugs', 12, 'Glitch effect', 'epic', [
    { kind: 'effect', id: 'glitch' },
  ]),
  step('bug-hunter', 'confirmedBugs', 20, 'Exterminator set', 'legendary', [
    { kind: 'frame', id: 'exterminator' },
    { kind: 'title', text: 'Exterminator' },
    { kind: 'pipOutfit', id: 'exterminator' },
  ]),
];

const secret = (
  id: string,
  name: string,
  rarity: Rarity,
  stat: StatKey,
  atLeast: number,
  hint?: string,
): Reward => ({
  id: `secret-${id}`,
  name,
  rarity,
  source: 'secret',
  secret: true,
  ...(hint && { hint }),
  target: { kind: 'stat', stat, atLeast },
  items: [{ kind: 'badge', id: `secret-${id}` }],
  giftDays: 0,
});

/** Secret achievements: names and conditions hidden until earned. */
export const SECRET_REWARDS: readonly Reward[] = [
  secret('comeback', 'Comeback', 'epic', 'comebackRuns', 1, 'Something about comebacks…'),
  secret('all-rounder', 'All-Rounder', 'epic', 'allSubjectsWeeks', 1, 'Leave no subject behind'),
  secret('combo-ten', 'Combo Ten', 'rare', 'bestCorrectRun', 10, 'Keep it going…'),
  secret('patch-day', 'Patch Day', 'epic', 'bestWeakSpotsFixedInDay', 3, 'Three fixes, one day'),
  secret('on-pace', 'On Pace', 'epic', 'pacedPapers', 1, 'Beat the clock, every time'),
  secret('card-shark', 'Card Shark', 'epic', 'bestFlashcardsWeek', 100),
  secret('generous', 'Generous', 'rare', 'friendsGiftedTo', 3, 'Sharing is caring'),
  secret('first-light', 'First Light', 'rare', 'correctAnswers', 1),
  secret('big-day', 'Big Day', 'rare', 'bestCorrectInDay', 50),
  secret('topic-hopper', 'Topic Hopper', 'rare', 'bestTopicsInDay', 7, 'Variety is the spice'),
  secret('essay-ace', 'Essay Ace', 'epic', 'fullMarkLongAnswers', 1),
  secret('working-wizard', 'Working Wizard', 'epic', 'perfectWorkings', 10, 'Show your working'),
  secret('polymath', 'Polymath', 'epic', 'subjectsPractised', 5),
  secret('full-tank', 'Full Tank', 'rare', 'bestRewardDayXp', 300),
  secret('hot-streak', 'Hot Streak', 'rare', 'bestCorrectRun', 15),
  secret('starter-pack', 'Starter Pack', 'rare', 'startingTestsCompleted', 3),
  secret('deep-diver', 'Deep Diver', 'epic', 'bestTopicAnswers', 50, 'Go deeper on one thing'),
  secret('weekender', 'Weekender', 'rare', 'fullWeekends', 1),
  secret('perfect-week', 'Perfect Week', 'epic', 'perfectWeeks', 1, 'Seven out of seven'),
  secret('mix-master', 'Mix Master', 'epic', 'itemTypesAnswered', 6),
  secret('chapter-champ', 'Chapter Champ', 'legendary', 'chaptersFilled', 1),
  secret('marathon', 'Marathon Week', 'epic', 'bestCorrectInWeek', 200),
  secret('steady', 'Steady Eddie', 'epic', 'bestGoalDaysInMonth', 20),
  secret('triple-threat', 'Triple Threat', 'legendary', 'bestSubjectsInDay', 3),
];
