import type { Page, Route } from '@playwright/test';
import { getResponse, http, HttpResponse, type RequestHandler } from 'msw';
import { dailyHandlers } from '../../../apps/web/src/features/daily/mocks';
import { familyDataHandlers } from '../../../apps/web/src/features/family-data/mocks';
import { feedbackHandlers } from '../../../apps/web/src/features/feedback/mocks';
import { leagueHandlers } from '../../../apps/web/src/features/league/mocks';
import { learnHandlers } from '../../../apps/web/src/features/learn/mocks';
import { onboardingHandlers } from '../../../apps/web/src/features/onboarding/mocks';
import { parentsHandlers } from '../../../apps/web/src/features/parents/mocks';
import { programmeHandlers } from '../../../apps/web/src/features/programmes/mocks';
import { recallHandlers } from '../../../apps/web/src/features/recall/mocks';
import { rewardsHandlers } from '../../../apps/web/src/features/rewards/mocks';
import { cardsDue, topicMap } from '../../../apps/web/src/mocks/data';
import { dailyLimitHandlers, statsHandlers } from '../../../apps/web/src/features/stats/mocks';

/*
 * W21: a seeded app for screen-wide checks. Every API call is answered by the web app's own mock
 * handlers (the made-up data its unit tests use), so each screen shows real content rather than
 * an error. Nothing leaves the browser: unknown calls get a 404.
 */
/** A parent is signed in, or nobody is (a pupil's device). */
const auth = (signedIn: boolean): RequestHandler[] => [
  http.get('*/v1/auth/providers', () => HttpResponse.json({ providers: ['google', 'microsoft'] })),
  http.get('*/api/auth/get-session', () =>
    HttpResponse.json(signedIn ? { user: { id: 'parent-e2e' }, session: {} } : null),
  ),
  http.get('*/v1/student/map', () => HttpResponse.json(topicMap)),
  http.get('*/v1/student/cards/due', () => HttpResponse.json(cardsDue)),
  http.post('*/v1/client-errors', () => new HttpResponse(null, { status: 204 })),
  // Policies already accepted (the terms screen has its own checks in pages.spec).
  http.get('*/v1/policy-acceptances', () => HttpResponse.json({ acceptances: [] })),
];

const FEATURES: RequestHandler[] = [
  ...dailyHandlers,
  ...familyDataHandlers,
  ...feedbackHandlers,
  ...leagueHandlers,
  ...learnHandlers,
  ...onboardingHandlers,
  ...parentsHandlers,
  ...programmeHandlers,
  ...recallHandlers,
  ...rewardsHandlers,
  ...statsHandlers,
  ...dailyLimitHandlers,
];

async function answer(route: Route, handlers: RequestHandler[], unknown: string[]) {
  const req = route.request();
  const body = req.postDataBuffer();
  const request = new Request(req.url(), {
    method: req.method(),
    headers: req.headers(),
    ...(body && !['GET', 'HEAD'].includes(req.method()) ? { body: new Uint8Array(body) } : {}),
  });
  const res = await getResponse(handlers, request);
  if (!res) {
    unknown.push(`${req.method()} ${new URL(req.url()).pathname}`);
    return route.fulfill({
      status: 404,
      json: { error: { code: 'not_found', message: 'Not seeded', ref: 'RD-E2E000' } },
    });
  }
  return route.fulfill({
    status: res.status,
    headers: Object.fromEntries(Array.from(res.headers as unknown as Iterable<[string, string]>)),
    body: Buffer.from(await res.arrayBuffer()),
  });
}

/** Seeds the app for a pupil (this device is theirs), a signed-in parent, or a visitor (neither). */
export async function seedApp(page: Page, who: 'pupil' | 'parent' | 'visitor') {
  const unknown: string[] = [];
  if (who === 'pupil')
    await page.addInitScript(() => localStorage.setItem('revisionden.studentId', 'student-e2e'));
  const handlers = [...auth(who === 'parent'), ...FEATURES];
  await page.route('**/v1/**', (route) => answer(route, handlers, unknown));
  await page.route('**/api/auth/**', (route) => answer(route, handlers, unknown));
  return { unknown };
}
