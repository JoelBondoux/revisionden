import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { family } from '../../mocks/data';
import { renderRoute } from '../../test/render';
import { passkeyBrowser } from './StudentUnlock';

const CHILD = family.children[0]!.student;

function stubPasskey(answer: () => Promise<unknown>) {
  return vi.spyOn(passkeyBrowser, 'authenticate').mockImplementation(answer);
}

const noPasskey = () => {
  const err = new Error('The operation either timed out or was not allowed.');
  err.name = 'NotAllowedError';
  return Promise.reject(err);
};

describe('Student passkey unlock', () => {
  it('offers students a passkey unlock on the sign-in page, beside the parent sign-in', async () => {
    // The parent buttons wait for the provider list; make that slow so the test never races it.
    server.use(
      http.get('*/v1/auth/providers', async () => {
        await delay(200);
        return HttpResponse.json({ providers: ['google'] });
      }),
    );
    renderRoute('/', { studentId: null });
    expect(
      await screen.findByRole('button', { name: "I'm a student: unlock with my passkey" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: /continue with google/i }),
    ).toBeInTheDocument();
  });

  it('unlocks with the passkey on this device and lands the student on their topic map', async () => {
    let optionsBody: unknown;
    let verifyBody: unknown;
    server.use(
      http.post('*/v1/device/unlock/options', async ({ request }) => {
        optionsBody = await request.json();
        return HttpResponse.json({ challengeId: 'c1', options: { challenge: 'abc' } });
      }),
      http.post('*/v1/device/unlock/verify', async ({ request }) => {
        verifyBody = await request.json();
        return HttpResponse.json({ student: CHILD });
      }),
    );
    const authenticate = stubPasskey(async () => ({ id: 'cred-1', response: {} }));
    const { router } = renderRoute('/', { studentId: null });
    await userEvent.click(
      await screen.findByRole('button', { name: "I'm a student: unlock with my passkey" }),
    );
    expect(await screen.findByRole('heading', { level: 1, name: 'Topic map' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/map');
    expect(optionsBody).toEqual({});
    expect(authenticate).toHaveBeenCalledWith({ challenge: 'abc' });
    expect(verifyBody).toEqual({ challengeId: 'c1', response: { id: 'cred-1', response: {} } });
  });

  it('takes the student back to the page they were on after unlocking', async () => {
    stubPasskey(async () => ({ id: 'cred-1', response: {} }));
    const { router } = renderRoute('/unlock?returnTo=%2Fcards', { studentId: null });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Unlock RevisionDen' }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Unlock with my passkey' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/cards'));
  });

  it('never sends the student to another site after unlocking', async () => {
    stubPasskey(async () => ({ id: 'cred-1', response: {} }));
    const { router } = renderRoute('/unlock?returnTo=%2F%2Fevil.example', { studentId: null });
    await userEvent.click(await screen.findByRole('button', { name: 'Unlock with my passkey' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/map'));
  });

  it('asks a parent to link this device when no passkey is found here, showing no account details', async () => {
    stubPasskey(noPasskey);
    renderRoute('/unlock', { studentId: null });
    await userEvent.click(await screen.findByRole('button', { name: 'Unlock with my passkey' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No RevisionDen passkey was found on this device.');
    expect(alert).toHaveTextContent('Ask a parent to link this device.');
    expect(screen.queryByText(CHILD.nickname)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unlock with my passkey' })).toBeEnabled();
  });

  it('says the same when the passkey is no longer linked (a parent removed the device)', async () => {
    server.use(
      http.post('*/v1/device/unlock/verify', () =>
        HttpResponse.json(
          { error: { code: 'passkey_not_verified', message: 'The passkey could not be checked.' } },
          { status: 400 },
        ),
      ),
    );
    stubPasskey(async () => ({ id: 'old-cred', response: {} }));
    renderRoute('/unlock', { studentId: null });
    await userEvent.click(await screen.findByRole('button', { name: 'Unlock with my passkey' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ask a parent to link this device.');
  });

  it('gives a reference code when unlocking fails for another reason', async () => {
    server.use(
      http.post('*/v1/device/unlock/options', () =>
        HttpResponse.json(
          { error: { code: 'internal_error', message: 'Something went wrong', ref: 'RD-7K2M9Q' } },
          { status: 500 },
        ),
      ),
    );
    const authenticate = stubPasskey(async () => ({ id: 'cred-1', response: {} }));
    renderRoute('/unlock', { studentId: null });
    await userEvent.click(await screen.findByRole('button', { name: 'Unlock with my passkey' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not unlock/i);
    expect(screen.getByText('RD-7K2M9Q')).toBeInTheDocument();
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('sends a student whose session has run out to unlock, keeping where they were', async () => {
    server.use(
      http.get('*/v1/student/map', () =>
        HttpResponse.json(
          { error: { code: 'unauthorized', message: 'Sign in required', ref: 'RD-AAAAAA' } },
          { status: 401 },
        ),
      ),
    );
    const { router } = renderRoute('/map');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Unlock RevisionDen' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/unlock');
    expect(router.state.location.search).toBe('?returnTo=%2Fmap');
    expect(screen.queryByRole('button', { name: /continue with google/i })).not.toBeInTheDocument();
  });

  it('sends a student to unlock from the rewards page too', async () => {
    server.use(
      http.get('*/v1/student/rewards', () =>
        HttpResponse.json(
          { error: { code: 'unauthorized', message: 'Sign in required' } },
          { status: 401 },
        ),
      ),
    );
    const { router } = renderRoute('/rewards');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Unlock RevisionDen' }),
    ).toBeInTheDocument();
    expect(router.state.location.search).toBe('?returnTo=%2Frewards');
  });

  it('still asks a parent to sign in when a parent page gets a 401', async () => {
    server.use(
      http.get('*/v1/onboarding/family', () =>
        HttpResponse.json(
          { error: { code: 'unauthorized', message: 'Sign in required' } },
          { status: 401 },
        ),
      ),
    );
    renderRoute('/family', { studentId: null });
    expect(await screen.findByRole('heading', { name: 'Please sign in' })).toBeInTheDocument();
  });

  it('uses the shared link styles, never plain underlined links (J7)', async () => {
    renderRoute('/unlock', { studentId: null });
    const parents = await screen.findByRole('link', { name: 'Parents sign in here' });
    expect(parents).toHaveAttribute('href', '/');
    expect(parents).toHaveClass('text-link');
  });
});
