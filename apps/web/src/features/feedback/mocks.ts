import { http, HttpResponse, type RequestHandler } from 'msw';

/** Made-up feedback for development and tests (no real people or messages). */
const demo = [
  {
    id: '00000000-0000-4000-8000-0000000000f1',
    kind: 'bug',
    text: 'Demo report: the timer did not start.',
    status: 'looking_into_it',
    senderRole: 'student',
    studentNickname: 'demo_kid',
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-21T10:00:00.000Z',
    outcome: 'confirmed',
    rewardXp: 50,
  },
];

const notOperator = () =>
  HttpResponse.json({ error: { code: 'not_found', message: 'Not found' } }, { status: 404 });

const sent = () => new HttpResponse(null, { status: 201 });

export const feedbackHandlers: RequestHandler[] = [
  http.post('*/v1/student/feedback', sent),
  http.post('*/v1/feedback', sent),
  http.get('*/v1/feedback', () => HttpResponse.json({ feedback: demo })),
  http.get('*/v1/student/feedback', () =>
    HttpResponse.json({
      feedback: demo.map((item) => {
        const own: Partial<typeof item> = { ...item };
        delete own.studentNickname;
        return own;
      }),
    }),
  ),
  http.get('*/v1/admin/error-reports', () =>
    HttpResponse.json({
      since: new Date(Date.now() - 86_400_000).toISOString(),
      total: 0,
      groups: [],
    }),
  ),
  // The demo parent is not an operator: triage answers 404, as the real API does.
  http.get('*/v1/admin/feedback', notOperator),
  http.post('*/v1/admin/feedback/:id/confirm', notOperator),
  http.post('*/v1/admin/feedback/:id/not-a-bug', notOperator),
  // L13: the demo bug button is always on.
  http.get('*/v1/student/bug-button', () => HttpResponse.json({ state: 'on' })),
  http.get('*/v1/students/:id/bug-button', () => HttpResponse.json({ state: 'on' })),
  http.post('*/v1/students/:id/bug-button/on', () => HttpResponse.json({ state: 'on' })),
  // Bug Hunter (L7): nothing new to tell the demo student; seen always works.
  http.get('*/v1/student/feedback/rewards', () => HttpResponse.json({ rewards: [] })),
  http.post('*/v1/student/feedback/rewards/seen', () => new HttpResponse(null, { status: 204 })),
];
