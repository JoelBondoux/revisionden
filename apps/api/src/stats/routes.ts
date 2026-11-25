/**
 * Statistics dashboards (workstream K). Read-only.
 * - GET /v1/student/stats?period=week|term|year: the signed-in student's own stats.
 * - GET /v1/students/:id/stats?period=...: the same, for a parent's own child.
 * - GET /v1/students/:id/dashboard: the parent dashboard for a parent's own child.
 * Parents only ever reach their own family's children (404 otherwise).
 */
import { Hono } from 'hono';
import { StatsQuerySchema } from '@revisionden/core';
import type { Database } from '@revisionden/db';
import type { AppConfig } from '../env';
import type { AppEnv } from '../context';
import { requireFamilyStudent } from '../families';
import type { Clock } from '../rate-limit';
import { aiAllowanceFor, monthStart, monthlySpendMicroUsd } from '../ai/gateway';
import { NOT_SET_UP, type StatsAdapters } from './adapters';
import { buildDashboard, buildStudentStats } from './build';
import { loadStatsData } from './load';
import { rewardAdapters } from './reward-adapters';
import { targetGradeAdapters, targetGrades } from './target-grades';

export interface StatsDeps {
  db: Database;
  clock: Clock;
  config: AppConfig;
  statsAdapters?: Partial<StatsAdapters>;
}

const adaptersOf = (deps: StatsDeps): StatsAdapters => ({
  ...NOT_SET_UP,
  ...rewardAdapters(deps),
  ...targetGradeAdapters(deps),
  targets: async (studentId) => (await targetGrades(deps.db, studentId)).subjects,
  ...deps.statsAdapters,
});

async function studentStats(deps: StatsDeps, studentId: string, query: unknown) {
  const { period } = StatsQuerySchema.parse(query);
  const now = deps.clock.now();
  const data = await loadStatsData(deps.db, studentId, now);
  return buildStudentStats(studentId, data, period, now, adaptersOf(deps));
}

/** Mounted under /v1/student, after the student session check. */
export function studentStatsRoutes(deps: StatsDeps) {
  const app = new Hono<AppEnv>();
  app.get('/stats', async (c) =>
    c.json(await studentStats(deps, c.var.student.studentId, c.req.query())),
  );
  return app;
}

/** Mounted under /v1/students, after the parent session check. */
export function parentStatsRoutes(deps: StatsDeps) {
  const app = new Hono<AppEnv>();

  app.get('/:id/stats', async (c) => {
    const student = await requireFamilyStudent(deps.db, c.var.parent.familyId, c.req.param('id'));
    return c.json(await studentStats(deps, student.id, c.req.query()));
  });

  app.get('/:id/dashboard', async (c) => {
    const student = await requireFamilyStudent(deps.db, c.var.parent.familyId, c.req.param('id'));
    const now = deps.clock.now();
    const data = await loadStatsData(deps.db, student.id, now);
    // Families never see money for AI: only the share of the allowance used (K9).
    const aiAllowance = aiAllowanceFor(
      monthStart(now),
      await monthlySpendMicroUsd(deps.db, student.id, now),
      deps.config.ai.monthlyCapMicroUsd,
    );
    const dashboard = await buildDashboard(
      { id: student.id, nickname: student.nickname },
      data,
      now,
      aiAllowance,
      adaptersOf(deps),
    );
    return c.json(dashboard);
  });

  return app;
}
