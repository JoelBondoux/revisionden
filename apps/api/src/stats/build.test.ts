import { describe, expect, it } from 'vitest';
import { ParentDashboardSchema, StudentStatsSchema } from '@revisionden/core';
import { DEFAULT_REMINDER_SETTINGS } from '../notifications/schedule';
import { NOT_SET_UP, toRewardPanel, type StatsAdapters } from './adapters';
import { buildDashboard, buildStudentStats } from './build';
import type { StudentStatsData } from './load';

const now = new Date('2026-11-24T10:00:00Z');
const t = Date.parse('2026-11-23T16:00:00Z');

const data: StudentStatsData = {
  answers: [{ at: t, score: 1, topicId: 'demo-topic', subjectId: 'not-a-known-subject' }],
  activity: [
    { kind: 'starting_test', at: t, subjectId: 'gcse-maths' },
    { kind: 'test', at: t + 60 * 60_000, subjectId: 'gcse-maths' },
  ],
  days: [{ day: '2026-11-23', xp: 10 }],
  streak: { current: 1, best: 1 },
  topicTitles: new Map(),
  settings: DEFAULT_REMINDER_SETTINGS,
};

const wired: StatsAdapters = {
  rewards: async () => [
    {
      title: 'Cinema trip',
      targetLabel: '30-day streak',
      current: 12,
      goal: 30,
      reached: false,
      given: false,
    },
  ],
  level: async (_id, xp) => ({ level: 2, xpIntoLevel: xp, xpForNextLevel: 100 }),
  plan: async () => ({ kept: { done: 3, planned: 4 }, minutes: 150 }),
  effortScores: async () => ({
    date: '2026-11-01',
    scores: [{ label: 'Commitment', value: '3', scale: '1 to 4' }],
  }),
  grades: async () => ({ predictedGrade: '6', targetGrade: '7' }),
};

const student = { id: '00000000-0000-4000-8000-000000000009', nickname: 'demo_kid' };
const aiAllowance = { percentUsed: 0, usedUp: false, resetsOn: '2026-12-01' };

describe('dashboard building', () => {
  it('passes through panels from features that are set up', async () => {
    const dashboard = ParentDashboardSchema.parse(
      await buildDashboard(student, data, now, aiAllowance, wired),
    );
    expect(dashboard.rewards.map((r) => r.title)).toEqual(['Cinema trip']);
    expect(dashboard.tiles.planKept).toEqual({ done: 3, planned: 4 });
    expect(dashboard.studyTime.planMinutes).toBe(150);
    expect(dashboard.effortScores?.scores).toHaveLength(1);
    expect(dashboard.subjects[0]).toMatchObject({ predictedGrade: '6', targetGrade: '7' });
    const stats = await buildStudentStats(student.id, data, 'week', now, wired);
    expect(stats.level).toEqual({ level: 2, xpIntoLevel: 10, xpForNextLevel: 100 });
  });

  it('falls back to the subject id for unknown subjects and names test activity', async () => {
    const dashboard = await buildDashboard(student, data, now, aiAllowance, NOT_SET_UP);
    expect(dashboard.subjects[0]!.name).toBe('not-a-known-subject');
    expect(dashboard.weakSpots[0]!.title).toBe('demo-topic');
    expect(dashboard.recentActivity.map((a) => a.kind)).toEqual(['test', 'starting_test']);
    const stats = StudentStatsSchema.parse(
      await buildStudentStats(student.id, data, 'year', now, NOT_SET_UP),
    );
    expect(stats.chart.goal).toBeNull();
  });
});

describe('parent-set reward panel', () => {
  const reward = (title: string, over: Record<string, unknown> = {}) => ({
    id: title,
    title,
    note: 'A note the student sees',
    target: { kind: 'date', on: '2027-01-01' },
    targetLabel: '30-day streak',
    reached: false,
    current: 12,
    goal: 30,
    givenAt: null,
    ...over,
  });

  it('maps R5 rewards to the panel, waiting ones first, without the note', () => {
    const panel = toRewardPanel([
      reward('Given', { reached: true, current: 30, givenAt: '2026-11-01T10:00:00.000Z' }),
      reward('Cinema trip'),
      reward('Met', { reached: true, current: 30 }),
    ]);
    expect(panel.map((r) => r.title)).toEqual(['Cinema trip', 'Met', 'Given']);
    expect(panel[0]).toEqual({
      title: 'Cinema trip',
      targetLabel: '30-day streak',
      current: 12,
      goal: 30,
      reached: false,
      given: false,
    });
    expect(panel[2]!.given).toBe(true);
    expect(JSON.stringify(panel)).not.toContain('A note');
  });
});
