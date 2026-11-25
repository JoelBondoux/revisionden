import type { OnboardingApi } from '../features/onboarding/api';

/** A fake onboarding API for tests: every call is a mock; pass the ones the test needs. */
export function fakeOnboardingApi(overrides: Partial<OnboardingApi> = {}): OnboardingApi {
  return {
    getFamily: vi.fn(async () => ({ children: [] })),
    addChild: vi.fn(),
    createLinkToken: vi.fn(),
    redeemLink: vi.fn(),
    verifyLink: vi.fn(),
    updateChildSubject: vi.fn(),
    getMySubjects: vi.fn(async () => ({ enrolments: [], toCheckLater: 0 })),
    updateMySubject: vi.fn(),
    getMyAvatar: vi.fn(async () => ({ avatarCode: '1' + '0'.repeat(28), earnedRewardIds: [] })),
    saveMyAvatar: vi.fn(),
    ...overrides,
  };
}
