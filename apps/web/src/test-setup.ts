import '@testing-library/jest-dom/vitest';
import { server } from './mocks/server';
import { resetLearnMocks } from './features/learn/mocks';
import { resetRewardsMocks } from './features/rewards/mocks';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  resetLearnMocks();
  resetRewardsMocks();
});
afterAll(() => server.close());
