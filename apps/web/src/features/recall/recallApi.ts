import { createContext, useContext } from 'react';
import { LessonResponseSchema, type LessonResponse } from '@revisionden/core';
import { apiRequest } from '../../api/client';
import { defaultBaseUrl } from '../../api/ApiContext';

export interface RecallApi {
  getRecall(topicId: string): Promise<LessonResponse>;
}

/** Client for GET /v1/student/recall (recall checks at the start of a lesson). */
export function createRecallApi({
  baseUrl,
  fetch = (...args) => globalThis.fetch(...args),
}: {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
}): RecallApi {
  return {
    getRecall: (topicId) =>
      apiRequest(
        { baseUrl, fetch },
        `v1/student/recall?topicId=${encodeURIComponent(topicId)}`,
        LessonResponseSchema,
        { method: 'GET' },
      ),
  };
}

const RecallApiContext = createContext<RecallApi>(
  createRecallApi({ baseUrl: defaultBaseUrl(import.meta.env, window.location.origin) }),
);

export const RecallApiProvider = RecallApiContext.Provider;

export function useRecallApi(): RecallApi {
  return useContext(RecallApiContext);
}
