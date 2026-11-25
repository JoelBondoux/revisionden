import { createContext, useContext } from 'react';
import { z, type ZodType } from 'zod';
import {
  ParentDailyLimitSchema,
  ParentDashboardSchema,
  StudentDailyLimitSchema,
  StudentStatsSchema,
  type ParentDailyLimit,
  type ParentDashboard,
  type StatsPeriod,
  type StudentDailyLimit,
  type StudentStats,
  type UpdateDailyLimitRequest,
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
  /** The student's own daily limit and minutes left (workstream K7). */
  getMyDailyLimit(): Promise<StudentDailyLimit>;
  markDailyLimitSeen(): Promise<void>;
  getDailyLimit(studentId: string): Promise<ParentDailyLimit>;
  saveDailyLimit(studentId: string, change: UpdateDailyLimitRequest): Promise<ParentDailyLimit>;
  answerSuggestion(studentId: string, action: 'accept' | 'dismiss'): Promise<ParentDailyLimit>;
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
  const send = <T>(method: string, path: string, schema: ZodType<T>, body?: unknown) =>
    apiRequest({ baseUrl, fetch }, `v1/${path}`, schema, {
      method,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const limitPath = (id: string) => `students/${encodeURIComponent(id)}/daily-limit`;

  return {
    getMyStats: (period) => get(`student/stats?period=${period}`, StudentStatsSchema),
    getChildren: async () => (await get('students', ChildrenSchema)).students,
    getDashboard: (id) =>
      get(`students/${encodeURIComponent(id)}/dashboard`, ParentDashboardSchema),
    getMyDailyLimit: () => get('student/daily-limit', StudentDailyLimitSchema),
    markDailyLimitSeen: async () =>
      void (await send('POST', 'student/daily-limit/seen', z.unknown())),
    getDailyLimit: (id) => get(limitPath(id), ParentDailyLimitSchema),
    saveDailyLimit: (id, change) => send('PUT', limitPath(id), ParentDailyLimitSchema, change),
    answerSuggestion: (id, action) =>
      send('POST', `${limitPath(id)}/suggestion`, ParentDailyLimitSchema, { action }),
  };
}

const StatsApiContext = createContext<StatsApi>(
  createStatsApi({ baseUrl: defaultBaseUrl(import.meta.env, window.location.origin) }),
);

export const StatsApiProvider = StatsApiContext.Provider;

export function useStatsApi(): StatsApi {
  return useContext(StatsApiContext);
}
