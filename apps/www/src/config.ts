/** Build variables for the public site, read once at build time (decision 0005). */
export type SiteEnvironment = 'staging' | 'production';

/** The policy placeholders, named as the web app names them so GitHub variables are shared. */
export interface PolicyEnv {
  VITE_OPERATOR_NAME?: string;
  VITE_CONTACT_EMAIL?: string;
  VITE_POLICY_EFFECTIVE_DATE?: string;
  VITE_SUPPORT_EMAIL?: string;
}

export interface SiteConfig {
  environment: SiteEnvironment;
  /** Where "Sign in" and "Start free" go. */
  appUrl: string;
  /** This site's own address, for canonical links, the sitemap and Open Graph. */
  siteUrl: string;
  /** Only the live site is listed by search engines. */
  indexable: boolean;
  policyEnv: PolicyEnv;
}

const DEFAULTS: Record<SiteEnvironment, { appUrl: string; siteUrl: string }> = {
  production: { appUrl: 'https://app.revisionden.com', siteUrl: 'https://revisionden.com' },
  staging: {
    appUrl: 'https://staging.revisionden.com',
    siteUrl: 'https://www-staging.revisionden.com',
  },
};

const POLICY_KEYS = [
  'VITE_OPERATOR_NAME',
  'VITE_CONTACT_EMAIL',
  'VITE_POLICY_EFFECTIVE_DATE',
  'VITE_SUPPORT_EMAIL',
] as const;

/** Production needs these; the trading name is never committed (decision 0003). */
const REQUIRED_IN_PRODUCTION = ['VITE_OPERATOR_NAME', 'VITE_CONTACT_EMAIL'] as const;

type Env = Record<string, string | undefined>;

const set = (value: string | undefined): string | undefined => value?.trim() || undefined;
const withoutSlash = (url: string) => url.replace(/\/+$/, '');

export function readSiteConfig(env: Env): SiteConfig {
  const name = set(env.WWW_ENVIRONMENT) ?? 'staging';
  if (name !== 'staging' && name !== 'production') {
    throw new Error(`WWW_ENVIRONMENT must be staging or production, not "${name}"`);
  }
  const environment: SiteEnvironment = name;
  if (environment === 'production') {
    const missing = REQUIRED_IN_PRODUCTION.filter((key) => !set(env[key]));
    if (missing.length > 0) {
      throw new Error(`A production build needs ${missing.join(', ')} (docs/ENVIRONMENTS.md)`);
    }
  }
  const policyEnv: PolicyEnv = {};
  for (const key of POLICY_KEYS) {
    const value = set(env[key]);
    if (value) policyEnv[key] = value;
  }
  return {
    environment,
    appUrl: withoutSlash(set(env.WWW_APP_URL) ?? DEFAULTS[environment].appUrl),
    siteUrl: withoutSlash(set(env.WWW_SITE_URL) ?? DEFAULTS[environment].siteUrl),
    indexable: environment === 'production',
    policyEnv,
  };
}
