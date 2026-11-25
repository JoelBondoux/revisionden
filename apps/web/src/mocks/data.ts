import {
  DEFAULT_AVATAR,
  encodeAvatar,
  type OnboardedChild,
  type OnboardingFamily,
} from '@revisionden/core';
import type { CardsDue, TopicMap } from '@revisionden/core';

/* Made-up demo data. Never put real names, schools or answers here. */

const demoChild = (
  id: string,
  nickname: string,
  yearGroup: number,
  look: Partial<typeof DEFAULT_AVATAR>,
): OnboardedChild => {
  const level = yearGroup >= 12 ? 'a_level' : 'gcse';
  return {
    student: { id, nickname, avatarCode: encodeAvatar({ ...DEFAULT_AVATAR, ...look }), yearGroup },
    enrolments: [
      {
        studentId: id,
        subjectId: level === 'gcse' ? 'gcse-maths' : 'alevel-maths',
        board: 'Edexcel',
        tier: level === 'gcse' ? 'higher' : 'none',
      },
    ],
    level,
    examSeason: { season: 'summer', year: 2027 },
    toCheckLater: 0,
    linkedDevices: 1,
  };
};

/** The demo parent's family (`GET /v1/onboarding/family`). */
export const family: OnboardingFamily = {
  children: [
    demoChild('8f6d2b1e-4c3a-4d5e-9f00-000000000001', 'NovaFox', 11, { skin: 2 }),
    demoChild('8f6d2b1e-4c3a-4d5e-9f00-000000000002', 'PixelOwl', 13, { skin: 3, eyes: 1 }),
  ],
};

export const topicMap: TopicMap = {
  subject: 'Maths',
  qualification: 'GCSE Higher',
  streakDays: 4,
  xpToday: 30,
  dailyGoalXp: 50,
  nextMission: { kind: 'weak-spot', title: 'Fix weak spot: Surds', lessonId: 'surds', minutes: 8 },
  units: [
    {
      id: 'number',
      title: 'Number',
      masteryPercent: 57,
      topics: [
        { id: 'n1', title: 'Fractions', lessonId: 'fractions', status: 'mastered', mastery: 100 },
        { id: 'n2', title: 'Indices', lessonId: 'indices', status: 'mastered', mastery: 100 },
        { id: 'n3', title: 'Surds', lessonId: 'surds', status: 'weak', mastery: 38 },
        {
          id: 'n4',
          title: 'Standard form',
          lessonId: 'standard-form',
          status: 'in-progress',
          mastery: 45,
        },
        { id: 'n5', title: 'Bounds', lessonId: 'bounds', status: 'locked', mastery: 0 },
      ],
      challenge: { lessonId: 'number-challenge', unlockAtPercent: 80, unlocked: false },
    },
    {
      id: 'algebra',
      title: 'Algebra',
      masteryPercent: 0,
      topics: [
        { id: 'a1', title: 'Expanding', lessonId: 'expanding', status: 'locked', mastery: 0 },
        { id: 'a2', title: 'Factorising', lessonId: 'factorising', status: 'locked', mastery: 0 },
        { id: 'a3', title: 'Equations', lessonId: 'equations', status: 'locked', mastery: 0 },
      ],
      challenge: { lessonId: 'algebra-challenge', unlockAtPercent: 80, unlocked: false },
    },
  ],
};

export const cardsDue: CardsDue = { due: 12 };
