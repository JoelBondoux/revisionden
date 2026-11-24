import '@testing-library/jest-dom/vitest';
import { server } from './mocks/server';
import { resetLearnMocks } from './features/learn/mocks';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  resetLearnMocks();
});
afterAll(() => server.close());
