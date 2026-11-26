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
    updateChildSubject: vi.fn(),
    getChildSubjects: vi.fn(async () => []),
    addChildSubject: vi.fn(),
    removeChildSubject: vi.fn(async () => undefined),
    getMySubjects: vi.fn(async () => ({ enrolments: [], toCheckLater: 0 })),
    updateMySubject: vi.fn(),
    getMe: vi.fn(async () => ({
      id: '00000000-0000-4000-8000-0000000000a1',
      nickname: 'NovaFox',
      avatarCode: '1' + '0'.repeat(28),
      yearGroup: 11,
    })),
    getMyAvatar: vi.fn(async () => ({ avatarCode: '1' + '0'.repeat(28), earnedRewardIds: [] })),
    saveMyAvatar: vi.fn(),
    reportPasskeyError: vi.fn(() => 'RD-TEST00'),
    unlockOptions: vi.fn(),
    unlockVerify: vi.fn(),
    ...overrides,
  };
}
