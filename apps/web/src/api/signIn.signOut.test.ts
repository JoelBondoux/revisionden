import { http, HttpResponse } from 'msw';
import { collectDeviceDetails, rememberLastProblem } from '../features/feedback/details';
import { server } from '../mocks/server';
import { signOut } from './signIn';

const lastProblem = () =>
  collectDeviceDetails({
    appVersion: '1',
    route: '/',
    userAgent: '',
    width: 1,
    height: 1,
    online: true,
  }).lastProblem;

describe('signing out (F18)', () => {
  it('forgets the last error code, so the next person on this device does not send it', async () => {
    rememberLastProblem('RD-VDMW5E');
    await signOut();
    expect(lastProblem()).toBeUndefined();
  });

  it('forgets it even when the API cannot be reached', async () => {
    server.use(http.post('*/api/auth/sign-out', () => HttpResponse.error()));
    rememberLastProblem('RD-VDMW5E');
    await signOut().catch(() => undefined);
    expect(lastProblem()).toBeUndefined();
  });
});
