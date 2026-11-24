import { http, HttpResponse, type RequestHandler } from 'msw';
import { POLICIES_TO_ACCEPT } from './acceptance';
import { defaultPolicyLibrary } from './policyFiles';

/**
 * Mock policy acceptances for development and tests: the demo parent has already confirmed
 * the current versions, so onboarding opens straight away.
 */
export const legalHandlers: RequestHandler[] = [
  http.get('*/api/v1/policy-acceptances', () =>
    HttpResponse.json({
      acceptances: POLICIES_TO_ACCEPT.flatMap((policy) => {
        const version = defaultPolicyLibrary.version(policy);
        return version ? [{ policy, version, acceptedAt: '2026-11-24T10:00:00.000Z' }] : [];
      }),
    }),
  ),
  http.put('*/api/v1/policy-acceptances', async ({ request }) => {
    const body = (await request.json()) as { acceptances: { policy: string; version: string }[] };
    return HttpResponse.json({
      acceptances: body.acceptances.map((a) => ({ ...a, acceptedAt: new Date().toISOString() })),
    });
  }),
];
