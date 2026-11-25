import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { ApiError, createApiClient } from './client';

const client = createApiClient({ baseUrl: 'http://api.test/api' });

describe('API client', () => {
  it('returns the family when the response matches the schema', async () => {
    const family = await client.getFamily();
    expect(family.students.length).toBeGreaterThan(0);
    expect(family.students[0]).toEqual(
      expect.objectContaining({ id: expect.any(String), nickname: expect.any(String) }),
    );
  });

  it('rejects a response that fails the schema', async () => {
    server.use(http.get('*/api/family', () => HttpResponse.json({ students: [{ id: 42 }] })));
    await expect(client.getFamily()).rejects.toMatchObject({ kind: 'schema' });
  });

  it('rejects with the status when the server returns an error', async () => {
    server.use(http.get('*/api/family', () => new HttpResponse(null, { status: 500 })));
    const error = await client.getFamily().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: 'http', status: 500 });
  });

  it('rejects with a network error when the request cannot be made', async () => {
    server.use(http.get('*/api/family', () => HttpResponse.error()));
    await expect(client.getFamily()).rejects.toMatchObject({ kind: 'network' });
  });

  it('fetches the topic map from the student routes with the device cookie', async () => {
    let seen: { url: string; credentials?: RequestCredentials } | undefined;
    const spy = createApiClient({
      baseUrl: 'http://api.test/api',
      fetch: async (input, init) => {
        seen = { url: String(input), credentials: init?.credentials };
        return Response.json(await (await fetch('http://api.test/api/v1/student/map')).json());
      },
    });
    const map = await spy.getTopicMap();
    expect(map.units.length).toBeGreaterThan(0);
    expect(seen).toEqual({ url: 'http://api.test/api/v1/student/map', credentials: 'include' });
  });

  it('fetches how many flashcards are due from the student routes', async () => {
    const cards = await client.getCardsDue();
    expect(cards.due).toBeGreaterThanOrEqual(0);
  });

  it('fetches a lesson by id', async () => {
    const lesson = await client.getLesson('standard-form');
    expect(lesson.items.length).toBeGreaterThan(0);
  });

  it('sends an answer and returns the marking result', async () => {
    let received: unknown;
    server.use(
      http.post('*/api/lessons/:lessonId/answers', async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({
          correct: true,
          correctAnswer: '0.0032',
          explanation: 'Move the point three places left.',
          xpEarned: 10,
        });
      }),
    );
    const result = await client.submitAnswer('standard-form', { itemId: 'sf-2', answer: '0.0032' });
    expect(received).toEqual({ itemId: 'sf-2', answer: '0.0032' });
    expect(result.correct).toBe(true);
  });
});
