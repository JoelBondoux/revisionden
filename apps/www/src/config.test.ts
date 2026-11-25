import { readSiteConfig } from './config.ts';

const operator = {
  VITE_OPERATOR_NAME: 'Example Trading',
  VITE_CONTACT_EMAIL: 'privacy@example.test',
};

describe('site build config', () => {
  it('points sign-in at the production app and the site at the apex domain by default', () => {
    const config = readSiteConfig({ WWW_ENVIRONMENT: 'production', ...operator });
    expect(config.appUrl).toBe('https://app.revisionden.com');
    expect(config.siteUrl).toBe('https://revisionden.com');
    expect(config.indexable).toBe(true);
  });

  it('points staging sign-in at the staging app and keeps staging out of search engines', () => {
    const config = readSiteConfig({ WWW_ENVIRONMENT: 'staging' });
    expect(config.appUrl).toBe('https://staging.revisionden.com');
    expect(config.siteUrl).toBe('https://www-staging.revisionden.com');
    expect(config.indexable).toBe(false);
  });

  it('treats a local build like staging', () => {
    expect(readSiteConfig({}).environment).toBe('staging');
  });

  it('lets the app address be overridden with WWW_APP_URL, without a trailing slash', () => {
    const config = readSiteConfig({
      WWW_ENVIRONMENT: 'staging',
      WWW_APP_URL: 'http://localhost:5173/',
    });
    expect(config.appUrl).toBe('http://localhost:5173');
  });

  it('refuses a production build without the operator name and contact email', () => {
    expect(() => readSiteConfig({ WWW_ENVIRONMENT: 'production' })).toThrow(
      /VITE_OPERATOR_NAME, VITE_CONTACT_EMAIL/,
    );
  });

  it('allows a production build before the policies have an effective date', () => {
    const config = readSiteConfig({ WWW_ENVIRONMENT: 'production', ...operator });
    expect(config.policyEnv.VITE_POLICY_EFFECTIVE_DATE).toBeUndefined();
  });

  it('passes the operator details through for the policy placeholders', () => {
    const config = readSiteConfig({ ...operator, VITE_SUPPORT_EMAIL: 'help@example.test' });
    expect(config.policyEnv).toEqual({ ...operator, VITE_SUPPORT_EMAIL: 'help@example.test' });
  });

  it('rejects an unknown environment name', () => {
    expect(() => readSiteConfig({ WWW_ENVIRONMENT: 'prod' })).toThrow(/WWW_ENVIRONMENT/);
  });
});
