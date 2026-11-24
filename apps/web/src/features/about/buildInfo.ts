import type { LicenceEntry } from './licences';

export interface BuildInfo {
  version: string;
  environment: 'Development' | 'Staging' | 'Live';
  buildDate: string;
  commit: string;
  licences: LicenceEntry[];
}

export function environmentLabel(env: string | undefined): BuildInfo['environment'] {
  if (env === 'production') return 'Live';
  if (env === 'staging') return 'Staging';
  return 'Development';
}

/** Facts about this build, injected by vite.config.ts. */
export const buildInfo: BuildInfo = {
  version: __APP_VERSION__,
  environment: environmentLabel(import.meta.env.VITE_ENVIRONMENT),
  buildDate: __BUILD_DATE__,
  commit: __COMMIT__,
  licences: __LICENCES__,
};
