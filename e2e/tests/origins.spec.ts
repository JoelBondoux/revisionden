import { expect, test } from '@playwright/test';
import { allowedOrigins, isElsewhere } from './support/origins';

// Pure checks (no page): which origins a whole-session test may talk to. Locally the API is on the
// web origin (/api); against a deployed site (E2E_BASE_URL) it is on its own host, as VITE_API_URL
// sets it for that build (W16b, Codex review of train #368).
test('locally only the web origin is allowed', () => {
  expect(allowedOrigins('http://localhost:4173', {})).toEqual(['http://localhost:4173']);
});

test('against a deployed site its API origin is allowed too', () => {
  const env = { E2E_BASE_URL: 'https://staging.revisionden.com' };
  expect(allowedOrigins('https://staging.revisionden.com', env)).toEqual([
    'https://staging.revisionden.com',
    'https://api-staging.revisionden.com',
  ]);
  expect(
    allowedOrigins('https://dev.revisionden.com', { ...env, E2E_API_URL: 'https://x.test/' }),
  ).toEqual(['https://dev.revisionden.com', 'https://x.test']);
});

test('a separate API origin passes and third parties are still caught', () => {
  const allowed = allowedOrigins('https://staging.revisionden.com', {
    E2E_BASE_URL: 'https://staging.revisionden.com',
  });
  expect(isElsewhere('https://api-staging.revisionden.com/v1/onboarding/family', allowed)).toBe(
    false,
  );
  expect(isElsewhere('https://staging.revisionden.com/family', allowed)).toBe(false);
  expect(isElsewhere('https://accounts.google.com/o/oauth2/auth', allowed)).toBe(true);
  expect(isElsewhere('data:image/png;base64,AAAA', allowed)).toBe(false);
});
