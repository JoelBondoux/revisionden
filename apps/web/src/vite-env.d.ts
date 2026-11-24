/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base address of the API, e.g. https://api-dev.revisionden.com. Defaults to /api. */
  readonly VITE_API_URL?: string;
  /** Set to "false" to turn off the mock API in development. */
  readonly VITE_USE_MOCKS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
