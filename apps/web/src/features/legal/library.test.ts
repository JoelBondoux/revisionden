import { createPolicyLibrary, POLICIES } from './library';

const file = (title: string, version: string) =>
  `# ${title}\n\nVersion: ${version}\nEffective date: {{EFFECTIVE_DATE}}\n\n## In plain English\n\nAsk {{CONTACT_EMAIL}}.\n\n## Full text\n\nText.\n\n## Changes\n\n- ${version}: First version.\n`;

const files = {
  '../../../../../docs/legal/privacy-notice.md': file('Privacy notice', '1.0'),
  '../../../../../docs/legal/terms-of-use.md': file('Terms of use', '1.1'),
  '../../../../../docs/legal/not-in-the-list.md': file('Stray', '9.9'),
};

describe('createPolicyLibrary', () => {
  const library = createPolicyLibrary(files, { VITE_CONTACT_EMAIL: 'help@example.com' });

  it('lists the twelve policies from docs/LEGAL.md in order', () => {
    expect(POLICIES.map((p) => p.name)).toEqual([
      'privacy-notice',
      'privacy-for-young-people',
      'data-retention',
      'processors',
      'cookies-and-storage',
      'terms-of-use',
      'acceptable-use',
      'ai-and-marking',
      'content-accuracy',
      'accessibility-statement',
      'childrens-code',
      'complaints-policy',
    ]);
  });

  it('finds a policy by name with its placeholders filled', () => {
    const policy = library.get('privacy-notice');
    expect(policy?.title).toBe('Privacy notice');
    expect(policy?.plainEnglish).toBe('Ask help@example.com.');
    expect(policy?.effectiveDate).toBe('date to be added');
  });

  it('knows nothing about unknown names or files missing from the list', () => {
    expect(library.get('not-in-the-list')).toBeUndefined();
    expect(library.get('data-retention')).toBeUndefined();
  });

  it('gives the current version of a policy, or undefined when it is missing', () => {
    expect(library.version('terms-of-use')).toBe('1.1');
    expect(library.version('processors')).toBeUndefined();
  });

  it('lists only the policies that have a file', () => {
    expect(library.available().map((p) => p.name)).toEqual(['privacy-notice', 'terms-of-use']);
  });
});
