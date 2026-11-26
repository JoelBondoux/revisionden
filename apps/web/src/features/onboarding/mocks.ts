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
  // Each demo child has one linked phone.
  http.get('*/v1/students/:id/devices', () =>
    HttpResponse.json({
      devices: [
        {
          id: 'device-1',
          deviceType: 'phone',
          linkedAt: '2026-11-24T10:00:00.000Z',
          lastUsedAt: null,
        },
      ],
    }),
  ),
  // Parent Subjects page (E5): the demo child's subjects; no questions are ready in the demo.
  http.get('*/v1/students/:id/subjects', ({ params }) =>
    HttpResponse.json({
      subjects: (family.children.find((c) => c.student.id === params.id)?.enrolments ?? []).map(
        (e) => ({ ...e, hasQuestions: false }),
      ),
    }),
  ),
  http.post('*/v1/students/:id/subjects', async ({ params, request }) =>
    HttpResponse.json(
      { ...((await request.json()) as object), studentId: params.id as string },
      { status: 201 },
    ),
  ),
  http.delete(
    '*/v1/students/:id/subjects/:subjectId',
    () => new HttpResponse(null, { status: 204 }),
  ),
  // Student device: the student's own subjects (all set in the demo family).
  http.get('*/v1/student/subjects', () =>
    HttpResponse.json({ enrolments: family.children[0]!.enrolments, toCheckLater: 0 }),
  ),
  http.get('*/v1/student/avatar', () =>
    HttpResponse.json({ avatarCode: family.children[0]!.student.avatarCode, earnedRewardIds: [] }),
  ),
  // W9 Me page: the student's own nickname, and saving a new look (nothing is kept).
  http.get('*/v1/student/me', () => HttpResponse.json(family.children[0]!.student)),
  http.put('*/v1/student/avatar', async ({ request }) => {
    const { avatarCode } = (await request.json()) as { avatarCode: string };
    return HttpResponse.json({ ...family.children[0]!.student, avatarCode });
  }),
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

  http.post('*/v1/students/:id/link-tokens', async ({ params, request }) => {
    const body = (await request.json().catch(() => ({}))) as { kind?: 'qr' | 'share' };
    const kind = body.kind ?? 'qr';
    const token = 'mock'.repeat(8);
    return HttpResponse.json(
      {
        tokenId: `mock-${kind}`,
        kind,
        token,
        familyId: 'mock-family',
        studentId: String(params.id),
        expiresAt: new Date(
          Date.now() + (kind === 'qr' ? 10 * 60_000 : 24 * 3600_000),
        ).toISOString(),
        linkUrl: `${location.origin}/link?token=${token}&family=mock-family`,
        code: kind === 'qr' ? 'MKQR-CD23' : 'MKSH-EF45',
      },
      { status: 201 },
    );
  }),

  http.get('*/v1/students/:id/link-tokens/:tokenId', () =>
    HttpResponse.json({ status: 'waiting' }),
  ),
  http.delete(
    '*/v1/students/:id/link-tokens/:tokenId',
    () => new HttpResponse(null, { status: 204 }),
  ),
  // Student passkey unlock (I5): any passkey answers; the mock device belongs to the first child.
  http.post('*/v1/device/unlock/options', () =>
    HttpResponse.json({ challengeId: 'mock-unlock', options: { challenge: 'mock-challenge' } }),
  ),
  http.post('*/v1/device/unlock/verify', () =>
    HttpResponse.json({ student: family.children[0]!.student }),
  ),
];
