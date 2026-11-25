import { http, HttpResponse } from 'msw';

/** Demo answers for the two-parent panels (no real data): one parent, nothing logged yet. */
export const parentsHandlers = [
  http.get('*/v1/family/parents', () =>
    HttpResponse.json({
      parents: [
        { position: 1, label: 'Parent 1', you: true, joinedAt: '2026-11-01T10:00:00.000Z' },
      ],
      canInvite: true,
      deletionRequest: null,
    }),
  ),
  http.post('*/v1/family/invites', () =>
    HttpResponse.json(
      {
        code: 'DEMO2345CODE',
        link: 'http://localhost/join?code=DEMO2345CODE',
        expiresAt: '2026-12-01T10:00:00.000Z',
      },
      { status: 201 },
    ),
  ),
  http.post('*/v1/family/join', () => HttpResponse.json({ familyId: 'demo-family', position: 2 })),
  http.get('*/v1/family/events', () => HttpResponse.json({ events: [], newFromOtherParent: 0 })),
  http.post('*/v1/family/events/seen', () => new HttpResponse(null, { status: 204 })),
  http.get('*/v1/removal-notice', () => HttpResponse.json({ removed: false })),
];
