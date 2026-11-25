import { http, HttpResponse, type RequestHandler } from 'msw';
import { answerRequestSchema } from '../api/schemas';
import { onboardingHandlers } from '../features/onboarding/mocks';
import { answerKeys, cardsDue, family, lessons, topicMap, XP_PER_CORRECT } from './data';
import { learnHandlers } from '../features/learn/mocks';
import { rewardsHandlers } from '../features/rewards/mocks';
import { feedbackHandlers } from '../features/feedback/mocks';
import { legalHandlers } from '../features/legal/mocks';
import { statsHandlers } from '../features/stats/mocks';

const normalise = (value: string) => value.trim().toLowerCase().replace(/\s+/g, '');

/** Mock API used in development and tests until the real API (workstream B) is ready. */
export const handlers: RequestHandler[] = [
  ...onboardingHandlers,
  http.get('*/api/family', () => HttpResponse.json(family)),

  // Student routes (device session) for the Map tab and the Cards badge (F2).
  http.get('*/v1/student/map', () => HttpResponse.json(topicMap)),
  http.get('*/v1/student/cards/due', () => HttpResponse.json(cardsDue)),

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

  // Learning loop and flashcards (workstream F).
  ...learnHandlers,
  ...rewardsHandlers,
  // Policies, About and feedback (workstream L).
  ...feedbackHandlers,
  ...legalHandlers,

  // Statistics dashboards (workstream K).
  ...statsHandlers,
];
