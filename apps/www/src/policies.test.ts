import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadPolicies, DRAFT_BANNER, type PolicySources } from './policies.ts';

const repoRoot = join(import.meta.dirname, '..', '..', '..');
const legalDir = join(repoRoot, 'docs/legal');
const sources: PolicySources = {
  index: readFileSync(join(repoRoot, 'docs/LEGAL.md'), 'utf8'),
  files: Object.fromEntries(
    readdirSync(legalDir)
      .filter((name) => name.endsWith('.md'))
      .map((name) => [name, readFileSync(join(legalDir, name), 'utf8')]),
  ),
};
const env = { VITE_OPERATOR_NAME: 'Example Trading', VITE_CONTACT_EMAIL: 'privacy@example.test' };

describe('policies from docs/legal', () => {
  const policies = loadPolicies(sources, env);

  it('loads every policy file in docs/legal, in the order of docs/LEGAL.md', () => {
    expect(policies.map((policy) => `${policy.name}.md`).sort()).toEqual(
      Object.keys(sources.files).sort(),
    );
    expect(policies[0]!.name).toBe('privacy-notice');
  });

  it('takes the title, version and audience from the files themselves', () => {
    const terms = policies.find((policy) => policy.name === 'terms-of-use')!;
    expect(terms.title).toBe('Terms of use');
    expect(terms.version).toMatch(/^\d+\.\d+$/);
    expect(terms.audience).toBe('Parents (and students)');
  });

  it('fills the operator placeholders from the build variables and leaves none behind', () => {
    for (const policy of policies) {
      const all = policy.plainEnglishHtml + policy.fullTextHtml + policy.changesHtml;
      expect(all, policy.name).not.toContain('{{');
    }
    const terms = policies.find((policy) => policy.name === 'terms-of-use')!;
    expect(terms.plainEnglishHtml).toContain('Example Trading');
  });

  it('marks every policy as a draft while there is no effective date', () => {
    for (const policy of policies) {
      expect(policy.draft).toBe(true);
      expect(policy.effectiveDate).toBe('date to be added');
    }
    expect(DRAFT_BANNER).toBe('Draft: not yet in force, being reviewed before launch.');
  });

  it('shows the effective date once one is set', () => {
    const live = loadPolicies(sources, { ...env, VITE_POLICY_EFFECTIVE_DATE: '2027-01-04' });
    for (const policy of live) {
      expect(policy.draft).toBe(false);
      expect(policy.effectiveDate).toBe('2027-01-04');
    }
  });

  it('says "contact details to be added" when the operator details are not set', () => {
    const terms = loadPolicies(sources, {}).find((policy) => policy.name === 'terms-of-use')!;
    expect(terms.plainEnglishHtml).toContain('contact details to be added');
  });

  it('uses help@revisionden.com for help unless VITE_SUPPORT_EMAIL is set', () => {
    const text = (list: ReturnType<typeof loadPolicies>) =>
      list.map((p) => p.fullTextHtml).join('');
    expect(text(policies)).toContain('help@revisionden.com');
    expect(
      text(loadPolicies(sources, { ...env, VITE_SUPPORT_EMAIL: 'support@example.test' })),
    ).toContain('support@example.test');
  });

  it('refuses to build when a policy file is missing from the docs/LEGAL.md list', () => {
    expect(() =>
      loadPolicies({ ...sources, files: { ...sources.files, 'stray.md': '# Stray\n' } }, env),
    ).toThrow(/stray\.md/);
  });
});
