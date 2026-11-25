import { http, HttpResponse, type RequestHandler } from 'msw';

/** Made-up programmes for development and tests: not in the beta programme. */
export const programmeHandlers: RequestHandler[] = [
  http.get('*/v1/family/programmes', () => HttpResponse.json({ beta: false })),
  http.delete('*/v1/family/programmes/beta', () => new HttpResponse(null, { status: 204 })),
];
