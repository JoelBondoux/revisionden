import type { Family, LearningPath, Lesson } from '../api/schemas';

/* Made-up demo data. Never put real names, schools or answers here. */

export const family: Family = {
  students: [
    { id: 'student-1', nickname: 'NovaFox', avatarCode: 'av1-a3f9', yearGroup: 11 },
    { id: 'student-2', nickname: 'PixelOwl', avatarCode: 'av1-7c21', yearGroup: 13 },
  ],
};

export const learningPath: LearningPath = {
  subject: 'Maths',
  qualification: 'GCSE Higher',
  streakDays: 4,
  xpToday: 30,
  dailyGoalXp: 50,
  units: [
    {
      id: 'number',
      title: 'Number',
      nodes: [
        { id: 'n1', title: 'Fractions', lessonId: 'fractions', status: 'done' },
        { id: 'n2', title: 'Indices', lessonId: 'indices', status: 'done' },
        { id: 'n3', title: 'Surds', lessonId: 'surds', status: 'weak' },
        { id: 'n4', title: 'Standard form', lessonId: 'standard-form', status: 'current' },
        { id: 'n5', title: 'Bounds', lessonId: 'bounds', status: 'locked' },
      ],
    },
    {
      id: 'algebra',
      title: 'Algebra',
      nodes: [
        { id: 'a1', title: 'Expanding brackets', lessonId: 'expanding', status: 'locked' },
        { id: 'a2', title: 'Factorising', lessonId: 'factorising', status: 'locked' },
      ],
    },
  ],
};

export const lessons: Record<string, Lesson> = {
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
