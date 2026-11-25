import type { OnboardingApi } from '../features/onboarding/api';

/** A fake onboarding API for tests: every call is a mock; pass the ones the test needs. */
export function fakeOnboardingApi(overrides: Partial<OnboardingApi> = {}): OnboardingApi {
  return {
    getFamily: vi.fn(async () => ({ children: [] })),
    addChild: vi.fn(),
    createLinkToken: vi.fn(),
    getLinkStatus: vi.fn(async () => 'waiting' as const),
    cancelLink: vi.fn(async () => undefined),
    listDevices: vi.fn(async () => []),
    removeDevice: vi.fn(async () => undefined),
    redeemLink: vi.fn(),
    verifyLink: vi.fn(),
    ...overrides,
  };
}
