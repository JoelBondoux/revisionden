/**
 * Panels whose data belongs to features that are not built yet. Each adapter returns null
 * until its feature lands, and the web app shows "Not set up yet" (or "No plan yet"), never
 * zeros. Wire the real source in here when it reaches dev:
 * - reward: parent-set rewards (workstream R5)
 * - level: level curve from the rewards progression (workstream R, docs/REWARDS.md)
 * - plan: the study plan (sessions kept, weekly planned minutes)
 * - effortScores: the latest school report's effort scores
 * - grades: predicted and target grades per subject
 */
import type { ParentDashboard, StudentStats } from '@revisionden/core';

export interface StatsAdapters {
  reward(studentId: string): Promise<ParentDashboard['reward']>;
  level(studentId: string, totalXp: number): Promise<StudentStats['level']>;
  plan(
    studentId: string,
    weekStart: string,
  ): Promise<{ kept: NonNullable<ParentDashboard['tiles']['planKept']>; minutes: number } | null>;
  effortScores(studentId: string): Promise<ParentDashboard['effortScores']>;
  grades(
    studentId: string,
    subjectId: string,
  ): Promise<{ predictedGrade: string | null; targetGrade: string | null }>;
}

export const NOT_SET_UP: StatsAdapters = {
  reward: async () => null,
  level: async () => null,
  plan: async () => null,
  effortScores: async () => null,
  grades: async () => ({ predictedGrade: null, targetGrade: null }),
};
