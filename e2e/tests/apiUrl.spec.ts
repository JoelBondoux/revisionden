import { expect, test } from '@playwright/test';
import { apiUrlFor } from '../smoke/apiUrl';

// Pure checks (no page): the smoke test finds each environment's API from its web address.
test('finds the API for each web host', () => {
  expect(apiUrlFor('https://dev.revisionden.com')).toBe('https://api-dev.revisionden.com');
  expect(apiUrlFor('https://staging.revisionden.com')).toBe('https://api-staging.revisionden.com');
  expect(apiUrlFor('https://app.revisionden.com')).toBe('https://api.revisionden.com');
  expect(apiUrlFor('https://dev.revisionden.com', 'https://x.test/')).toBe('https://x.test');
});
