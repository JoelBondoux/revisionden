import { createContext, useContext } from 'react';
import { DailySetResponseSchema, type DailySetResponse } from '@revisionden/core';
import { apiRequest } from '../../api/client';
import { defaultBaseUrl } from '../../api/ApiContext';

export interface DailyApi {
  getDaily(): Promise<DailySetResponse>;
}

interface Options {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
}

/** Client for GET /v1/student/daily (the student's 5-a-day for today). */
export function createDailyApi({
  baseUrl,
  fetch = (...args) => globalThis.fetch(...args),
}: Options): DailyApi {
  return {
    getDaily: () =>
      apiRequest({ baseUrl, fetch }, 'v1/student/daily', DailySetResponseSchema, {
        method: 'GET',
      }),
  };
}

const DailyApiContext = createContext<DailyApi>(
  createDailyApi({ baseUrl: defaultBaseUrl(import.meta.env, window.location.origin) }),
);

export const DailyApiProvider = DailyApiContext.Provider;

export function useDailyApi(): DailyApi {
  return useContext(DailyApiContext);
}
