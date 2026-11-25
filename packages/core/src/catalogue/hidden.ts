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

/** More hidden tracks (R7b): each invisible until its first step. */
export const MORE_HIDDEN_TRACK_REWARDS: readonly Reward[] = [
  // Fact Checker: reports the review queue confirmed as wrong (rare, so few steps).
  step('fact-checker', 'factChecks', 1, 'Fact checked', 'common', [
    { kind: 'badge', id: 'fact-checker' },
  ]),
  step('fact-checker', 'factChecks', 2, '"Fact Checker" title', 'rare', [
    { kind: 'title', text: 'Fact Checker' },
  ]),
  step('fact-checker', 'factChecks', 3, 'Quill', 'rare', [
    { kind: 'avatar', layer: 'heldItem', id: 'quill' },
  ]),
  step('fact-checker', 'factChecks', 5, 'Red-pen frame', 'epic', [
    { kind: 'frame', id: 'red-pen' },
  ]),
  step('fact-checker', 'factChecks', 8, 'Truth Seeker set', 'legendary', [
    { kind: 'frame', id: 'verified' },
    { kind: 'title', text: 'Truth Seeker' },
  ]),

  // Comeback Kid: weak spots turned into strong topics.
  step('comeback-kid', 'weakSpotsTurnedStrong', 1, 'Phoenix badge', 'common', [
    { kind: 'badge', id: 'phoenix' },
  ]),
  step('comeback-kid', 'weakSpotsTurnedStrong', 3, '"Comeback Kid" title', 'common', [
    { kind: 'title', text: 'Comeback Kid' },
  ]),
  step('comeback-kid', 'weakSpotsTurnedStrong', 5, 'Rising-flame frame', 'rare', [
    { kind: 'frame', id: 'rising-flame' },
  ]),
  step('comeback-kid', 'weakSpotsTurnedStrong', 10, 'Pip phoenix outfit', 'rare', [
    { kind: 'pipOutfit', id: 'phoenix' },
  ]),
  step('comeback-kid', 'weakSpotsTurnedStrong', 20, 'Embers effect', 'epic', [
    { kind: 'effect', id: 'embers' },
  ]),
  step('comeback-kid', 'weakSpotsTurnedStrong', 35, 'Rise Again set', 'legendary', [
    { kind: 'frame', id: 'phoenix-wings' },
    { kind: 'title', text: 'Risen' },
  ]),

  // Explorer: first use of each of the 7 kinds of practice.
  step('explorer', 'practiceKindsTried', 1, 'Compass badge', 'common', [
    { kind: 'badge', id: 'compass' },
  ]),
  step('explorer', 'practiceKindsTried', 2, '"Explorer" title', 'common', [
    { kind: 'title', text: 'Explorer' },
  ]),
  step('explorer', 'practiceKindsTried', 3, 'Map frame', 'common', [{ kind: 'frame', id: 'map' }]),
  step('explorer', 'practiceKindsTried', 4, 'Explorer hat', 'rare', [
    { kind: 'avatar', layer: 'headwear', id: 'explorer-hat' },
  ]),
  step('explorer', 'practiceKindsTried', 5, 'Trailhead theme', 'rare', [
    { kind: 'theme', id: 'trailhead' },
  ]),
  step('explorer', 'practiceKindsTried', 6, 'Pip trekker outfit', 'epic', [
    { kind: 'pipOutfit', id: 'trekker' },
  ]),
  step('explorer', 'practiceKindsTried', 7, 'Pathfinder set', 'epic', [
    { kind: 'frame', id: 'globe' },
    { kind: 'title', text: 'Pathfinder' },
  ]),

  // Planner: weeks with at least 80% of planned sessions done.
  step('planner', 'plannedWeeks', 1, 'Calendar badge', 'common', [
    { kind: 'badge', id: 'calendar' },
  ]),
  step('planner', 'plannedWeeks', 4, '"On Schedule" title', 'common', [
    { kind: 'title', text: 'On Schedule' },
  ]),
  step('planner', 'plannedWeeks', 8, 'Planner-grid frame', 'rare', [
    { kind: 'frame', id: 'planner-grid' },
  ]),
  step('planner', 'plannedWeeks', 16, 'Pip planner pack', 'epic', [
    { kind: 'pipOutfit', id: 'planner-pack' },
  ]),
  step('planner', 'plannedWeeks', 30, 'Master Planner set', 'legendary', [
    { kind: 'frame', id: 'golden-calendar' },
    { kind: 'title', text: 'Master Planner' },
  ]),

  // Pace Setter: timed papers with every question on pace (workstream X).
  step('pace-setter', 'pacedPapers', 1, 'Stopwatch badge', 'common', [
    { kind: 'badge', id: 'stopwatch' },
  ]),
  step('pace-setter', 'pacedPapers', 3, '"Cool Head" title', 'rare', [
    { kind: 'title', text: 'Cool Head' },
  ]),
  step('pace-setter', 'pacedPapers', 6, 'Pace stripes effect', 'epic', [
    { kind: 'effect', id: 'pace-stripes' },
  ]),
  step('pace-setter', 'pacedPapers', 10, 'Clockwork set', 'legendary', [
    { kind: 'frame', id: 'finish-line' },
    { kind: 'title', text: 'Clockwork' },
  ]),

  // Perfectionist: perfect sets at feedback level 2 or above.
  step('perfectionist', 'perfectSetsLevel2', 1, 'Diamond badge', 'common', [
    { kind: 'badge', id: 'diamond' },
  ]),
  step('perfectionist', 'perfectSetsLevel2', 5, '"Perfectionist" title', 'common', [
    { kind: 'title', text: 'Perfectionist' },
  ]),
  step('perfectionist', 'perfectSetsLevel2', 15, 'Crystal frame', 'rare', [
    { kind: 'frame', id: 'crystal' },
  ]),
  step('perfectionist', 'perfectSetsLevel2', 30, 'Pip jeweller outfit', 'rare', [
    { kind: 'pipOutfit', id: 'jeweller' },
  ]),
  step('perfectionist', 'perfectSetsLevel2', 60, 'Prism effect', 'epic', [
    { kind: 'effect', id: 'prism' },
  ]),
  step('perfectionist', 'perfectSetsLevel2', 100, 'Flawless set', 'legendary', [
    { kind: 'frame', id: 'flawless' },
    { kind: 'title', text: 'Flawless' },
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
