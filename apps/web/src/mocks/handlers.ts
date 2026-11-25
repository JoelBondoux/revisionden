import { http, HttpResponse, type RequestHandler } from 'msw';
import { onboardingHandlers } from '../features/onboarding/mocks';
import { cardsDue, topicMap } from './data';
import { learnHandlers } from '../features/learn/mocks';
import { rewardsHandlers } from '../features/rewards/mocks';
import { feedbackHandlers } from '../features/feedback/mocks';
import { legalHandlers } from '../features/legal/mocks';
import { statsHandlers } from '../features/stats/mocks';
import { familyDataHandlers } from '../features/family-data/mocks';
import { parentsHandlers } from '../features/parents/mocks';

/**
 * Mock API for development and tests. Every handler uses a real API path exactly (checked by
 * src/test/apiRoutes.test.ts against apps/api/routes.json), so tests cannot pass against a route
 * the API does not have.
 */
export const handlers: RequestHandler[] = [
  http.get('*/v1/auth/providers', () => HttpResponse.json({ providers: ['google', 'microsoft'] })),
  // Parent sign-in (Better Auth): in development the mock "signs in" straight to the family.
  http.post('*/api/auth/sign-in/social', () =>
    HttpResponse.json({ url: `${location.origin}/family`, redirect: true }),
  ),
  // Signed out by default in tests; sign-out always works.
  http.get('*/api/auth/get-session', () => HttpResponse.json(null)),
  http.post('*/api/auth/sign-out', () => HttpResponse.json({ success: true })),
  ...onboardingHandlers,
  // Student device topic map and cards due (F2).
  http.get('*/v1/student/map', () => HttpResponse.json(topicMap)),
  http.get('*/v1/student/cards/due', () => HttpResponse.json(cardsDue)),

  // Error reports from the web app (reference codes).
  http.post('*/v1/client-errors', () => new HttpResponse(null, { status: 204 })),
  http.post('*/v1/error-reports', () => HttpResponse.json({ received: true }, { status: 202 })),

  // Learning loop and flashcards (workstream F).
  ...learnHandlers,
  ...rewardsHandlers,
  // Policies, About and feedback (workstream L).
  ...feedbackHandlers,
  ...legalHandlers,

  // Statistics dashboards (workstream K).
  ...statsHandlers,
  ...familyDataHandlers,
  ...parentsHandlers,
];
