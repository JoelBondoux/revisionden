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

/*
 * W21 PR 2: screens whose data the shared mocks do not answer, shaped as their own unit tests
 * shape it (all made up). Staff screens answer as a signed-in reviewer and operator.
 */
const T = '2026-11-24T10:00:00.000Z';
const BATCH = '11111111-1111-4111-8111-111111111111';
const sampleItem = (itemId: string, decision: string | null) => ({
  itemId,
  itemVersion: 1,
  needsHumanApproval: false,
  snapshot: {
    prompt: `Fixture question for ${itemId}?`,
    answer: { accepted: ['fixture answer'] },
    citations: [{ publisher: 'Fixture board', location: 'page 3', quote: 'fixture quoted words' }],
  },
  decision,
  decidedByRole: decision ? 'subject-specialist' : null,
  decisionNotes: null,
  decidedAt: null,
});
const EXTRAS: RequestHandler[] = [
  // Reminder times for a child.
  http.get('*/v1/students/:id/reminder-settings', () =>
    HttpResponse.json({
      enabled: true,
      streakReminders: true,
      sessionReminders: true,
      quietStart: '21:00',
      quietEnd: '07:00',
      weekdayQuietStart: '08:30',
      weekdayQuietEnd: '15:30',
      sessionReminderTime: '17:00',
      streakReminderTime: '19:00',
      timeZone: 'Europe/London',
      maxPerDay: 2,
    }),
  ),
  // Complaints: one open, one asked for by a child.
  http.get('*/v1/complaints', () =>
    HttpResponse.json({
      complaints: [
        {
          id: 'complaint-e2e',
          status: 'acknowledged',
          summary: 'A made-up complaint about a marked answer',
          aboutPersonalData: false,
          receivedAt: T,
          acknowledgeDueAt: '2026-11-26T10:00:00.000Z',
          resolveDueAt: '2026-12-22T10:00:00.000Z',
          acknowledgedAt: '2026-11-25T10:00:00.000Z',
          resolvedAt: null,
          escalationFrom: null,
          outcome: null,
          messages: [{ from: 'operator', body: 'Thanks, we are looking into it.', createdAt: T }],
        },
      ],
    }),
  ),
  http.get('*/v1/complaint-requests', () =>
    HttpResponse.json({
      requests: [
        {
          id: 'request-e2e',
          nickname: 'demo_fox',
          topic: 'marking',
          topicLabel: 'A mark or a question seemed wrong',
          note: null,
          createdAt: T,
        },
      ],
    }),
  ),
  // Content review (staff): a reviewer with one report and one batch.
  http.get('*/v1/review/me', () => HttpResponse.json({ role: 'subject-specialist' })),
  http.get('*/v1/review/reports', () =>
    HttpResponse.json({
      reports: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          itemId: 'fixture-item',
          itemVersion: 2,
          reason: 'wrong_answer',
          reportedBy: 'student',
          status: 'open',
          reportedAt: T,
          decidedAt: null,
          decidedByRole: null,
          decisionNotes: null,
        },
      ],
    }),
  ),
  http.get('*/v1/review/batches/from-drafts', () => HttpResponse.json({ ready: 0 })),
  http.get('*/v1/review/batches', () =>
    HttpResponse.json({
      batches: [
        {
          id: BATCH,
          title: 'Fixture batch',
          status: 'in_review',
          createdAt: T,
          size: 300,
          sampleSize: 30,
          decided: 1,
        },
      ],
    }),
  ),
  http.get(`*/v1/review/batches/${BATCH}`, () =>
    HttpResponse.json({
      id: BATCH,
      title: 'Fixture batch',
      status: 'in_review',
      sampleSeed: 42,
      createdAt: T,
      decidedAt: null,
      items: [sampleItem('fixture-item-1', 'approved'), sampleItem('fixture-item-2', null)],
    }),
  ),
  // Feedback triage (operator).
  http.get('*/v1/admin/feedback', () =>
    HttpResponse.json({
      feedback: [
        {
          id: '00000000-0000-4000-8000-000000000001',
          kind: 'bug',
          text: 'A made-up bug report',
          status: 'new',
          senderRole: 'student',
          createdAt: T,
          updatedAt: T,
          device: null,
        },
      ],
    }),
  ),
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
  const handlers = [...auth(who === 'parent'), ...EXTRAS, ...FEATURES];
  await page.route('**/v1/**', (route) => answer(route, handlers, unknown));
  await page.route('**/api/auth/**', (route) => answer(route, handlers, unknown));
  return { unknown };
}
