import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { createLearnApi } from './learnApi';

const api = createLearnApi({ baseUrl: 'http://api.test/api' });

describe('learning API client', () => {
  it('asks for a topic lesson with the student’s cookie', async () => {
    let seen: { url: string; credentials: RequestCredentials } | undefined;
    const spy = createLearnApi({
      baseUrl: 'http://api.test/api/',
      fetch: async (input, init) => {
        seen = { url: String(input), credentials: init!.credentials! };
        return Response.json({ items: [], draftContent: false });
      },
    });
    await spy.getLesson({ topicId: 'demo topic' });
    expect(seen).toEqual({
      url: 'http://api.test/api/v1/student/learn/lesson?topicId=demo+topic',
      credentials: 'include',
    });
  });

  it('checks every response against the shared schema', async () => {
    server.use(http.get('*/v1/student/learn/progress', () => HttpResponse.json({ xpToday: -1 })));
    await expect(api.getProgress()).rejects.toMatchObject({ kind: 'schema' });
  });

  it('reports server errors and network failures', async () => {
    server.use(http.get('*/v1/student/flashcards', () => new HttpResponse(null, { status: 503 })));
    await expect(api.getFlashcards()).rejects.toMatchObject({ kind: 'http', status: 503 });
    server.use(http.get('*/v1/student/flashcards', () => HttpResponse.error()));
    await expect(api.getFlashcards()).rejects.toMatchObject({ kind: 'network' });
  });

  it('sends attempts, reviews and new cards as JSON', async () => {
    const result = await api.submitAttempt({
      itemId: '00000000-0000-4000-8000-000000000001',
      answer: 1,
      timeMs: 10,
      mode: 'learn',
    });
    expect(result.correct).toBe(true);
    const review = await api.reviewFlashcard('00000000-0000-4000-8000-000000000101', 'good');
    expect(review.xpEarned).toBe(2);
    const created = await api.createFlashcard({ topicId: 't', front: 'F', back: 'B' });
    expect(created.origin).toBe('own');
    expect((await api.getDeck('demo-topic-a')).length).toBe(2);
  });

  it('starts and finishes a starting test', async () => {
    const test = await api.startStartingTest('gcse-maths');
    const result = await api.finishStartingTest(test.id);
    expect(result.total).toBe(3);
    expect((await api.getSubjectTopics('gcse-maths')).topics).toHaveLength(2);
    expect((await api.getCommandWords()).items).toHaveLength(1);
  });
});
