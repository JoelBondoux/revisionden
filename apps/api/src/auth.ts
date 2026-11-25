import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { authAccounts, authSessions, authUsers, authVerifications } from '@revisionden/db';
import type { Database } from '@revisionden/db';
import type { AppConfig } from './env';

export const AUTH_BASE_PATH = '/api/auth';

const BLANK_PROFILE = { name: '', image: null };

/** Better Auth for parents: Google and/or Microsoft (whichever is configured), no passwords, minimal stored profile. */
export function createAuth({ db, config }: { db: Database; config: AppConfig }) {
  return betterAuth({
    appName: 'RevisionDen',
    baseURL: config.apiOrigin,
    basePath: AUTH_BASE_PATH,
    secret: config.authSecret,
    trustedOrigins: [config.webOrigin],
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: { authUsers, authSessions, authAccounts, authVerifications },
    }),
    user: { modelName: 'authUsers' },
    session: { modelName: 'authSessions' },
    account: { modelName: 'authAccounts' },
    verification: { modelName: 'authVerifications' },
    emailAndPassword: { enabled: false },
    // Only the providers that are configured (docs/ENVIRONMENTS.md); the other one is refused.
    socialProviders: {
      ...(config.google && {
        google: {
          clientId: config.google.clientId,
          clientSecret: config.google.clientSecret,
          prompt: 'select_account' as const,
        },
      }),
      ...(config.microsoft && {
        microsoft: {
          clientId: config.microsoft.clientId,
          clientSecret: config.microsoft.clientSecret,
          tenantId: 'common',
          prompt: 'select_account' as const,
          disableProfilePhoto: true,
        },
      }),
    },
    databaseHooks: {
      // Store only the parent's sign-in email: blank the provider's name, drop the picture.
      user: {
        create: { before: async (user) => ({ data: { ...user, ...BLANK_PROFILE } }) },
        update: { before: async (user) => ({ data: { ...user, ...BLANK_PROFILE } }) },
      },
      session: {
        create: {
          before: async (session) => ({ data: { ...session, ipAddress: null, userAgent: null } }),
        },
      },
    },
    advanced: {
      useSecureCookies: true,
      defaultCookieAttributes: { httpOnly: true, secure: true, sameSite: 'lax' },
      ipAddress: { disableIpTracking: true },
    },
    telemetry: { enabled: false },
  });
}

export type Auth = ReturnType<typeof createAuth>;
