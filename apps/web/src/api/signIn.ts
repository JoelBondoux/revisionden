import { z } from 'zod';
import { apiRequest, type ClientOptions } from './client';
import type { SignInProvider } from './signInProviders';

const SocialSignInResponseSchema = z.object({ url: z.string().url() });

/**
 * Starts parent sign-in with Better Auth on the API (`POST /api/auth/sign-in/social`) and goes to
 * the provider's consent page. After sign-in the API sends the parent back to `/family`; if the
 * provider refuses, back to the welcome page with `?error=…`.
 */
export async function startSignIn(
  provider: SignInProvider,
  options: ClientOptions & { webOrigin: string; redirect: (url: string) => void },
): Promise<void> {
  const { url } = await apiRequest(options, 'api/auth/sign-in/social', SocialSignInResponseSchema, {
    method: 'POST',
    body: JSON.stringify({
      provider,
      callbackURL: `${options.webOrigin}/family`,
      errorCallbackURL: `${options.webOrigin}/`,
    }),
  });
  options.redirect(url);
}
