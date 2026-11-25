import '@testing-library/jest-dom/vitest';
import { server } from './mocks/server';
import { findFakeMockRoutes } from './test/apiRoutes';
import { resetLearnMocks } from './features/learn/mocks';
import { resetRewardsMocks } from './features/rewards/mocks';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  // A test's own mocks (server.use) must be real API routes too (src/test/apiRoutes.ts).
  const fake = findFakeMockRoutes(server.listHandlers());
  server.resetHandlers();
  if (fake.length > 0)
    throw new Error(`Mock handlers for routes the API does not have: ${fake.join(', ')}`);
  resetLearnMocks();
  resetRewardsMocks();
});
afterAll(() => server.close());
