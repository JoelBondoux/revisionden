/**
 * Panels whose data belongs to features that are not built yet. Each adapter returns null
 * until its feature lands, and the web app shows "Not set up yet" (or "No plan yet"), never
 * zeros. Wire the real source in here when it reaches dev:
 * - rewards: parent-set rewards (workstream R5); map them with `toRewardPanel`
 * - level: level curve from the rewards progression (workstream R, docs/REWARDS.md)
 * - plan: the study plan (sessions kept, weekly planned minutes)
 * - effortScores: the latest school report's effort scores
 * - grades: predicted and target grades per subject (targets: workstream K8, target-grades.ts;
 *   predicted stays null until verified grade boundaries exist)
 */
import type { ParentDashboard, StudentStats } from '@revisionden/core';

export interface StatsAdapters {
  rewards(studentId: string): Promise<ParentDashboard['rewards']>;
  level(studentId: string, totalXp: number): Promise<StudentStats['level']>;
  plan(
    studentId: string,
    weekStart: string,
  ): Promise<{ kept: NonNullable<ParentDashboard['tiles']['planKept']>; minutes: number } | null>;
  effortScores(studentId: string): Promise<ParentDashboard['effortScores']>;
  /** Target grades set by a parent (workstream K8); only subjects with a target. */
  targets(studentId: string): Promise<StudentStats['targets']>;
  grades(
    studentId: string,
    subjectId: string,
  ): Promise<{ predictedGrade: string | null; targetGrade: string | null }>;
}

export const NOT_SET_UP: StatsAdapters = {
  rewards: async () => [],
  level: async () => null,
  plan: async () => null,
  effortScores: async () => null,
  targets: async () => [],
  grades: async () => ({ predictedGrade: null, targetGrade: null }),
};

/**
 * The fields of R5's `ParentReward` (GET /v1/students/:id/parent-rewards) that the panel
 * uses. Kept structural so this compiles before R5 reaches dev.
 */
export interface ParentRewardLike {
  title: string;
  targetLabel: string;
  current: number;
  goal: number;
  reached: boolean;
  givenAt: string | null;
}

/** Parent-set rewards for the dashboard: not yet given first; the note is left out. */
export function toRewardPanel(list: readonly ParentRewardLike[]): ParentDashboard['rewards'] {
  return [...list]
    .sort((a, b) => Number(a.givenAt !== null) - Number(b.givenAt !== null))
    .map((r) => ({
      title: r.title,
      targetLabel: r.targetLabel,
      current: r.current,
      goal: r.goal,
      reached: r.reached,
      given: r.givenAt !== null,
    }));
}
