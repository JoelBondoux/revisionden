import { describe, expect, it } from 'vitest';
import {
  ParentDashboardSchema,
  StatsQuerySchema,
  StudentStatsSchema,
  type ParentDashboard,
  type StudentStats,
} from './stats-schemas';

const sampleStudentStats: StudentStats = {
  period: 'week',
  range: { start: '2026-11-23', end: '2026-11-30', label: 'Week of 23 Nov' },
  tiles: {
    xp: { value: 120, previous: 90 },
    answered: { value: 30, correct: 24, previous: 20 },
    accuracy: { value: 82, previous: null },
    streak: { current: 4 },
  },
  chart: {
    buckets: [{ start: '2026-11-23', label: 'Mon', value: 50 }],
    goal: 50,
  },
  mastery: [{ subjectId: 'gcse-maths', name: 'Maths', mastery: 64, change: 3 }],
  personalBests: {
    longestStreak: 9,
    longestCorrectRun: 12,
    bestWeek: { weekStart: '2026-11-16', xp: 300 },
  },
  level: null,
};

const sampleDashboard: ParentDashboard = {
  student: { id: '00000000-0000-4000-8000-000000000001', nickname: 'demo_kid' },
  week: { start: '2026-11-23', end: '2026-11-30', label: 'Week of 23 Nov' },
  timeZone: 'Europe/London',
  tiles: {
    activeMinutes: { value: 95, previous: 80 },
    planKept: null,
    accuracy: { value: 70, previous: 75 },
    streak: { current: 4, best: 9 },
  },
  studyTime: { weeks: [{ start: '2026-11-23', label: '23 Nov', value: 95 }], planMinutes: null },
  subjects: [
    {
      subjectId: 'gcse-maths',
      name: 'Maths',
      mastery: 64,
      change: -2,
      predictedGrade: null,
      targetGrade: null,
    },
  ],
  weakSpots: [{ topicId: 't1', title: 'Topic one', subjectId: 'gcse-maths', then: 40, now: 45 }],
  effortScores: null,
  rewards: [],
  healthyHabits: { quietHourSessions: 0, daysOverCap: 0, restDays: 1, dailyCapMinutes: 120 },
  aiSpend: { month: '2026-11', spentMicroUsd: 10_000, capMicroUsd: 2_500_000 },
  recentActivity: [
    { kind: 'lesson', at: '2026-11-24T16:00:00.000Z', count: 8, subjectId: 'gcse-maths' },
  ],
};

describe('stats schemas', () => {
  it('accepts a full student stats response', () => {
    expect(StudentStatsSchema.parse(sampleStudentStats)).toEqual(sampleStudentStats);
  });

  it('accepts a parent dashboard with panels that are not set up yet', () => {
    expect(ParentDashboardSchema.parse(sampleDashboard)).toEqual(sampleDashboard);
  });

  it('takes parent-set rewards with their progress', () => {
    const rewards = [
      {
        title: 'Cinema trip',
        targetLabel: '30-day streak',
        current: 12,
        goal: 30,
        reached: false,
        given: false,
      },
    ];
    expect(ParentDashboardSchema.parse({ ...sampleDashboard, rewards }).rewards).toEqual(rewards);
    const tooLong = [{ ...rewards[0], title: 'x'.repeat(61) }];
    expect(ParentDashboardSchema.safeParse({ ...sampleDashboard, rewards: tooLong }).success).toBe(
      false,
    );
  });

  it('rejects free text the student might have written in recent activity', () => {
    const withText = {
      ...sampleDashboard,
      recentActivity: [{ ...sampleDashboard.recentActivity[0], note: 'my words' }],
    };
    expect(ParentDashboardSchema.safeParse(withText).success).toBe(false);
  });

  it('reads the period from the query, defaulting to the week', () => {
    expect(StatsQuerySchema.parse({})).toEqual({ period: 'week' });
    expect(StatsQuerySchema.parse({ period: 'term' })).toEqual({ period: 'term' });
    expect(StatsQuerySchema.safeParse({ period: 'decade' }).success).toBe(false);
  });
});
