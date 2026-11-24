import { createContext, useContext, type ReactNode } from 'react';
import type { PolicyLibrary } from './library';
import { defaultPolicyLibrary } from './policyFiles';

const Context = createContext<PolicyLibrary>(defaultPolicyLibrary);

export function PolicyLibraryProvider({
  library,
  children,
}: {
  library: PolicyLibrary;
  children: ReactNode;
}) {
  return <Context.Provider value={library}>{children}</Context.Provider>;
}

export function usePolicyLibrary(): PolicyLibrary {
  return useContext(Context);
}
