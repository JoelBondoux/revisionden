/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base address of the API, e.g. https://api-dev.revisionden.com. Defaults to /api. */
  readonly VITE_API_URL?: string;
  /** Set to "false" to turn off the mock API in development. */
  readonly VITE_USE_MOCKS?: string;
  /** development, staging or production (shown on the About page). Defaults to development. */
  readonly VITE_ENVIRONMENT?: string;
  /** Operator details filled into the policies (docs/LEGAL.md). Never in the repository. */
  readonly VITE_OPERATOR_NAME?: string;
  readonly VITE_CONTACT_EMAIL?: string;
  readonly VITE_POSTAL_ADDRESS?: string;
  /** Effective date shown on the policies, e.g. "1 January 2027". */
  readonly VITE_POLICY_EFFECTIVE_DATE?: string;
  /** Commit id to show on the About page; defaults to `git rev-parse --short HEAD`. */
  readonly VITE_COMMIT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Injected at build by vite.config.ts. */
declare const __APP_VERSION__: string;
declare const __BUILD_DATE__: string;
declare const __COMMIT__: string;
declare const __LICENCES__: { name: string; version: string; licence: string }[];
