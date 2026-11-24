import { http, HttpResponse, type RequestHandler } from 'msw';
import { answerRequestSchema } from '../api/schemas';
import { answerKeys, cardsDue, family, lessons, topicMap, XP_PER_CORRECT } from './data';

const isKnownStudent = (id: unknown) => family.students.some((s) => s.id === id);

const normalise = (value: string) => value.trim().toLowerCase().replace(/\s+/g, '');

/** Mock API used in development and tests until the real API (workstream B) is ready. */
export const handlers: RequestHandler[] = [
  http.get('*/api/family', () => HttpResponse.json(family)),

  http.get('*/api/students/:studentId/map', ({ params }) =>
    isKnownStudent(params.studentId)
      ? HttpResponse.json(topicMap)
      : new HttpResponse(null, { status: 404 }),
  ),

  http.get('*/api/students/:studentId/cards/due', ({ params }) =>
    isKnownStudent(params.studentId)
      ? HttpResponse.json(cardsDue)
      : new HttpResponse(null, { status: 404 }),
  ),

  http.get('*/api/lessons/:lessonId', ({ params }) => {
    const lesson = lessons[String(params.lessonId)];
    return lesson ? HttpResponse.json(lesson) : new HttpResponse(null, { status: 404 });
  }),

  http.post('*/api/lessons/:lessonId/answers', async ({ request }) => {
    const body = answerRequestSchema.safeParse(await request.json());
    const key = body.success ? answerKeys[body.data.itemId] : undefined;
    if (!body.success || !key) return new HttpResponse(null, { status: 400 });
    const correct = normalise(body.data.answer) === normalise(key.answer);
    return HttpResponse.json({
      correct,
      correctAnswer: key.display,
      explanation: key.explanation,
      xpEarned: correct ? XP_PER_CORRECT : 0,
    });
  }),
];
