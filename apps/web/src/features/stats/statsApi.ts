import { createContext, useContext } from 'react';
import { z, type ZodType } from 'zod';
import {
  ParentDashboardSchema,
  StudentStatsSchema,
  type ParentDashboard,
  type StatsPeriod,
  type StudentStats,
} from '@revisionden/core';
import { apiRequest } from '../../api/client';
import { defaultBaseUrl } from '../../api/ApiContext';

const ChildrenSchema = z.object({
  students: z.array(z.object({ id: z.string(), nickname: z.string() })),
});
export type Child = z.infer<typeof ChildrenSchema>['students'][number];

export interface StatsApi {
  /** The signed-in student's own stats (student device session). */
  getMyStats(period: StatsPeriod): Promise<StudentStats>;
  /** The signed-in parent's children (nicknames only). */
  getChildren(): Promise<Child[]>;
  getDashboard(studentId: string): Promise<ParentDashboard>;
}

/** Client for the stats routes (apps/api/src/stats). Sends the session cookies. */
export function createStatsApi({
  baseUrl,
  fetch = (...args) => globalThis.fetch(...args),
}: {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
}): StatsApi {
  const get = <T>(path: string, schema: ZodType<T>): Promise<T> =>
    apiRequest({ baseUrl, fetch }, `v1/${path}`, schema);

  return {
    getMyStats: (period) => get(`student/stats?period=${period}`, StudentStatsSchema),
    getChildren: async () => (await get('students', ChildrenSchema)).students,
    getDashboard: (id) =>
      get(`students/${encodeURIComponent(id)}/dashboard`, ParentDashboardSchema),
  };
}

const StatsApiContext = createContext<StatsApi>(
  createStatsApi({ baseUrl: defaultBaseUrl(import.meta.env, window.location.origin) }),
);

export const StatsApiProvider = StatsApiContext.Provider;

export function useStatsApi(): StatsApi {
  return useContext(StatsApiContext);
}
