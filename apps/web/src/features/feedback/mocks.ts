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
  },
];

const sent = () => new HttpResponse(null, { status: 201 });

export const feedbackHandlers: RequestHandler[] = [
  http.post('*/api/v1/student/feedback', sent),
  http.post('*/api/v1/feedback', sent),
  http.get('*/api/v1/feedback', () => HttpResponse.json({ feedback: demo })),
  http.get('*/api/v1/student/feedback', () =>
    HttpResponse.json({
      feedback: demo.map((item) => {
        const own: Partial<typeof item> = { ...item };
        delete own.studentNickname;
        return own;
      }),
    }),
  ),
  // The demo parent is not an operator: triage answers 404, as the real API does.
  http.get('*/api/v1/admin/feedback', () =>
    HttpResponse.json({ error: { code: 'not_found', message: 'Not found' } }, { status: 404 }),
  ),
];
