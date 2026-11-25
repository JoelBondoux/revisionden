import { DEFAULT_SUPPORT_EMAIL, supportEmail } from './supportEmail';

describe('support email', () => {
  it('uses help@revisionden.com when the build variable is missing or blank', () => {
    expect(DEFAULT_SUPPORT_EMAIL).toBe('help@revisionden.com');
    expect(supportEmail(undefined)).toBe('help@revisionden.com');
    expect(supportEmail('   ')).toBe('help@revisionden.com');
  });

  it('uses the build variable when it is set', () => {
    expect(supportEmail(' support@example.com ')).toBe('support@example.com');
  });
});
