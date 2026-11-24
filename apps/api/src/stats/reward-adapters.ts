/**
 * Real sources for the level and parent-set reward panels, from the rewards progression
 * (workstream R). They read R's own student rewards view (the code behind
 * GET /v1/student/rewards) in-process, so the numbers match the Rewards page and R's rules stay
 * in one place. The stats routes check the family before an adapter is called.
 */
import { Hono } from 'hono';
import { StudentRewardsResponseSchema, type StudentRewardsResponse } from '@revisionden/core';
import type { Database } from '@revisionden/db';
import type { AppEnv } from '../context';
import type { Clock } from '../rate-limit';
import { studentRewardRoutes } from '../routes/rewards';
import { toRewardPanel, type StatsAdapters } from './adapters';

export function rewardAdapters(deps: {
  db: Database;
  clock: Clock;
}): Pick<StatsAdapters, 'rewards' | 'level'> {
  async function view(studentId: string): Promise<StudentRewardsResponse> {
    const app = new Hono<AppEnv>();
    app.use('*', async (c, next) => {
      c.set('student', { studentId, familyId: '', deviceId: '' });
      await next();
    });
    app.route('/', studentRewardRoutes(deps));
    const res = await app.request('/');
    if (!res.ok) throw new Error(`Rewards view failed with ${res.status}`);
    return StudentRewardsResponseSchema.parse(await res.json());
  }

  return {
    rewards: async (studentId) => toRewardPanel((await view(studentId)).parentRewards),
    level: async (studentId) => {
      const { level, xpIntoLevel, xpForNext } = (await view(studentId)).overview.level;
      return { level, xpIntoLevel, xpForNextLevel: xpForNext };
    },
  };
}
