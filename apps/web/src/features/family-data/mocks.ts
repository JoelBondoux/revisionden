import { http, HttpResponse } from 'msw';

/** Demo answers for the family data panel (no real data). */
export const familyDataHandlers = [
  http.get('*/v1/family/activity', () =>
    HttpResponse.json({
      lastUsedAt: '2026-11-24T10:00:00.000Z',
      deletedIfUnusedAfter: '2027-11-24T10:00:00.000Z',
      warning: null,
    }),
  ),
];
