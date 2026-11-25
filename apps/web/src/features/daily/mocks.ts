/** Mock 5-a-day (MSW) for development and tests: made-up demo items, not educational content. */
import { http, HttpResponse, type RequestHandler } from 'msw';
import type { DailySetResponse } from '@revisionden/core';
import { demoItems } from '../learn/mocks';

export const demoDaily: DailySetResponse = {
  day: '2026-11-25',
  items: [demoItems[0]!, demoItems[1]!],
  draftContent: true,
  answeredItemIds: [],
  answered: 0,
  total: 2,
  done: false,
};

export const dailyHandlers: RequestHandler[] = [
  http.get('*/v1/student/daily', () => HttpResponse.json(demoDaily)),
];
