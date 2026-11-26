import { expect, test } from '@playwright/test';

// G10 red check: deliberately fails to show the e2e suite runs on pull requests into dev.
// Removed in the next commit of this PR.
test('G10 red check: this test fails on purpose', () => {
  expect(1).toBe(2);
});
