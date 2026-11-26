import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { family } from '../../mocks/data';
import { renderRoute } from '../../test/render';
import { collectDeviceDetails } from '../feedback/details';
import { passkeyBrowser, unlockEnv } from './StudentUnlock';

/**
 * E10, "Use my phone instead" (owner decision 2026-11-26): on a computer or tablet, or after no
 * passkey was found, the student can sign in with the passkey on their phone. The browser shows a
 * QR code to scan (WebAuthn hybrid); we only hint the browser and explain what to do.
 */
const CHILD = family.children[0]!.student;
const PHONE_BUTTON = { name: 'Use my phone instead' };
const HOW = 'Your browser shows a QR code. Scan it with the phone you use for RevisionDen.';

const dom = (name: string) => Object.assign(new Error('browser text, never shown'), { name });

function onDevice(type: 'phone' | 'tablet' | 'computer') {
  vi.spyOn(unlockEnv, 'deviceType').mockReturnValue(type);
}

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('Use my phone instead', () => {
  it('is offered on a computer, with one line saying what happens', async () => {
    onDevice('computer');
    renderRoute('/unlock', { studentId: null });
    expect(await screen.findByRole('button', PHONE_BUTTON)).toBeInTheDocument();
    expect(screen.getByText(HOW)).toBeInTheDocument();
  });

  it('is offered on a tablet and on the welcome page too', async () => {
    onDevice('tablet');
    renderRoute('/', { studentId: null });
    expect(await screen.findByRole('button', PHONE_BUTTON)).toBeInTheDocument();
  });

  it('is not offered on a phone at first, but is once no passkey was found there', async () => {
    onDevice('phone');
    vi.spyOn(passkeyBrowser, 'authenticate').mockRejectedValue(dom('NotAllowedError'));
    renderRoute('/unlock', { studentId: null });
    await userEvent.click(await screen.findByRole('button', { name: 'Unlock with my passkey' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No RevisionDen passkey was found on this device.');
    expect(alert).toHaveTextContent('Ask a parent to link this device.');
    expect(screen.getByRole('button', PHONE_BUTTON)).toBeInTheDocument();
  });

  it('hides it on a phone before any try', async () => {
    onDevice('phone');
    renderRoute('/unlock', { studentId: null });
    await screen.findByRole('button', { name: 'Unlock with my passkey' });
    expect(screen.queryByRole('button', PHONE_BUTTON)).toBeNull();
  });

  it('asks the API for phone options, passes the hint to the browser and signs in', async () => {
    onDevice('computer');
    let optionsBody: unknown;
    server.use(
      http.post('*/v1/device/unlock/options', async ({ request }) => {
        optionsBody = await request.json();
        return HttpResponse.json({
          challengeId: 'c1',
          options: { challenge: 'abc', hints: ['hybrid'] },
        });
      }),
      http.post('*/v1/device/unlock/verify', () => HttpResponse.json({ student: CHILD })),
    );
    const authenticate = vi
      .spyOn(passkeyBrowser, 'authenticate')
      .mockResolvedValue({ id: 'cred-1', response: {} });
    const { router } = renderRoute('/unlock', { studentId: null });
    await userEvent.click(await screen.findByRole('button', PHONE_BUTTON));
    await waitFor(() => expect(router.state.location.pathname).toBe('/map'));
    expect(optionsBody).toEqual({ usePhone: true });
    expect(authenticate).toHaveBeenCalledWith({ challenge: 'abc', hints: ['hybrid'] });
  });

  it('keeps the normal unlock exactly as it was', async () => {
    onDevice('computer');
    let optionsBody: unknown;
    server.use(
      http.post('*/v1/device/unlock/options', async ({ request }) => {
        optionsBody = await request.json();
        return HttpResponse.json({ challengeId: 'c1', options: { challenge: 'abc' } });
      }),
    );
    vi.spyOn(passkeyBrowser, 'authenticate').mockResolvedValue({ id: 'cred-1', response: {} });
    renderRoute('/unlock', { studentId: null });
    await userEvent.click(await screen.findByRole('button', { name: 'Unlock with my passkey' }));
    await waitFor(() => expect(optionsBody).toEqual({}));
  });
});

describe('Use my phone instead: when it does not work', () => {
  it('says to check Bluetooth and keep the phone close, with the error name and a reference', async () => {
    onDevice('computer');
    vi.spyOn(passkeyBrowser, 'authenticate').mockRejectedValue(dom('NotAllowedError'));
    renderRoute('/unlock', { studentId: null });
    await userEvent.click(await screen.findByRole('button', PHONE_BUTTON));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      'We could not reach your phone. Turn on Bluetooth on this device and on your phone, keep your phone close by, then try again.',
    );
    expect(screen.getByText(/^Details: NotAllowedError \(RD-[A-Z0-9]{6}\)$/)).toBeInTheDocument();
    const lastProblem = collectDeviceDetails({
      appVersion: '1',
      route: '/unlock',
      userAgent: '',
      width: 1,
      height: 1,
      online: true,
    }).lastProblem;
    expect(lastProblem).toMatch(/^phone:NotAllowedError:RD-[A-Z0-9]{6}$/);
    // The student can try again straight away.
    expect(screen.getByRole('button', PHONE_BUTTON)).toBeEnabled();
  });

  it('says this browser cannot use a phone when it does not support it', async () => {
    onDevice('computer');
    vi.spyOn(passkeyBrowser, 'authenticate').mockRejectedValue(dom('NotSupportedError'));
    renderRoute('/unlock', { studentId: null });
    await userEvent.click(await screen.findByRole('button', PHONE_BUTTON));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This browser cannot sign in with your phone. Try Chrome, Edge or Safari, or ask a parent to link this device.',
    );
  });

  it("says the phone's passkey is not linked when the server does not know it", async () => {
    onDevice('computer');
    server.use(
      http.post('*/v1/device/unlock/verify', () =>
        HttpResponse.json(
          { error: { code: 'passkey_not_verified', message: 'The passkey could not be checked.' } },
          { status: 400 },
        ),
      ),
    );
    vi.spyOn(passkeyBrowser, 'authenticate').mockResolvedValue({ id: 'cred-x', response: {} });
    renderRoute('/unlock', { studentId: null });
    await userEvent.click(await screen.findByRole('button', PHONE_BUTTON));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('That passkey is not linked to RevisionDen.');
    expect(alert).toHaveTextContent('Ask a parent to link this device.');
  });
});
