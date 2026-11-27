import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';
import { server } from './mocks/server';
import { findFakeMockRoutes } from './test/apiRoutes';
import { resetLearnMocks } from './features/learn/mocks';
import { resetRewardsMocks } from './features/rewards/mocks';
import { resetKnownSubjects } from './features/subjects/chosenSubject';

/*
 * Screens load their data through the mock API, which can take more than a second on a busy CI
 * runner: every findBy and waitFor waits up to 5 seconds (the old per-file LOAD), and each test
 * has room for a few such waits (I13).
 */
configure({ asyncUtilTimeout: 5000 });
vi.setConfig({ testTimeout: 15_000 });

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  // A test's own mocks (server.use) must be real API routes too (src/test/apiRoutes.ts).
  const fake = findFakeMockRoutes(server.listHandlers());
  server.resetHandlers();
  if (fake.length > 0)
    throw new Error(`Mock handlers for routes the API does not have: ${fake.join(', ')}`);
  resetLearnMocks();
  resetRewardsMocks();
  // UX-1: one test's chosen subject must not carry into the next.
  resetKnownSubjects();
});
afterAll(() => server.close());
