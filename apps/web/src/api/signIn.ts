import { useEffect, useState } from 'react';
import { z } from 'zod';
import { defaultBaseUrl } from './ApiContext';
import { apiRequest, type ClientOptions } from './client';
import type { SignInProvider } from './signInProviders';

const SocialSignInResponseSchema = z.object({ url: z.string().url() });
const SessionSchema = z
  .object({ user: z.object({ id: z.string() }) })
  .passthrough()
  .nullable();

/** Leaving the app for the sign-in provider. An object so tests can replace it. */
export const navigation = {
  leaveTo: (url: string) => window.location.assign(url),
};

const browserOptions = (): ClientOptions => ({
  baseUrl: defaultBaseUrl(import.meta.env, window.location.origin),
});

/**
 * Starts parent sign-in with Better Auth on the API (`POST /api/auth/sign-in/social`) and goes to
 * the provider's consent page. After sign-in the API sends the parent back to `returnTo` on this
 * site; if the provider refuses, back to the welcome page with `?error=…`.
 */
export async function startSignIn(
  provider: SignInProvider,
  returnTo: string,
  options: ClientOptions = browserOptions(),
  webOrigin = window.location.origin,
): Promise<void> {
  const { url } = await apiRequest(options, 'api/auth/sign-in/social', SocialSignInResponseSchema, {
    method: 'POST',
    body: JSON.stringify({
      provider,
      callbackURL: `${webOrigin}${returnTo}`,
      errorCallbackURL: `${webOrigin}/`,
    }),
  });
  navigation.leaveTo(url);
}

/** Ends the parent's session (`POST /api/auth/sign-out`). */
export async function signOut(options: ClientOptions = browserOptions()): Promise<void> {
  await apiRequest(options, 'api/auth/sign-out', z.unknown(), {
    method: 'POST',
    body: '{}',
  });
}

export type ParentSession = 'loading' | 'signed-in' | 'signed-out';

/** Whether a parent is signed in on this browser (`GET /api/auth/get-session`). */
export function useParentSession(options?: ClientOptions): ParentSession {
  const [state, setState] = useState<ParentSession>('loading');
  useEffect(() => {
    let live = true;
    apiRequest(options ?? browserOptions(), 'api/auth/get-session', SessionSchema).then(
      (session) => live && setState(session ? 'signed-in' : 'signed-out'),
      () => live && setState('signed-out'),
    );
    return () => {
      live = false;
    };
  }, [options]);
  return state;
}
