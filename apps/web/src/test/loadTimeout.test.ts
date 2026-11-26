import { getConfig } from '@testing-library/react';

/*
 * Screens load their data through the mock API, which can take longer than a second on a busy CI
 * runner. Every findBy and waitFor waits up to 5 seconds (src/test-setup.ts), and each test has 15.
 */
describe('test timing for data-loaded screens', () => {
  it('lets findBy and waitFor wait up to 5 seconds for data', () => {
    expect(getConfig().asyncUtilTimeout).toBe(5000);
  });
});
