import { changesSince, compareVersions } from './policyChanges';

describe('compareVersions', () => {
  it('compares each part as a number, so 1.10 is newer than 1.9', () => {
    expect(compareVersions('1.10', '1.9')).toBeGreaterThan(0);
    expect(compareVersions('1.9', '1.10')).toBeLessThan(0);
    expect(compareVersions('2.0', '1.12')).toBeGreaterThan(0);
    expect(compareVersions('1.2', '1.2')).toBe(0);
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
  });
});

describe('changesSince', () => {
  const changes = [
    '- 1.10: A parent can send a one-time link.',
    '- 1.9: Synced passkeys work on other',
    '  devices too.',
    '- 1.8: Labels on your account.',
    '- 1.7: Complaints in the app.',
  ].join('\n');

  it('keeps only the lines newer than the version the parent accepted, newest first', () => {
    expect(changesSince(changes, '1.7')).toEqual([
      { version: '1.10', text: 'A parent can send a one-time link.' },
      { version: '1.9', text: 'Synced passkeys work on other devices too.' },
      { version: '1.8', text: 'Labels on your account.' },
    ]);
  });

  it('returns nothing when no line is newer than the accepted version', () => {
    expect(changesSince(changes, '1.10')).toEqual([]);
  });

  it('ignores lines without a version', () => {
    expect(changesSince('- Some note.\n- 1.1: Real change.', '1.0')).toEqual([
      { version: '1.1', text: 'Real change.' },
    ]);
  });
});
