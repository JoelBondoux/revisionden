import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { createFeedbackApi, FeedbackApiError } from './feedbackApi';

const api = createFeedbackApi({ baseUrl: 'https://app.example/api' });

describe('feedback API client', () => {
  it('sends student feedback to the student route and parent feedback to the parent route', async () => {
    const seen: string[] = [];
    server.use(
      http.post('*/v1/student/feedback', async ({ request }) => {
        seen.push(`student ${JSON.stringify(await request.json())}`);
        return HttpResponse.json({}, { status: 201 });
      }),
      http.post('*/v1/feedback', async ({ request }) => {
        seen.push(`parent ${JSON.stringify(await request.json())}`);
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    await api.send('student', { kind: 'bug', text: 'Broken button' });
    await api.send('parent', { kind: 'idea' });
    expect(seen).toEqual([
      'student {"kind":"bug","text":"Broken button"}',
      'parent {"kind":"idea"}',
    ]);
  });

  it('turns API errors into a code and a message', async () => {
    server.use(
      http.post('*/v1/feedback', () =>
        HttpResponse.json(
          { error: { code: 'feedback_limit', message: 'You can send 5 messages a day.' } },
          { status: 429 },
        ),
      ),
    );
    const error = await api.send('parent', { kind: 'other' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(FeedbackApiError);
    expect(error).toMatchObject({
      status: 429,
      code: 'feedback_limit',
      message: 'You can send 5 messages a day.',
    });
  });

  it('gives a general message when the reply has no error body', async () => {
    server.use(http.get('*/v1/feedback', () => new HttpResponse(null, { status: 500 })));
    await expect(api.listFamily()).rejects.toMatchObject({ status: 500, code: 'http_error' });
  });

  it('gives a network error when the request cannot be sent', async () => {
    server.use(http.get('*/v1/admin/feedback', () => HttpResponse.error()));
    await expect(api.listAll()).rejects.toMatchObject({ status: 0, code: 'network' });
  });

  it('reads the family list, the triage list and updates a status', async () => {
    const item = {
      id: '00000000-0000-4000-8000-000000000001',
      kind: 'bug',
      text: null,
      status: 'new',
      senderRole: 'student',
      createdAt: '2026-11-24T10:00:00.000Z',
      updatedAt: '2026-11-24T10:00:00.000Z',
    };
    server.use(
      http.get('*/v1/feedback', () =>
        HttpResponse.json({ feedback: [{ ...item, studentNickname: 'demo_kid' }] }),
      ),
      http.get('*/v1/student/feedback', () => HttpResponse.json({ feedback: [item] })),
      http.get('*/v1/admin/feedback', () =>
        HttpResponse.json({ feedback: [{ ...item, device: null }] }),
      ),
      http.patch('*/v1/admin/feedback/:id', async ({ request }) =>
        HttpResponse.json({ ...item, ...((await request.json()) as object), device: null }),
      ),
    );
    expect((await api.listFamily())[0]?.studentNickname).toBe('demo_kid');
    expect(await api.listOwn()).toHaveLength(1);
    expect((await api.listAll())[0]?.device).toBeNull();
    expect((await api.setStatus(item.id, 'fixed')).status).toBe('fixed');
  });
});
