import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { renderRoute } from '../test/render';
import { navigation } from '../api/signIn';
import { WelcomePage } from './WelcomePage';

describe('Welcome screen', () => {
  it('shows the app name, the promise and Pip', async () => {
    renderRoute('/', { studentId: null });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'RevisionDen' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Revision that finds the gaps.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Pip the fox' })).toBeInTheDocument();
  });

  it('offers password-free sign-in only', async () => {
    renderRoute('/', { studentId: null });
    expect(
      await screen.findByRole('button', { name: /continue with google/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with microsoft/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  });

  it('shows only the sign-in providers the server has set up', async () => {
    server.use(http.get('*/v1/auth/providers', () => HttpResponse.json({ providers: ['google'] })));
    renderRoute('/', { studentId: null });
    expect(
      await screen.findByRole('button', { name: /continue with google/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /continue with microsoft/i }),
    ).not.toBeInTheDocument();
  });

  it('offers both providers when it cannot ask the server', async () => {
    server.use(http.get('*/v1/auth/providers', () => HttpResponse.error()));
    renderRoute('/', { studentId: null });
    expect(
      await screen.findByRole('button', { name: /continue with microsoft/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
  });

  it('starts Google sign-in on the API and goes to the address it gives', async () => {
    let body: unknown;
    let credentials: RequestCredentials | undefined;
    server.use(
      http.post('*/api/auth/sign-in/social', async ({ request }) => {
        body = await request.json();
        credentials = request.credentials;
        return HttpResponse.json({ url: 'https://accounts.example/consent', redirect: true });
      }),
    );
    const redirect = vi.spyOn(navigation, 'leaveTo').mockImplementation(() => undefined);
    render(
      <MemoryRouter>
        <WelcomePage />
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByRole('button', { name: /continue with google/i }));
    await waitFor(() => expect(redirect).toHaveBeenCalledWith('https://accounts.example/consent'));
    expect(body).toEqual({
      provider: 'google',
      callbackURL: `${window.location.origin}/family`,
      errorCallbackURL: `${window.location.origin}/`,
    });
    expect(credentials).toBe('include');
  });

  it('says so, with a reference code, when sign-in cannot start', async () => {
    server.use(
      http.post('*/api/auth/sign-in/social', () =>
        HttpResponse.json(
          {
            error: { code: 'provider_not_found', message: 'Provider not found', ref: 'RD-7K2M9Q' },
          },
          { status: 404 },
        ),
      ),
    );
    const redirect = vi.spyOn(navigation, 'leaveTo').mockImplementation(() => undefined);
    render(
      <MemoryRouter>
        <WelcomePage />
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByRole('button', { name: /continue with microsoft/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/sign-in could not start/i);
    expect(screen.getByText('RD-7K2M9Q')).toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('says sign-in did not finish when the provider sends the parent back with an error', async () => {
    renderRoute('/?error=access_denied', { studentId: null });
    expect(await screen.findByRole('alert')).toHaveTextContent(/sign-in did not finish/i);
  });

  it('lets a student link this device with a code from a parent', async () => {
    renderRoute('/', { studentId: null });
    expect(await screen.findByText(/ask a parent to show you the qr code/i)).toBeInTheDocument();
  });

  it('lets a parent who is already signed in carry on, or sign out', async () => {
    server.use(
      http.get('*/api/auth/get-session', () =>
        HttpResponse.json({ session: { id: 's1' }, user: { id: 'u1' } }),
      ),
    );
    renderRoute('/', { studentId: null });
    expect(await screen.findByRole('link', { name: 'Continue' })).toHaveAttribute(
      'href',
      '/family',
    );
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /continue with google/i })).not.toBeInTheDocument();
  });
});
