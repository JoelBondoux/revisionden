import { http, HttpResponse, type RequestHandler } from 'msw';
import {
  OnboardChildRequestSchema,
  examSeasonFor,
  levelForYear,
  toCheckLaterCount,
  type OnboardedChild,
} from '@revisionden/core';
import { family } from '../../mocks/data';

/** Mock onboarding API for development and tests (made-up data only, nothing kept). */
export const onboardingHandlers: RequestHandler[] = [
  http.get('*/v1/onboarding/family', () => HttpResponse.json(family)),

  http.post('*/v1/onboarding/children', async ({ request }) => {
    const body = OnboardChildRequestSchema.safeParse(await request.json());
    if (!body.success) return new HttpResponse(null, { status: 400 });
    const { subjects, ...student } = body.data;
    const id = crypto.randomUUID();
    const child: OnboardedChild = {
      student: { id, ...student },
      enrolments: subjects.map((s) => ({ ...s, studentId: id })),
      level: levelForYear(student.yearGroup)!,
      examSeason: examSeasonFor(student.yearGroup, new Date())!,
      toCheckLater: toCheckLaterCount(subjects),
      linkedDevices: 0,
    };
    return HttpResponse.json(child, { status: 201 });
  }),

  http.post('*/v1/students/:id/link-tokens', ({ params }) => {
    const token = 'mock'.repeat(8);
    return HttpResponse.json(
      {
        token,
        familyId: 'mock-family',
        studentId: String(params.id),
        expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
        linkUrl: `${location.origin}/link?token=${token}&family=mock-family`,
      },
      { status: 201 },
    );
  }),

  // Student passkey unlock (I5): any passkey answers; the mock device belongs to the first child.
  http.post('*/v1/device/unlock/options', () =>
    HttpResponse.json({ challengeId: 'mock-unlock', options: { challenge: 'mock-challenge' } }),
  ),
  http.post('*/v1/device/unlock/verify', () =>
    HttpResponse.json({ student: family.children[0]!.student }),
  ),
];
