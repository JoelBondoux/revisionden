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
];
