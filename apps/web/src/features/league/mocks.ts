/** Mock friends league API (MSW) for development and tests: made-up nicknames only. */
import { http, HttpResponse, type RequestHandler } from 'msw';
import { sampleFriends, sampleLeague, sampleParentFriends } from './fixtures';

const ok = () => HttpResponse.json({ ok: true });
const gone = () => new HttpResponse(null, { status: 204 });

export const leagueHandlers: RequestHandler[] = [
  http.get('*/v1/student/league', () => HttpResponse.json(sampleLeague())),
  http.put('*/v1/student/league/hidden', ok),
  http.get('*/v1/student/friends', () => HttpResponse.json(sampleFriends())),
  http.post('*/v1/student/friends/codes', () =>
    HttpResponse.json(
      { code: 'ABCD-2345', expiresAt: '2026-11-28T10:00:00.000Z' },
      { status: 201 },
    ),
  ),
  http.post('*/v1/student/friends/redeem', () =>
    HttpResponse.json(
      { requestId: 'r-new', friend: { nickname: 'Nova_7', avatarCode: 'x', title: null } },
      { status: 201 },
    ),
  ),
  http.post('*/v1/student/friends/requests/:id/confirm', ok),
  http.post('*/v1/student/friends/requests/:id/cancel', ok),
  http.delete('*/v1/student/friends/:id', gone),
  http.post('*/v1/student/friends/:id/block', gone),
  http.post('*/v1/student/friends/:id/report', () => HttpResponse.json({}, { status: 201 })),
  http.get('*/v1/students/:id/friends', () => HttpResponse.json(sampleParentFriends())),
  http.put('*/v1/students/:id/friends/allowed', ok),
  http.post('*/v1/students/:id/friends/requests/:rid/approve', ok),
  http.post('*/v1/students/:id/friends/requests/:rid/decline', ok),
  http.delete('*/v1/students/:id/friends/blocks/:otherId', gone),
  http.delete('*/v1/students/:id/friends/:otherId', gone),
  http.post('*/v1/students/:id/friends/:otherId/block', gone),
  http.put('*/v1/students/:id/friends/:otherId/label', ok),
  http.post('*/v1/students/:id/friends/reports/:reportId/close', ok),
];
