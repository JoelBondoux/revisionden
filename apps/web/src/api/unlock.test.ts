import { isStudentApiPath, safeReturnTo, unlockPath } from './unlock';

describe('student unlock helpers', () => {
  it('knows which API calls belong to a student device', () => {
    expect(isStudentApiPath('/v1/student/map')).toBe(true);
    expect(isStudentApiPath('/v1/student')).toBe(true);
    // Served from the same site under /api (local and test builds).
    expect(isStudentApiPath('/api/v1/student/map')).toBe(true);
    expect(isStudentApiPath('/api/v1/students/:id')).toBe(false);
    expect(isStudentApiPath('/v1/students/:id/rewards')).toBe(false);
    expect(isStudentApiPath('/v1/onboarding/family')).toBe(false);
    expect(isStudentApiPath(undefined)).toBe(false);
  });

  it('builds the unlock address that brings the student back where they were', () => {
    expect(unlockPath('/cards?deck=n1')).toBe('/unlock?returnTo=%2Fcards%3Fdeck%3Dn1');
    expect(unlockPath()).toBe('/unlock');
  });

  it('only returns to a page in this app, and to Home by default', () => {
    expect(safeReturnTo('/cards')).toBe('/cards');
    expect(safeReturnTo(null)).toBe('/home');
    expect(safeReturnTo('https://evil.example/')).toBe('/home');
    expect(safeReturnTo('//evil.example/')).toBe('/home');
    expect(safeReturnTo('/\\evil.example')).toBe('/home');
    expect(safeReturnTo('/unlock?returnTo=%2Fmap')).toBe('/home');
  });
});
