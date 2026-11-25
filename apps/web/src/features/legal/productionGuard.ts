/**
 * Operator details the policies need in the live app (decision 0003). Development and staging
 * builds may show "to be added"; a production build must not.
 */
export const REQUIRED_IN_PRODUCTION = [
  'VITE_OPERATOR_NAME',
  'VITE_CONTACT_EMAIL',
  'VITE_POLICY_EFFECTIVE_DATE',
] as const;

type BuildEnv = Partial<Record<string, string | undefined>>;

export function missingProductionDetails(env: BuildEnv): string[] {
  if (env.VITE_ENVIRONMENT !== 'production') return [];
  return REQUIRED_IN_PRODUCTION.filter((name) => !env[name]?.trim());
}

/** Throws (failing the build) when a production build is missing operator details. */
export function assertProductionDetails(env: BuildEnv): void {
  const missing = missingProductionDetails(env);
  if (missing.length > 0) {
    throw new Error(`Production build is missing operator details: ${missing.join(', ')}`);
  }
}
