import { createContext, useContext, type ReactNode } from 'react';
import { defaultBaseUrl } from '../../api/ApiContext';
import { createOnboardingApi, type OnboardingApi } from './api';

const Context = createContext<OnboardingApi>(
  createOnboardingApi({ baseUrl: defaultBaseUrl(import.meta.env, window.location.origin) }),
);

export function OnboardingApiProvider({
  api,
  children,
}: {
  api: OnboardingApi;
  children: ReactNode;
}) {
  return <Context.Provider value={api}>{children}</Context.Provider>;
}

export function useOnboardingApi(): OnboardingApi {
  return useContext(Context);
}
