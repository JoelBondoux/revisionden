import { createContext, useContext, type ReactNode } from 'react';
import { createApiClient, type ApiClient } from './client';

export function defaultBaseUrl(env: { VITE_API_URL?: string }, origin: string): string {
  return env.VITE_API_URL || `${origin}/api`;
}

const ApiContext = createContext<ApiClient>(
  createApiClient({ baseUrl: defaultBaseUrl(import.meta.env, window.location.origin) }),
);

export function ApiProvider({ client, children }: { client: ApiClient; children: ReactNode }) {
  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
}

export function useApi(): ApiClient {
  return useContext(ApiContext);
}
