/**
 * Real sources for the level and parent-set reward panels, from the rewards progression
 * (workstream R). They use R's read-only `rewardsProgress`, so the numbers match the Rewards
 * page and nothing is saved: the student's own Rewards page still announces new rewards. The
 * stats routes check the family before an adapter is called.
 */
import { eq } from 'drizzle-orm';
import { students, type Database } from '@revisionden/db';
import type { Clock } from '../rate-limit';
import { rewardsProgress } from '../routes/rewards';
import { notFound } from '../errors';
import { toRewardPanel, type StatsAdapters } from './adapters';

export function rewardAdapters(deps: {
  db: Database;
  clock: Clock;
}): Pick<StatsAdapters, 'rewards' | 'level'> {
  async function progress(studentId: string) {
    const [student] = await deps.db
      .select({ id: students.id, yearGroup: students.yearGroup })
      .from(students)
      .where(eq(students.id, studentId));
    if (!student) throw notFound('Student not found');
    return rewardsProgress(deps.db, student, deps.clock.now());
  }

  return {
    rewards: async (studentId) => toRewardPanel((await progress(studentId)).parentRewards),
    level: async (studentId) => {
      const { level, xpIntoLevel, xpForNext } = (await progress(studentId)).overview.level;
      return { level, xpIntoLevel, xpForNextLevel: xpForNext };
    },
  };
}
