/**
 * The help inbox shown on the About page, the feedback form and some policies. Not personal data,
 * so the default lives in the repository; a build can override it with VITE_SUPPORT_EMAIL.
 */
export const DEFAULT_SUPPORT_EMAIL = 'help@revisionden.com';

export function supportEmail(value: string | undefined): string {
  return value && value.trim() ? value.trim() : DEFAULT_SUPPORT_EMAIL;
}

/** The support email for this build. */
export const SUPPORT_EMAIL = supportEmail(import.meta.env.VITE_SUPPORT_EMAIL);
