import type { CardsDue, Family, Lesson, TopicMap } from '../api/schemas';

/* Made-up demo data. Never put real names, schools or answers here. */

export const family: Family = {
  students: [
    { id: 'student-1', nickname: 'NovaFox', avatarCode: 'av1-a3f9', yearGroup: 11 },
    { id: 'student-2', nickname: 'PixelOwl', avatarCode: 'av1-7c21', yearGroup: 13 },
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

export const lessons: Record<string, Lesson> = {
  surds: {
    id: 'surds',
    title: 'Surds',
    topic: 'Number',
    items: [
      {
        id: 'su-1',
        type: 'multiple-choice',
        prompt: 'Simplify √12.',
        options: [
          { id: 'a', text: '2√3' },
          { id: 'b', text: '3√2' },
          { id: 'c', text: '4√3' },
        ],
      },
      { id: 'su-2', type: 'short-answer', prompt: 'Work out √2 × √8.' },
    ],
  },
  'standard-form': {
    id: 'standard-form',
    title: 'Standard form',
    topic: 'Number',
    items: [
      {
        id: 'sf-1',
        type: 'multiple-choice',
        prompt: 'Write 45 000 in standard form.',
        options: [
          { id: 'a', text: '4.5 × 10⁴' },
          { id: 'b', text: '45 × 10³' },
          { id: 'c', text: '4.5 × 10³' },
          { id: 'd', text: '0.45 × 10⁵' },
        ],
      },
      {
        id: 'sf-2',
        type: 'short-answer',
        prompt: 'Write 3.2 × 10⁻³ as an ordinary number.',
      },
      {
        id: 'sf-3',
        type: 'multiple-choice',
        prompt: 'Which number is the largest?',
        options: [
          { id: 'a', text: '2.1 × 10⁵' },
          { id: 'b', text: '9.8 × 10⁴' },
          { id: 'c', text: '1.5 × 10⁵' },
        ],
      },
    ],
  },
};

interface AnswerKey {
  answer: string;
  display: string;
  explanation: string;
}

export const answerKeys: Record<string, AnswerKey> = {
  'su-1': {
    answer: 'a',
    display: '2√3',
    explanation: '12 = 4 × 3, and √4 = 2, so √12 = 2√3.',
  },
  'su-2': {
    answer: '4',
    display: '4',
    explanation: '√2 × √8 = √16 = 4.',
  },
  'sf-1': {
    answer: 'a',
    display: '4.5 × 10⁴',
    explanation: 'The first number must be between 1 and 10, so 45 000 = 4.5 × 10 000.',
  },
  'sf-2': {
    answer: '0.0032',
    display: '0.0032',
    explanation: 'A power of −3 moves the decimal point three places to the left.',
  },
  'sf-3': {
    answer: 'a',
    display: '2.1 × 10⁵',
    explanation: 'Compare the powers first: 10⁵ beats 10⁴, then 2.1 beats 1.5.',
  },
};

export const XP_PER_CORRECT = 10;
