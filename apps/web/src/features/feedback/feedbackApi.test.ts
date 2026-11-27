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

  it('reads a confirmed outcome and its reward, and treats a missing one as not confirmed', async () => {
    const item = {
      id: '00000000-0000-4000-8000-000000000002',
      kind: 'bug',
      text: null,
      status: 'fixed',
      senderRole: 'student',
      createdAt: '2026-11-24T10:00:00.000Z',
      updatedAt: '2026-11-24T10:00:00.000Z',
    };
    server.use(
      http.get('*/v1/student/feedback', () =>
        HttpResponse.json({ feedback: [{ ...item, outcome: 'confirmed', rewardXp: 50 }, item] }),
      ),
    );
    const [confirmed, older] = await api.listOwn();
    expect(confirmed).toMatchObject({ outcome: 'confirmed', rewardXp: 50 });
    expect(older).toMatchObject({ outcome: null, rewardXp: 0 });
  });

  it('confirms a bug, or confirms it as a duplicate of an earlier one', async () => {
    const bodies: unknown[] = [];
    const item = {
      id: 'f9',
      kind: 'bug',
      text: null,
      status: 'new',
      senderRole: 'student',
      createdAt: '2026-11-24T10:00:00.000Z',
      updatedAt: '2026-11-24T10:00:00.000Z',
      device: null,
      outcome: 'confirmed',
      rewardXp: 50,
      duplicateOf: null,
    };
    server.use(
      http.post('*/v1/admin/feedback/:id/confirm', async ({ request, params }) => {
        bodies.push({ id: params.id, body: await request.json() });
        return HttpResponse.json({ item, message: 'Confirmed. The student earns 50 XP.' });
      }),
    );
    const result = await api.confirm('f9');
    expect(result.message).toBe('Confirmed. The student earns 50 XP.');
    expect(result.item).toMatchObject({ outcome: 'confirmed', rewardXp: 50, duplicateOf: null });
    await api.confirm('f9', 'f1');
    expect(bodies).toEqual([
      { id: 'f9', body: {} },
      { id: 'f9', body: { duplicateOf: 'f1' } },
    ]);
  });

  it('passes on why a confirmation was refused', async () => {
    server.use(
      http.post('*/v1/admin/feedback/:id/confirm', () =>
        HttpResponse.json(
          { error: { code: 'already_confirmed', message: 'This bug is already confirmed.' } },
          { status: 409 },
        ),
      ),
    );
    await expect(api.confirm('f9')).rejects.toMatchObject({
      status: 409,
      code: 'already_confirmed',
      message: 'This bug is already confirmed.',
    });
  });

  it("reads a student's unseen rewards and marks them seen", async () => {
    let seen: unknown;
    server.use(
      http.get('*/v1/student/feedback/rewards', () =>
        HttpResponse.json({
          rewards: [
            {
              id: 'f1',
              outcome: 'confirmed',
              rewardXp: 50,
              message: 'Your bug report helped! +50 XP',
              confirmedAt: '2026-11-25T10:00:00.000Z',
            },
          ],
        }),
      ),
      http.post('*/v1/student/feedback/rewards/seen', async ({ request }) => {
        seen = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const rewards = await api.listRewards();
    expect(rewards).toEqual([expect.objectContaining({ id: 'f1', rewardXp: 50 })]);
    await api.markRewardsSeen(['f1']);
    expect(seen).toEqual({ ids: ['f1'] });
  });

  it('reads and switches on the bug button, and marks a report Not a bug (L13)', async () => {
    const seen: string[] = [];
    server.use(
      http.get('*/v1/student/bug-button', () =>
        HttpResponse.json({ state: 'paused', until: '2026-12-08T10:00:00.000Z' }),
      ),
      http.get('*/v1/students/:id/bug-button', ({ params }) => {
        seen.push(`get ${String(params.id)}`);
        return HttpResponse.json({ state: 'removed' });
      }),
      http.post('*/v1/students/:id/bug-button/on', ({ params }) => {
        seen.push(`on ${String(params.id)}`);
        return HttpResponse.json({ state: 'on' });
      }),
      http.post('*/v1/admin/feedback/:id/not-a-bug', ({ params }) =>
        HttpResponse.json({
          item: {
            id: params.id,
            kind: 'bug',
            text: null,
            status: 'will_not_fix',
            senderRole: 'student',
            createdAt: '2026-11-25T09:00:00.000Z',
            updatedAt: '2026-11-25T09:00:00.000Z',
            outcome: 'not_a_bug',
            rewardXp: 0,
            device: null,
          },
        }),
      ),
    );
    expect(await api.bugButton()).toEqual({ state: 'paused', until: '2026-12-08T10:00:00.000Z' });
    expect(await api.childBugButton('kid-1')).toEqual({ state: 'removed' });
    expect(await api.switchChildBugButtonOn('kid-1')).toEqual({ state: 'on' });
    expect(seen).toEqual(['get kid-1', 'on kid-1']);
    expect(await api.markNotABug('f1')).toMatchObject({ id: 'f1', outcome: 'not_a_bug' });
  });
});
