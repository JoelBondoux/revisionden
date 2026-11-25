/** Mock recall checks (MSW): made-up demo items, not educational content. */
import { http, HttpResponse, type RequestHandler } from 'msw';
import type { LessonResponse } from '@revisionden/core';
import { demoItems } from '../learn/mocks';

/** By default the demo topic has not been practised, so lessons start straight away. */
export const recallHandlers: RequestHandler[] = [
  http.get('*/v1/student/recall', () =>
    HttpResponse.json({ items: [], draftContent: false } satisfies LessonResponse),
  ),
];

export const demoRecall: LessonResponse = {
  items: [demoItems[1]!, demoItems[0]!],
  draftContent: true,
};
