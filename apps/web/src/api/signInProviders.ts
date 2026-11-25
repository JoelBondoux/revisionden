import { useEffect, useState } from 'react';
import { defaultBaseUrl } from './ApiContext';

export type SignInProvider = 'google' | 'microsoft';

const ALL: SignInProvider[] = ['google', 'microsoft'];

/**
 * Sign-in providers the API has set up (`GET /v1/auth/providers`). If the API cannot be asked,
 * both are offered and the API refuses the one that is not set up.
 */
export async function fetchSignInProviders(
  baseUrl: string,
  fetchFn: typeof fetch = (...args) => globalThis.fetch(...args),
): Promise<SignInProvider[]> {
  const root = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  try {
    const res = await fetchFn(new URL('v1/auth/providers', root), {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return ALL;
    const body = (await res.json()) as { providers?: unknown };
    const known = Array.isArray(body.providers)
      ? ALL.filter((p) => (body.providers as unknown[]).includes(p))
      : [];
    return known.length > 0 ? known : ALL;
  } catch {
    return ALL;
  }
}

/** Providers to show; undefined while asking. */
export function useSignInProviders(): SignInProvider[] | undefined {
  const [providers, setProviders] = useState<SignInProvider[]>();
  useEffect(() => {
    let live = true;
    void fetchSignInProviders(defaultBaseUrl(import.meta.env, window.location.origin)).then(
      (p) => live && setProviders(p),
    );
    return () => {
      live = false;
    };
  }, []);
  return providers;
}
