import { http, type RequestHandler } from 'msw';
import { handlers } from '../mocks/handlers';
import {
  PENDING_ROUTES,
  REAL_API_ROUTES,
  findFakeMockRoutes,
  isRealRoute,
  mockRoute,
} from './apiRoutes';

describe('the real API route list', () => {
  it('comes from the API app (apps/api/routes.json) and includes the parent family list', () => {
    expect(REAL_API_ROUTES).toContain('GET /v1/onboarding/family');
    expect(REAL_API_ROUTES.length).toBeGreaterThan(50);
  });
});

describe('isRealRoute', () => {
  const routes = ['GET /v1/students/:id/rewards', 'GET /api/auth/*', 'POST /api/auth/*'];

  it('matches the same method and path, whatever the parameter is called', () => {
    expect(isRealRoute('GET /v1/students/:studentId/rewards', routes)).toBe(true);
    expect(isRealRoute('POST /v1/students/:id/rewards', routes)).toBe(false);
    expect(isRealRoute('GET /v1/students/:id', routes)).toBe(false);
  });

  it('lets a wildcard route cover the paths under it', () => {
    expect(isRealRoute('POST /api/auth/sign-in/social', routes)).toBe(true);
  });
});

describe('mockRoute', () => {
  it('reads the method and path of a handler, with any host or wildcard prefix removed', () => {
    expect(mockRoute(http.get('*/v1/student/rewards', () => undefined))).toBe(
      'GET /v1/student/rewards',
    );
    expect(mockRoute(http.post('https://app.example/api/v1/feedback', () => undefined))).toBe(
      'POST /api/v1/feedback',
    );
  });
});

describe('MSW mock handlers mirror the real API', () => {
  it('flags a placeholder path the API never had', () => {
    const fake = [http.get('*/api/family', () => undefined)] as RequestHandler[];
    expect(findFakeMockRoutes(fake)).toEqual(['GET /api/family']);
  });

  it('flags the dev "/api" base prefix too: mocks must use the real path exactly', () => {
    const fake = [http.get('*/api/v1/onboarding/family', () => undefined)] as RequestHandler[];
    expect(findFakeMockRoutes(fake)).toEqual(['GET /api/v1/onboarding/family']);
  });

  it('has only real routes (or ones waiting for workstream F2) in the shared handlers', () => {
    expect(findFakeMockRoutes(handlers)).toEqual([]);
  });

  it('keeps the waiting list honest: a pending route must not exist yet', () => {
    // When F2 lands, delete its routes from PENDING_ROUTES (this test then tells you to).
    expect(PENDING_ROUTES.filter((route) => isRealRoute(route, REAL_API_ROUTES))).toEqual([]);
  });
});
